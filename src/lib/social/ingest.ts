import "server-only";
import { createHash } from "node:crypto";
import { classifySocialBatch, isGeminiConfigured } from "@/lib/ai/gemini";
import { DEFAULT_TOPICS, classifyText } from "@/lib/social/lexicon";
import type { Emotion, SocialNetwork, SocialPost, SocialTracker } from "@/lib/types";

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
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
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
    const summary = pick("description") || pick("summary") || pick("content");
    return {
      network: "noticias" as const,
      text: [title, summary].filter(Boolean).join(". ").slice(0, 1200),
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

/**
 * Clasifica con Gemini si hay clave (en lotes de 40) y cae al léxico ante
 * cualquier falla. Cada fila queda marcada con quién la clasificó.
 */
export async function classifyPosts(
  posts: RawPost[],
  trackers: Pick<SocialTracker, "name" | "keywords" | "exclude">[],
): Promise<Omit<SocialPost, "id" | "organization_id" | "created_at">[]> {
  const topicNames = [...new Set([...DEFAULT_TOPICS.map((t) => t.name), ...trackers.map((t) => t.name)])];
  const out = posts.map((p) => {
    const local = classifyText(p.text, trackers);
    return {
      network: p.network,
      external_id: externalId(p),
      author: p.author ?? null,
      url: p.url ?? null,
      text: p.text,
      published_at: p.published_at,
      engagement: p.engagement ?? 0,
      sentiment: local.sentiment,
      label: local.label,
      emotion: local.emotion,
      topics: local.topics,
      classified_by: "lexico",
    };
  });

  if (!isGeminiConfigured()) return out;

  for (let start = 0; start < out.length; start += 40) {
    const batch = out.slice(start, start + 40);
    try {
      const rows = await classifySocialBatch(batch.map((p) => p.text), topicNames);
      for (const r of rows) {
        const target = batch[r.index];
        if (!target) continue;
        target.sentiment = Math.round(r.sentiment * 1000) / 1000;
        target.label = r.label;
        target.emotion = r.emotion as Emotion | null;
        // El modelo puede no ver un tema que el tracker sí marca por palabra clave: se unen.
        target.topics = [...new Set([...r.topics, ...target.topics])];
        target.classified_by = "gemini";
      }
    } catch {
      // El lote queda con la clasificación del léxico.
    }
  }
  return out;
}
