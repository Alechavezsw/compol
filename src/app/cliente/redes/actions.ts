"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireOrganization } from "@/lib/auth";
import { generateRadarReport, isGeminiConfigured } from "@/lib/ai/gemini";
import { buildLocalRadarReport } from "@/lib/demo/report";
import { isDemoMode } from "@/lib/demo/mode";
import { computeSocial } from "@/lib/social/analytics";
import { addDays, todayKey } from "@/lib/stats";
import { fetchAll } from "@/lib/supabase/fetch-all";
import {
  classifyPosts,
  classifyPostsLocal,
  enrichRawPosts,
  fetchRss,
  googleNewsRssUrl,
  isRecentNews,
  normalizeNetwork,
  parseCsv,
  parsePasted,
  type RawPost,
} from "@/lib/social/ingest";
import { cleanHeadline, looksLikeLocalNews, sameStory, uniqueStories } from "@/lib/social/headline";
import { fetchMetaListen, isMetaConfigured } from "@/lib/social/meta";
import { classifyText } from "@/lib/social/lexicon";
import type { Emotion, SentimentLabel, SocialNetwork, SocialPost, SocialSource, SocialTracker } from "@/lib/types";

export type RadarCandidate = {
  network: SocialNetwork;
  external_id: string | null;
  author: string | null;
  url: string | null;
  text: string;
  published_at: string;
  engagement: number;
  sentiment: number;
  label: SentimentLabel;
  emotion: Emotion | null;
  topics: string[];
  classified_by: string;
};

export type SocialActionState = {
  error?: string | null;
  ok?: string | null;
  headlines?: string[];
  candidates?: RadarCandidate[];
  inserted?: number;
};

const MAX_IMPORT = 3000;
const DEFAULT_NEWS_NAME = "Noticias de San Juan";
const DEFAULT_NEWS_QUERY =
  '("Municipalidad de San Juan" OR "Ciudad de San Juan" OR "Municipalidad de Capital") when:30d';
const LOCAL_SITES =
  "(site:diariodecuyo.com.ar OR site:diariohuarpe.com OR site:elzonda.info OR site:tiempodesanjuan.com OR site:diario13sanjuan.com.ar OR site:sanjuan8.com)";
const DEFAULT_TRACKERS: { name: string; keywords: string[] }[] = [
  { name: "Gestión municipal", keywords: ["municipalidad", "intendente", "municipio", "concejo"] },
  { name: "Calles y obras", keywords: ["bache", "asfalto", "vereda", "obra"] },
  { name: "Seguridad", keywords: ["inseguridad", "robo", "policía", "cámaras"] },
  { name: "Niñez y familia", keywords: ["unicef", "muna", "niñez", "infancia"] },
  { name: "Espacios públicos", keywords: ["plaza", "feria", "parque"] },
];

async function trackersOf(supabase: Awaited<ReturnType<typeof createClient>>, organizationId: string) {
  const { data } = await supabase.from("social_trackers").select("*").eq("organization_id", organizationId).eq("is_active", true);
  return (data ?? []) as SocialTracker[];
}

async function logImport(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  input: { sourceId?: string | null; mode: string; inserted: number; duplicates: number; error?: string | null },
) {
  await supabase.from("social_imports").insert({
    organization_id: organizationId,
    source_id: input.sourceId ?? null,
    mode: input.mode,
    inserted: input.inserted,
    duplicates: input.duplicates,
    status: input.error ? "error" : "ok",
    error_message: input.error ?? null,
  });
}

function headlineKey(text: string) {
  return text.replace(/\s+/g, " ").trim().toLowerCase().slice(0, 80);
}

async function storedKeys(supabase: Awaited<ReturnType<typeof createClient>>, organizationId: string) {
  const stored = await fetchAll<{ network: string; external_id: string | null; text: string }>((from, to) =>
    supabase.from("social_posts").select("network, external_id, text").eq("organization_id", organizationId).order("id").range(from, to),
  );
  return {
    existing: new Set(stored.map((p) => `${p.network}|${p.external_id}`)),
    headlines: new Set(stored.map((p) => headlineKey(p.text))),
    texts: stored.map((p) => p.text),
  };
}

function onlyFresh(
  classified: RadarCandidate[],
  keys: { existing: Set<string>; headlines: Set<string>; texts: string[] },
) {
  const existing = new Set(keys.existing);
  const headlines = new Set(keys.headlines);
  const texts = [...keys.texts];
  return classified.filter((p) => {
    const key = `${p.network}|${p.external_id}`;
    const head = headlineKey(p.text);
    if (existing.has(key) || headlines.has(head) || texts.some((t) => sameStory(t, p.text))) return false;
    existing.add(key);
    headlines.add(head);
    texts.push(p.text);
    return true;
  });
}

async function classifyWithBudget(
  raw: RawPost[],
  trackers: SocialTracker[],
  organizationId: string,
) {
  try {
    return await Promise.race([
      classifyPosts(raw, trackers, organizationId),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("timeout")), 18_000);
      }),
    ]);
  } catch {
    return classifyPostsLocal(raw, trackers);
  }
}

async function persistClassified(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  classified: RadarCandidate[],
) {
  const keys = await storedKeys(supabase, organizationId);
  const fresh = onlyFresh(uniqueStories(classified), keys);

  for (let i = 0; i < fresh.length; i += 500) {
    const { error } = await supabase
      .from("social_posts")
      .insert(fresh.slice(i, i + 500).map((p) => ({ ...p, organization_id: organizationId })));
    if (error) throw new Error(`Se guardaron ${i} publicaciones y falló el resto: ${error.message}`);
  }

  return {
    inserted: fresh.length,
    duplicates: classified.length - fresh.length,
    headlines: (fresh.length ? fresh : classified).slice(0, 8).map((p) => cleanHeadline(p.text)),
    fresh,
  };
}

async function insertFresh(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  raw: RawPost[],
  trackers: SocialTracker[],
  skipAi = false,
) {
  const classified = skipAi
    ? classifyPostsLocal(raw, trackers)
    : await classifyWithBudget(raw, trackers, organizationId);
  return persistClassified(supabase, organizationId, classified);
}

export async function retagRecent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  trackers: SocialTracker[],
) {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
  const { data } = await supabase
    .from("social_posts")
    .select("id, network, text, published_at, external_id, author, url, engagement, topics, classified_by")
    .eq("organization_id", organizationId)
    .gte("published_at", since)
    .order("published_at", { ascending: false })
    .limit(40);
  const need = ((data ?? []) as SocialPost[])
    .filter((p) => p.topics.length === 0 || p.classified_by === "lexico")
    .slice(0, 12);
  const patched = new Map<string, RadarCandidate>();
  if (!need.length) return patched;

  const classified = await classifyWithBudget(
    need.map((p) => ({
      network: p.network,
      text: p.text,
      published_at: p.published_at,
      author: p.author,
      url: p.url,
      engagement: p.engagement,
      external_id: p.external_id,
    })),
    trackers,
    organizationId,
  );

  for (let i = 0; i < need.length; i += 1) {
    const row = classified[i];
    if (!row) continue;
    patched.set(need[i].id, row);
    await supabase
      .from("social_posts")
      .update({
        sentiment: row.sentiment,
        label: row.label,
        emotion: row.emotion,
        topics: row.topics,
        classified_by: row.classified_by,
      })
      .eq("id", need[i].id)
      .eq("organization_id", organizationId);
  }
  return patched;
}

export async function persistMissingTopics(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  posts: SocialPost[],
  trackers: SocialTracker[],
) {
  const out = posts.map((p) => {
    if (p.topics.length) return p;
    const local = classifyText(p.text, trackers);
    return {
      ...p,
      topics: local.topics,
      sentiment: local.sentiment,
      label: local.label,
      emotion: local.emotion,
      classified_by: "lexico",
    };
  });
  const changed = out.filter((p, i) => p.topics.length > 0 && posts[i].topics.length === 0);
  await Promise.all(
    changed.map((p) =>
      supabase
        .from("social_posts")
        .update({
          topics: p.topics,
          sentiment: p.sentiment,
          label: p.label,
          emotion: p.emotion,
          classified_by: "lexico",
        })
        .eq("id", p.id)
        .eq("organization_id", organizationId),
    ),
  );
  return out;
}

async function ensureDefaults(supabase: Awaited<ReturnType<typeof createClient>>, organizationId: string) {
  const [{ data: sources }, { data: trackers }] = await Promise.all([
    supabase.from("social_sources").select("id, name").eq("organization_id", organizationId),
    supabase.from("social_trackers").select("id, name").eq("organization_id", organizationId),
  ]);

  if (!(sources ?? []).some((s) => s.name === DEFAULT_NEWS_NAME)) {
    await supabase.from("social_sources").insert({
      organization_id: organizationId,
      kind: "noticias",
      name: DEFAULT_NEWS_NAME,
      query: DEFAULT_NEWS_QUERY,
      is_active: true,
    });
  }

  const have = new Set((trackers ?? []).map((t) => t.name));
  for (const t of DEFAULT_TRACKERS) {
    if (have.has(t.name)) continue;
    await supabase.from("social_trackers").insert({
      organization_id: organizationId,
      name: t.name,
      keywords: t.keywords,
      exclude: [],
      is_active: true,
    });
  }
}

async function pullSource(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organizationId: string,
  source: SocialSource,
  trackers: SocialTracker[],
) {
  const feed =
    source.kind === "rss"
      ? source.url
      : googleNewsRssUrl(source.query || DEFAULT_NEWS_QUERY);
  if (!feed) throw new Error(`La fuente «${source.name}» no tiene dirección ni búsqueda.`);

  const raw = (await fetchRss(feed)).slice(0, 40);
  const result = await insertFresh(supabase, organizationId, raw, trackers);
  await supabase
    .from("social_sources")
    .update({ last_fetched_at: new Date().toISOString(), last_error: null })
    .eq("id", source.id)
    .eq("organization_id", organizationId);
  await logImport(supabase, organizationId, {
    sourceId: source.id,
    mode: source.kind,
    inserted: result.inserted,
    duplicates: result.duplicates,
  });
  return result;
}

function searchQueries(
  organizationName: string,
  trackers: SocialTracker[],
  sources: SocialSource[],
  extra?: string | null,
) {
  const focused = extra?.replace(/\s+/g, " ").trim();
  const queries = [
    focused ? `"${focused}" San Juan Argentina ${LOCAL_SITES} when:30d` : null,
    focused ? `"${focused}" "${organizationName}" when:30d` : null,
    DEFAULT_NEWS_QUERY,
    `"${organizationName}" (obra OR plaza OR concejo OR intendente) when:30d`,
    `"intendente de San Juan" Argentina -Chile -Perú when:30d`,
    `"Ciudad de San Juan" (municipalidad OR capital) ${LOCAL_SITES} when:30d`,
    ...trackers.slice(0, 2).map((t) => `"Ciudad de San Juan" ${t.keywords[0] ?? t.name} when:30d`),
    ...sources.filter((s) => s.kind === "noticias" && s.query).map((s) => `${s.query} when:30d`),
  ].filter((q): q is string => Boolean(q));
  const seen = new Set<string>();
  return queries
    .map((q) => q.replace(/\s+/g, " ").trim())
    .filter((q) => {
      const key = q.toLowerCase();
      if (seen.has(key) || q.length < 4) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 6);
}

async function collectRadarRaw(
  supabase: Awaited<ReturnType<typeof createClient>>,
  organization: { id: string; name: string },
  extra?: string | null,
) {
  await ensureDefaults(supabase, organization.id);
  const [{ data: sourceRows }, trackers] = await Promise.all([
    supabase.from("social_sources").select("*").eq("organization_id", organization.id).eq("is_active", true),
    trackersOf(supabase, organization.id),
  ]);
  const sources = (sourceRows ?? []) as SocialSource[];
  const queries = searchQueries(organization.name, trackers, sources, extra);

  const batches = await Promise.all(
    queries.map(async (query) => {
      try {
        return await fetchRss(googleNewsRssUrl(query));
      } catch {
        return [] as RawPost[];
      }
    }),
  );
  const rssSources = sources.filter((s) => s.kind === "rss" && s.url);
  const rssBatches = await Promise.all(
    rssSources.map(async (s) => {
      try {
        return await fetchRss(s.url as string);
      } catch {
        return [] as RawPost[];
      }
    }),
  );

  const meta = isMetaConfigured() ? await fetchMetaListen().catch(() => [] as RawPost[]) : [];
  const raw = [
    ...[...batches, ...rssBatches]
      .flat()
      .filter((p) => isRecentNews(p.published_at) && looksLikeLocalNews(p.text, organization.name, p.author)),
    ...meta,
  ].slice(0, 120);

  return { sources, trackers, raw };
}

/** Busca en internet y muestra las notas. No las guarda hasta que se pulse Guardar. */
export async function scanRadarAction(query?: string | null): Promise<SocialActionState> {
  const { organization } = await requireOrganization(["org_admin"]);
  const supabase = await createClient();

  try {
    const { trackers, raw } = await collectRadarRaw(supabase, organization, query);
    if (!raw.length) {
      return {
        error: query?.trim()
          ? `No se encontraron notas para «${query.trim()}».`
          : "No se encontraron notas ahora. Probá otra búsqueda o de nuevo en un minuto.",
      };
    }

    const classified = uniqueStories(await classifyWithBudget(raw, trackers, organization.id));
    const keys = await storedKeys(supabase, organization.id);
    const fresh = onlyFresh(classified, keys);
    await retagRecent(supabase, organization.id, trackers);
    const shown = (fresh.length ? fresh : classified).slice(0, 8);
    const count = fresh.length || classified.length;
    return {
      ok: `${count} ${count === 1 ? "nota" : "notas"}`,
      headlines: shown.map((p) => cleanHeadline(p.text)),
      candidates: fresh,
      inserted: 0,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "No se pudo buscar en internet.";
    return { error: message };
  }
}

export async function saveRadarAction(candidates: RadarCandidate[]): Promise<SocialActionState> {
  const { organization } = await requireOrganization(["org_admin"]);
  const supabase = await createClient();
  const clean: RadarCandidate[] = candidates
    .filter((p) => p.text?.trim().length >= 8 && isRecentNews(p.published_at || new Date().toISOString()))
    .slice(0, 120)
    .map((p) => ({
      network: p.network,
      external_id: p.external_id ?? null,
      author: p.author ?? null,
      url: p.url ?? null,
      text: cleanHeadline(p.text).slice(0, 2000),
      published_at: p.published_at || new Date().toISOString(),
      engagement: Math.max(0, Number(p.engagement) || 0),
      sentiment: Number(p.sentiment) || 0,
      label: p.label === "positivo" || p.label === "negativo" ? p.label : "neutral",
      emotion: p.emotion ?? null,
      topics: Array.isArray(p.topics) ? p.topics.slice(0, 8) : [],
      classified_by: p.classified_by || "lexico",
    }));

  if (!clean.length) return { error: "No hay notas nuevas para guardar." };

  try {
    const result = await persistClassified(supabase, organization.id, clean);
    const now = new Date().toISOString();
    await supabase
      .from("social_sources")
      .update({ last_fetched_at: now, last_error: null })
      .eq("organization_id", organization.id)
      .eq("is_active", true);
    await logImport(supabase, organization.id, {
      mode: "internet",
      inserted: result.inserted,
      duplicates: result.duplicates,
    });
    revalidatePath("/cliente/redes");
    revalidatePath("/cliente");
    const n = result.inserted;
    return {
      ok: n ? `${n} ${n === 1 ? "nota" : "notas"}` : "Estas notas ya estaban guardadas.",
      headlines: result.headlines,
      inserted: n,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "No se pudieron guardar las notas.";
    await logImport(supabase, organization.id, { mode: "internet", inserted: 0, duplicates: 0, error: message });
    return { error: message };
  }
}

/** Compatibilidad: busca y guarda en un solo paso. */
export async function listenNowAction(query?: string | null): Promise<SocialActionState> {
  const scanned = await scanRadarAction(query);
  if (scanned.error || !scanned.candidates?.length) return scanned;
  return saveRadarAction(scanned.candidates);
}

/** Lee la Página de Facebook y el Instagram profesional conectados por Graph API. */
export async function listenMetaAction(): Promise<SocialActionState> {
  const { organization } = await requireOrganization(["org_admin"]);
  if (!isMetaConfigured()) {
    return {
      error:
        "Instagram y Facebook no se pueden recorrer como un diario. Pegá los comentarios acá abajo, o conectá la Página oficial de Meta en el servidor.",
    };
  }
  const supabase = await createClient();
  try {
    const raw = await fetchMetaListen();
    if (!raw.length) {
      await logImport(supabase, organization.id, { mode: "meta", inserted: 0, duplicates: 0, error: "Meta no devolvió publicaciones." });
      return { error: "La Página no trajo posts ni comentarios ahora." };
    }
    const trackers = await trackersOf(supabase, organization.id);
    const result = await insertFresh(supabase, organization.id, raw, trackers);
    await logImport(supabase, organization.id, { mode: "meta", inserted: result.inserted, duplicates: result.duplicates });
    revalidatePath("/cliente/redes");
    revalidatePath("/cliente");
    return {
      ok:
        result.inserted > 0
          ? `Se guardaron ${result.inserted} publicaciones de Facebook e Instagram.`
          : "Ya tenías estas publicaciones de Facebook e Instagram.",
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "No se pudo leer Facebook e Instagram.";
    await logImport(supabase, organization.id, { mode: "meta", inserted: 0, duplicates: 0, error: message });
    return { error: message };
  }
}

export async function importSocialAction(_prev: SocialActionState, formData: FormData): Promise<SocialActionState> {
  const { organization } = await requireOrganization(["org_admin"]);
  const mode = String(formData.get("mode") ?? "csv");

  let raw: RawPost[] = [];
  let skipped = 0;
  try {
    if (mode === "rss") {
      raw = await fetchRss(String(formData.get("rss_url") ?? ""));
    } else if (mode === "pegar") {
      raw = parsePasted(String(formData.get("pasted") ?? ""), normalizeNetwork(String(formData.get("network") ?? "otros")));
      raw = await enrichRawPosts(raw);
    } else {
      const file = formData.get("file");
      if (file instanceof File && file.size > 5_000_000) throw new Error("El archivo supera los 5 MB.");
      const text = file instanceof File && file.size > 0 ? await file.text() : String(formData.get("csv") ?? "");
      const parsed = parseCsv(text);
      raw = await enrichRawPosts(parsed.posts);
      skipped = parsed.skipped;
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo leer la fuente." };
  }

  raw = raw.filter((p) => p.text.trim().length >= 3);
  if (!raw.length) {
    return {
      error:
        mode === "pegar"
          ? "Instagram y Facebook no dejan leer el post solo con el link. Pegá el texto de cada comentario, uno por línea."
          : "No se encontraron publicaciones para guardar.",
    };
  }
  if (raw.length > MAX_IMPORT) return { error: `Son ${raw.length} publicaciones: importá de a ${MAX_IMPORT} como máximo.` };

  const supabase = await createClient();
  try {
    const trackers = await trackersOf(supabase, organization.id);
    const result = await insertFresh(supabase, organization.id, raw, trackers);
    await logImport(supabase, organization.id, {
      mode,
      inserted: result.inserted,
      duplicates: result.duplicates,
    });
    if (mode === "rss") {
      const url = String(formData.get("rss_url") ?? "").trim();
      if (url) {
        const host = (() => {
          try {
            return new URL(url).hostname.replace(/^www\./, "");
          } catch {
            return "Feed RSS";
          }
        })();
        await supabase.from("social_sources").upsert(
          {
            organization_id: organization.id,
            kind: "rss",
            name: `RSS · ${host}`,
            url,
            is_active: true,
            last_fetched_at: new Date().toISOString(),
            last_error: null,
          },
          { onConflict: "organization_id,name" },
        );
      }
    }
    revalidatePath("/cliente/redes");
    revalidatePath("/cliente");
    return {
      ok: `${result.inserted} publicaciones guardadas${result.duplicates ? ` · ${result.duplicates} duplicadas` : ""}${skipped ? ` · ${skipped} filas vacías` : ""}.`,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "No se pudieron guardar las publicaciones.";
    await logImport(supabase, organization.id, { mode, inserted: 0, duplicates: 0, error: message });
    return { error: message };
  }
}

export async function createSourceAction(_prev: SocialActionState, formData: FormData): Promise<SocialActionState> {
  const { organization } = await requireOrganization(["org_admin"]);
  const kind = String(formData.get("kind") ?? "noticias") === "rss" ? "rss" : "noticias";
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  const query = String(formData.get("query") ?? "").trim().slice(0, 200) || null;
  const url = String(formData.get("url") ?? "").trim() || null;

  if (name.length < 3) return { error: "Poné un nombre de al menos 3 letras." };
  if (kind === "noticias" && !query) return { error: "Escribí qué buscar en noticias (por ejemplo, Municipalidad San Juan)." };
  if (kind === "rss" && !url) return { error: "Pegá la dirección del feed RSS." };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("social_sources")
    .insert({
      organization_id: organization.id,
      kind,
      name,
      query: kind === "noticias" ? query : null,
      url: kind === "rss" ? url : null,
      is_active: true,
    })
    .select("*")
    .single();
  if (error || !data) return { error: `No se pudo guardar la fuente: ${error?.message}` };

  try {
    const trackers = await trackersOf(supabase, organization.id);
    const result = await pullSource(supabase, organization.id, data as SocialSource, trackers);
    revalidatePath("/cliente/redes");
    return { ok: `Fuente guardada. ${result.inserted} publicaciones nuevas.` };
  } catch (e) {
    revalidatePath("/cliente/redes");
    return { error: e instanceof Error ? e.message : "La fuente se guardó, pero no se pudo leer ahora." };
  }
}

export async function createTrackerAction(_prev: SocialActionState, formData: FormData): Promise<SocialActionState> {
  const { organization } = await requireOrganization(["org_admin"]);
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  const split = (key: string) =>
    String(formData.get(key) ?? "")
      .split(/[,\n]/)
      .map((k) => k.trim().toLowerCase())
      .filter((k) => k.length >= 3)
      .slice(0, 30);
  const keywords = split("keywords");
  const exclude = split("exclude");

  if (name.length < 3) return { error: "Poné un nombre de al menos 3 letras." };
  if (!keywords.length) return { error: "Agregá al menos una palabra clave (separadas por coma)." };

  const supabase = await createClient();
  const { error } = await supabase.from("social_trackers").insert({ organization_id: organization.id, name, keywords, exclude, is_active: true });
  if (error) return { error: `No se pudo guardar el tema: ${error.message}` };

  const posts = await fetchAll<Pick<SocialPost, "id" | "text" | "topics">>((from, to) =>
    supabase.from("social_posts").select("id, text, topics").eq("organization_id", organization.id).order("id").range(from, to),
  );
  let tagged = 0;
  for (const p of posts) {
    const { topics } = classifyText(p.text, [{ name, keywords, exclude }]);
    if (topics.includes(name) && !p.topics.includes(name)) {
      await supabase.from("social_posts").update({ topics: [...p.topics, name] }).eq("id", p.id);
      tagged += 1;
    }
  }

  revalidatePath("/cliente/redes");
  return { ok: `Tema «${name}» guardado. ${tagged} publicaciones existentes quedaron etiquetadas.` };
}

export async function deleteTrackerAction(formData: FormData) {
  const { organization } = await requireOrganization(["org_admin"]);
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  await supabase.from("social_trackers").delete().eq("id", id).eq("organization_id", organization.id);
  revalidatePath("/cliente/redes");
}

export async function deleteSourceAction(formData: FormData) {
  const { organization } = await requireOrganization(["org_admin"]);
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  await supabase.from("social_sources").delete().eq("id", id).eq("organization_id", organization.id);
  revalidatePath("/cliente/redes");
}

export async function reclassifyAction(_prev: SocialActionState, _formData: FormData): Promise<SocialActionState> {
  const { organization } = await requireOrganization(["org_admin"]);
  const supabase = await createClient();
  const { data } = await supabase
    .from("social_posts")
    .select("*")
    .eq("organization_id", organization.id)
    .eq("classified_by", "lexico")
    .order("published_at", { ascending: false })
    .limit(400);
  const posts = (data ?? []) as SocialPost[];
  if (!posts.length) return { ok: "No hay publicaciones pendientes de reclasificar." };

  const trackers = await trackersOf(supabase, organization.id);
  const result = await classifyPosts(
    posts.map((p) => ({ network: p.network, text: p.text, published_at: p.published_at, external_id: p.external_id })),
    trackers,
    organization.id,
  );
  let changed = 0;
  for (const [i, r] of result.entries()) {
    if (r.classified_by === "lexico") continue;
    await supabase
      .from("social_posts")
      .update({ sentiment: r.sentiment, label: r.label, emotion: r.emotion, topics: r.topics, classified_by: r.classified_by })
      .eq("id", posts[i].id);
    changed += 1;
  }
  await logImport(supabase, organization.id, { mode: "reclasificar", inserted: changed, duplicates: 0 });
  revalidatePath("/cliente/redes");
  return { ok: `${changed} publicaciones actualizadas y guardadas.` };
}

export async function analyzeRadarAction(_prev: SocialActionState, formData: FormData): Promise<SocialActionState> {
  const { organization, profile } = await requireOrganization(["org_admin", "org_analyst"]);
  const useLocalWriter = !isGeminiConfigured() && isDemoMode();
  if (!isGeminiConfigured() && !useLocalWriter) {
    return { error: "Falta la capa de IA. Cargá las claves de JEV o Gemini en Supabase." };
  }

  const requested = [1, 7, 30].includes(Number(formData.get("dias"))) ? Number(formData.get("dias")) : 30;
  const supabase = await createClient();
  const today = todayKey();
  const since = `${addDays(today, -30)}T00:00:00-03:00`;
  const posts = await fetchAll<SocialPost>((from, to) =>
    supabase
      .from("social_posts")
      .select("*")
      .eq("organization_id", organization.id)
      .gte("published_at", new Date(since).toISOString())
      .order("published_at", { ascending: false })
      .order("id")
      .range(from, to),
  );
  const trackers = await trackersOf(supabase, organization.id);
  const tagged = await persistMissingTopics(supabase, organization.id, posts, trackers);

  let days = requested;
  let social = computeSocial(tagged, { days }, today);
  if (social.total < 5 && days < 30) {
    days = 30;
    social = computeSocial(tagged, { days }, today);
  }
  if (social.total < 3) {
    return { error: "Hace falta unas cuantas notas para armar un informe. Encendé el radar y guardalas." };
  }

  const period = days === 1 ? "hoy" : days === 7 ? "la semana" : "el mes";
  const { data: report, error: insertError } = await supabase
    .from("ai_reports")
    .insert({
      survey_id: null,
      organization_id: organization.id,
      title: `Radar · ${period}`,
      kind: "ejecutivo",
      status: "generando",
      audience: "Equipo de comunicación y gestión",
      focus: `radar:${days}`,
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (insertError || !report) {
    return { error: `No se pudo iniciar el informe: ${insertError?.message}` };
  }

  try {
    const generated = useLocalWriter
      ? buildLocalRadarReport({ social, organizationName: organization.name })
      : await generateRadarReport({
          social,
          organizationName: organization.name,
          organizationId: organization.id,
          focus: `Informe del radar de conversación de ${period}. No es una encuesta: leé solo las notas públicas.`,
        });

    await supabase
      .from("ai_reports")
      .update({
        title: generated.title,
        content: generated.markdown,
        highlights: generated.highlights,
        model: generated.model,
        status: "listo",
      })
      .eq("id", report.id);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Error desconocido del modelo.";
    await supabase.from("ai_reports").update({ status: "error", error_message: message }).eq("id", report.id);
    return { error: `La IA no pudo armar el informe: ${message}` };
  }

  revalidatePath("/cliente/informes");
  revalidatePath("/cliente/redes");
  redirect(`/cliente/informes/${report.id}`);
}
