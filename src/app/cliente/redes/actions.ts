"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrganization } from "@/lib/auth";
import { fetchAll } from "@/lib/supabase/fetch-all";
import { isGeminiConfigured } from "@/lib/ai/gemini";
import { classifyPosts, fetchRss, normalizeNetwork, parseCsv, parsePasted, type RawPost } from "@/lib/social/ingest";
import { classifyText } from "@/lib/social/lexicon";
import type { SocialPost, SocialTracker } from "@/lib/types";

export type SocialActionState = { error?: string | null; ok?: string | null };

const MAX_IMPORT = 3000;

async function trackersOf(supabase: Awaited<ReturnType<typeof createClient>>, organizationId: string) {
  const { data } = await supabase.from("social_trackers").select("*").eq("organization_id", organizationId).eq("is_active", true);
  return (data ?? []) as SocialTracker[];
}

/** Importa publicaciones desde CSV, texto pegado o un feed RSS, las clasifica y descarta duplicados. */
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
    } else {
      const file = formData.get("file");
      if (file instanceof File && file.size > 5_000_000) throw new Error("El archivo supera los 5 MB.");
      const text = file instanceof File && file.size > 0 ? await file.text() : String(formData.get("csv") ?? "");
      const parsed = parseCsv(text);
      raw = parsed.posts;
      skipped = parsed.skipped;
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo leer la fuente." };
  }

  if (!raw.length) return { error: "No se encontraron publicaciones para importar." };
  if (raw.length > MAX_IMPORT) return { error: `Son ${raw.length} publicaciones: importá de a ${MAX_IMPORT} como máximo.` };

  const supabase = await createClient();
  const trackers = await trackersOf(supabase, organization.id);
  const classified = await classifyPosts(raw, trackers);

  // Duplicados: misma red + mismo id externo (url o huella del texto).
  const existing = new Set(
    (
      await fetchAll<{ network: string; external_id: string | null }>((from, to) =>
        supabase.from("social_posts").select("network, external_id").eq("organization_id", organization.id).order("id").range(from, to),
      )
    ).map((p) => `${p.network}|${p.external_id}`),
  );
  const fresh = classified.filter((p) => {
    const key = `${p.network}|${p.external_id}`;
    if (existing.has(key)) return false;
    existing.add(key);
    return true;
  });

  if (fresh.length) {
    for (let i = 0; i < fresh.length; i += 500) {
      const { error } = await supabase
        .from("social_posts")
        .insert(fresh.slice(i, i + 500).map((p) => ({ ...p, organization_id: organization.id })));
      if (error) return { error: `Se importaron ${i} publicaciones y falló el resto: ${error.message}` };
    }
  }

  revalidatePath("/cliente/redes");
  const by = fresh.some((p) => p.classified_by === "gemini") ? "Gemini" : "el léxico local";
  const dupes = classified.length - fresh.length;
  return {
    ok: `${fresh.length} publicaciones nuevas clasificadas con ${by}${dupes ? ` · ${dupes} duplicadas omitidas` : ""}${skipped ? ` · ${skipped} filas vacías` : ""}.`,
  };
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
  if (error) return { error: `No se pudo crear el tema: ${error.message}` };

  // Etiquetar lo ya importado con el tema nuevo: no hace falta volver a clasificar el sentimiento.
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
  return { ok: `Tema «${name}» creado. ${tagged} publicaciones existentes quedaron etiquetadas.` };
}

export async function deleteTrackerAction(formData: FormData) {
  const { organization } = await requireOrganization(["org_admin"]);
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  await supabase.from("social_trackers").delete().eq("id", id).eq("organization_id", organization.id);
  revalidatePath("/cliente/redes");
}

/** Vuelve a clasificar con Gemini lo que entró con el léxico. */
export async function reclassifyAction(_prev: SocialActionState, _formData: FormData): Promise<SocialActionState> {
  const { organization } = await requireOrganization(["org_admin"]);
  if (!isGeminiConfigured()) return { error: "Hace falta GEMINI_API_KEY para reclasificar con el modelo." };

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
  );
  let changed = 0;
  for (const [i, r] of result.entries()) {
    if (r.classified_by !== "gemini") continue;
    await supabase
      .from("social_posts")
      .update({ sentiment: r.sentiment, label: r.label, emotion: r.emotion, topics: r.topics, classified_by: "gemini" })
      .eq("id", posts[i].id);
    changed += 1;
  }
  revalidatePath("/cliente/redes");
  return { ok: `${changed} publicaciones reclasificadas con Gemini.` };
}
