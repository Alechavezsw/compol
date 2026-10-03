import "server-only";
import { createHash } from "node:crypto";
import { classifySocialBatch, hasLocalGeminiKey } from "@/lib/ai/gemini";
import { classifySocialBatchTypesafe, hasLocalTypesafeKey } from "@/lib/ai/typesafe";
import { classifyViaGateway, isAiGatewayConfigured } from "@/lib/ai/gateway";
import { cleanHeadline } from "@/lib/social/headline";
import { fetchMetaOEmbed, isMetaUrl } from "@/lib/social/meta";
import { DEFAULT_TOPICS, classifyText } from "@/lib/social/lexicon";
import type { Emotion, SentimentLabel, SocialNetwork, SocialPost, SocialTracker } from "@/lib/types";

export type RawPost = {
  network: SocialNetwork;
  text: string;
  published_at: string;
  author?: string | null;
  url?: string | null;
  engagement?: number;
  external_id?: string | null;
};

const NETWORKS: SocialNetwork[] = ["x", "facebook", "instagram", "tiktok", "youtube", "noticias", "otros"];

export function normalizeNetwork(raw: string | undefined | null): SocialNetwork {
  const v = (raw ?? "").toLowerCase().trim();
  if (/twitter|^x$|x\.com/.test(v)) return "x";
  if (/face|fb/.test(v)) return "facebook";
  if (/insta|ig/.test(v)) return "instagram";
  if (/tik/.test(v)) return "tiktok";
  if (/you|yt/.test(v)) return "youtube";
  if (/noticia|diario|portal|news|web|medio/.test(v)) return "noticias";
  return NETWORKS.includes(v as SocialNetwork) ? (v as SocialNetwork) : "otros";
}

function parseDate(raw: string | undefined) {
  if (!raw) return new Date().toISOString();
  const trimmed = raw.trim();
  // 13/09/2026 o 13/09/2026 14:30 (formato argentino).
  const ar = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})(?:\s+(\d{1,2}):(\d{2}))?/.exec(trimmed);
  if (ar) {
    const year = ar[3].length === 2 ? `20${ar[3]}` : ar[3];
    const d = new Date(`${year}-${ar[2].padStart(2, "0")}-${ar[1].padStart(2, "0")}T${(ar[4] ?? "12").padStart(2, "0")}:${ar[5] ?? "00"}:00-03:00`);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/** CSV con encabezados flexibles: acepta exportaciones de distintas herramientas. */
export function parseCsv(input: string): { posts: RawPost[]; skipped: number } {
  const text = input.replace(/^﻿/, "").trim();
  if (!text) return { posts: [], skipped: 0 };
  const firstLine = text.split(/\r?\n/, 1)[0];
  const delimiter = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";

  // Parser de CSV con comillas: los textos de redes traen comas y saltos de línea.
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  row.push(cell);
  rows.push(row);

  const header = rows[0].map((h) => h.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim());
  const col = (...names: string[]) => header.findIndex((h) => names.some((n) => h === n || h.includes(n)));
  const idx = {
    text: col("texto", "text", "mensaje", "contenido", "message", "comentario", "post"),
    date: col("fecha", "date", "publicad", "created"),
    network: col("red", "network", "plataforma", "fuente", "source"),
    author: col("autor", "author", "usuario", "user", "cuenta"),
    url: col("url", "link", "enlace"),
    engagement: col("interacciones", "engagement", "likes", "reacciones", "me gusta"),
  };
  if (idx.text < 0) throw new Error("El CSV necesita una columna de texto (texto, mensaje o contenido).");

  const posts: RawPost[] = [];
  let skipped = 0;
  for (const r of rows.slice(1)) {
    const body = (r[idx.text] ?? "").trim();
    if (body.length < 3) {
      skipped += 1;
      continue;
    }
    posts.push({
      text: body.slice(0, 2000),
      published_at: parseDate(idx.date >= 0 ? r[idx.date] : undefined),
      network: normalizeNetwork(idx.network >= 0 ? r[idx.network] : undefined),
      author: idx.author >= 0 ? anonymizeAuthor(r[idx.author]) : null,
      url: idx.url >= 0 ? safeUrl(r[idx.url]) : null,
      engagement: idx.engagement >= 0 ? Math.max(0, Math.round(Number(String(r[idx.engagement]).replace(/\D/g, "")) || 0)) : 0,
    });
  }
  return { posts, skipped };
}

/** Una publicación por línea, para pegar comentarios sueltos. */
export function parsePasted(input: string, network: SocialNetwork): RawPost[] {
  return input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length >= 3)
    .slice(0, 2000)
    .map((text) => ({ text: text.slice(0, 2000), network, published_at: new Date().toISOString() }));
}

function safeUrl(raw: string | undefined) {
  try {
    const u = new URL((raw ?? "").trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString().slice(0, 500) : null;
  } catch {
    return null;
  }
}

/** Alias corto en vez del usuario real: alcanza para leer, no para perfilar a nadie. */
function anonymizeAuthor(raw: string | undefined) {
  const v = (raw ?? "").trim();
  if (!v) return null;
  if (/^(municipalidad|diario|radio|canal|noticias)/i.test(v)) return v.slice(0, 60);
  return `usuario-${createHash("sha256").update(v.toLowerCase()).digest("hex").slice(0, 6)}`;
}

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/<[^>]+>/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Lee un feed RSS o Atom (portales de noticias, Google Alertas). */
export async function fetchRss(url: string): Promise<RawPost[]> {
  const target = safeUrl(url);
  if (!target) throw new Error("La dirección del feed no es válida.");
  const host = new URL(target).hostname;
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host)) throw new Error("No se permiten direcciones internas.");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  let xml: string;
  try {
    const res = await fetch(target, { signal: controller.signal, headers: { "User-Agent": "ConsultaBot/1.0 (+escucha social)" } });
    if (!res.ok) throw new Error(`El feed respondió ${res.status}.`);
    xml = (await res.text()).slice(0, 2_000_000);
  } finally {
    clearTimeout(timer);
  }

  const items = xml.match(/<(item|entry)\b[\s\S]*?<\/(item|entry)>/gi) ?? [];
  return items.slice(0, 200).map((item) => {
    const pick = (tag: string) => decode(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i").exec(item)?.[1] ?? "");
    const link = pick("link") || /<link[^>]*href="([^"]+)"/i.exec(item)?.[1] || null;
    const title = pick("title");
    return {
      network: "noticias" as const,
      text: cleanHeadline(title),
      published_at: parseDate(pick("pubDate") || pick("published") || pick("updated")),
      author: decode(pick("source") || host),
      url: link ? safeUrl(link) : null,
      external_id: link ?? null,
    };
  }).filter((p) => p.text.length > 10);
}

export function externalId(p: RawPost) {
  return p.external_id ?? p.url ?? createHash("sha256").update(`${p.network}|${p.published_at.slice(0, 16)}|${p.text}`).digest("hex").slice(0, 32);
}

export function googleNewsRssUrl(query: string) {
  const q = query.trim() || "San Juan";
  return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=es-419&gl=AR&ceid=AR:es-419`;
}

export function extractUrl(text: string) {
  const match = /https?:\/\/[^\s<>"']+/i.exec(text.trim());
  return match ? safeUrl(match[0].replace(/[),.]+$/, "")) : null;
}

export function networkFromHost(url: string): SocialNetwork {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    if (/instagram/.test(host)) return "instagram";
    if (/facebook|fb\.com/.test(host)) return "facebook";
    if (/(^|\.)x\.com|twitter/.test(host)) return "x";
    if (/tiktok/.test(host)) return "tiktok";
    if (/youtube|youtu\.be/.test(host)) return "youtube";
    return "noticias";
  } catch {
    return "otros";
  }
}

/** Título y bajada públicos de una URL (og:tags). Sirve para links pegados. */
export async function fetchPageMeta(url: string) {
  const target = safeUrl(url);
  if (!target) return null;
  const host = new URL(target).hostname;
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(host)) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 7000);
  try {
    const res = await fetch(target, {
      signal: controller.signal,
      headers: { "User-Agent": "ConsultaBot/1.0 (+escucha social)", Accept: "text/html" },
      redirect: "follow",
    });
    if (!res.ok) return null;
    const html = (await res.text()).slice(0, 350_000);
    const attr = (prop: string) => {
      const a = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["']`, "i").exec(html);
      const b = new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["']`, "i").exec(html);
      return decode(a?.[1] ?? b?.[1] ?? "");
    };
    const title = attr("og:title") || decode(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "");
    const description = attr("og:description") || attr("description");
    const site = attr("og:site_name") || host.replace(/^www\./, "");
    if (!title || title.length < 4) return null;
    return { title: title.slice(0, 240), description: description.slice(0, 420), site: site.slice(0, 80) };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Si el texto es un link, intenta leer el título público y guardarlo como publicación. */
export async function enrichRawPosts(posts: RawPost[]): Promise<RawPost[]> {
  return Promise.all(
    posts.map(async (p) => {
      const url = p.url ?? extractUrl(p.text);
      if (!url) return p;
      const looksLikeUrl = /^https?:\/\//i.test(p.text.trim()) || Boolean(p.url);
      if (!looksLikeUrl) return { ...p, url: p.url ?? url };
      const network = networkFromHost(url);
      if (isMetaUrl(url)) {
        const oembed = await fetchMetaOEmbed(url);
        if (oembed) {
          return {
            ...p,
            url,
            text: oembed.title.slice(0, 1200),
            author: p.author ?? oembed.author,
            network,
            external_id: p.external_id ?? url,
          };
        }
        const onlyLink = /^https?:\/\/\S+$/i.test(p.text.trim());
        if (onlyLink) return { ...p, url, network, text: "", external_id: p.external_id ?? url };
      }
      const meta = await fetchPageMeta(url);
      if (!meta) return { ...p, url, network: p.network === "otros" ? network : p.network, external_id: p.external_id ?? url };
      return {
        ...p,
        url,
        text: [meta.title, meta.description].filter(Boolean).join(". ").slice(0, 1200),
        author: p.author ?? meta.site,
        network: p.network === "otros" || p.network === "facebook" ? networkFromHost(url) : p.network,
        external_id: p.external_id ?? url,
      };
    }),
  );
}

type ClassifiedPost = Omit<SocialPost, "id" | "organization_id" | "created_at">;

export function classifyPostsLocal(
  posts: RawPost[],
  trackers: Pick<SocialTracker, "name" | "keywords" | "exclude">[],
): ClassifiedPost[] {
  return posts.map((p) => {
    const local = classifyText(p.text, trackers);
    return {
      network: p.network,
      external_id: externalId(p),
      author: p.author ?? null,
      url: p.url ?? null,
      text: cleanHeadline(p.text),
      published_at: p.published_at,
      engagement: p.engagement ?? 0,
      sentiment: local.sentiment,
      label: local.label,
      emotion: local.emotion,
      topics: local.topics,
      classified_by: "lexico",
    };
  });
}

/** Aplica una fila de un clasificador externo, uniendo temas con lo que ya tenía el léxico. */
function applyExternalRow(
  target: ClassifiedPost,
  r: { sentiment: number; label: SentimentLabel; emotion: Emotion | null; topics: string[] },
  source: string,
) {
  target.sentiment = Math.round(r.sentiment * 1000) / 1000;
  target.label = r.label;
  target.emotion = r.emotion;
  // El modelo puede no ver un tema que el tracker sí marca por palabra clave: se unen.
  target.topics = [...new Set([...r.topics, ...target.topics])];
  target.classified_by = source;
}

/**
 * Clasifica con TypeSafe si hay clave (Choice/Noul, una llamada por
 * publicación); si falla o no está configurado, con Gemini (lotes de 40); si
 * tampoco, se queda con el léxico. Cada fila queda marcada con quién la
 * clasificó.
 */
export async function classifyPosts(
  posts: RawPost[],
  trackers: Pick<SocialTracker, "name" | "keywords" | "exclude">[],
  organizationId?: string,
): Promise<ClassifiedPost[]> {
  const topicNames = [...new Set([...DEFAULT_TOPICS.map((t) => t.name), ...trackers.map((t) => t.name)])];
  const out = classifyPostsLocal(posts, trackers);

  if (isAiGatewayConfigured()) {
    try {
      const rows = await classifyViaGateway(out.map((p) => p.text), topicNames, organizationId);
      rows.forEach((r, i) => {
        if (!r) return;
        const source = r.provider === "gemini" ? "gemini" : "jev";
        applyExternalRow(out[i], r, source);
      });
      return out;
    } catch {
      // Si la función Edge falla, caemos a las claves locales o al léxico.
    }
  }

  if (hasLocalTypesafeKey()) {
    try {
      const rows = await classifySocialBatchTypesafe(out.map((p) => p.text), topicNames);
      rows.forEach((r, i) => {
        if (r) applyExternalRow(out[i], r, "typesafe");
      });
    } catch {
      // Falló la corrida completa: las filas que no se pudieron tocar quedan con el léxico.
    }
  }

  if (!hasLocalGeminiKey()) return out;

  // Solo lo que TypeSafe no pudo clasificar pasa por Gemini.
  const pending = out.map((p, i) => i).filter((i) => out[i].classified_by === "lexico");
  for (let start = 0; start < pending.length; start += 40) {
    const idxBatch = pending.slice(start, start + 40);
    const batch = idxBatch.map((i) => out[i]);
    try {
      const rows = await classifySocialBatch(batch.map((p) => p.text), topicNames);
      for (const r of rows) {
        const target = batch[r.index];
        if (!target) continue;
        applyExternalRow(target, { ...r, emotion: r.emotion as Emotion | null }, "gemini");
      }
    } catch {
      // El lote queda con la clasificación del léxico.
    }
  }
  return out;
}
