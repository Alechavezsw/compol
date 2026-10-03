import "server-only";
import { createHash } from "node:crypto";
import type { SocialNetwork } from "@/lib/types";

const GRAPH = "https://graph.facebook.com/v21.0";

export type MetaPost = {
  network: Extract<SocialNetwork, "facebook" | "instagram">;
  text: string;
  published_at: string;
  author: string | null;
  url: string | null;
  external_id: string;
};

function pageToken() {
  return process.env.META_PAGE_ACCESS_TOKEN?.trim() || "";
}

function appToken() {
  const id = process.env.META_APP_ID?.trim();
  const secret = process.env.META_APP_SECRET?.trim();
  if (id && secret) return `${id}|${secret}`;
  return pageToken();
}

export function isMetaConfigured() {
  return Boolean(pageToken() && (process.env.META_PAGE_ID?.trim() || process.env.META_INSTAGRAM_ID?.trim()));
}

export function isMetaUrl(url: string) {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return /instagram\.com|facebook\.com|fb\.com|fb\.watch/.test(host);
  } catch {
    return false;
  }
}

function alias(raw: string | undefined | null) {
  const v = (raw ?? "").trim();
  if (!v) return null;
  if (/^(municipalidad|ciudad de san juan|página oficial)/i.test(v)) return v.slice(0, 60);
  return `usuario-${createHash("sha256").update(v.toLowerCase()).digest("hex").slice(0, 6)}`;
}

async function graph<T>(path: string, token: string): Promise<T> {
  const joiner = path.includes("?") ? "&" : "?";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${GRAPH}${path}${joiner}access_token=${encodeURIComponent(token)}`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    const json = (await res.json()) as T & { error?: { message?: string } };
    if (!res.ok) throw new Error(json.error?.message || `Meta respondió ${res.status}.`);
    return json;
  } finally {
    clearTimeout(timer);
  }
}

/** Título público de un post pegado (oEmbed oficial). Sin token no hay lectura. */
export async function fetchMetaOEmbed(url: string) {
  const token = appToken();
  if (!token || !isMetaUrl(url)) return null;
  const endpoint = /instagram/.test(url) ? "instagram_oembed" : "oembed_post";
  try {
    const data = await graph<{ author_name?: string; title?: string; html?: string }>(
      `/${endpoint}?url=${encodeURIComponent(url)}&omitscript=true`,
      token,
    );
    const fromHtml = data.html?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() ?? "";
    const title = (data.title || fromHtml).slice(0, 400);
    if (!title) return null;
    return { title, author: data.author_name?.slice(0, 80) ?? null };
  } catch {
    return null;
  }
}

type FbComment = { id: string; message?: string; created_time?: string; permalink_url?: string; from?: { name?: string } };
type FbPost = {
  id: string;
  message?: string;
  created_time?: string;
  permalink_url?: string;
  from?: { name?: string };
  comments?: { data?: FbComment[] };
};
type IgComment = { id: string; text?: string; timestamp?: string; username?: string };
type IgMedia = {
  id: string;
  caption?: string;
  timestamp?: string;
  permalink?: string;
  comments?: { data?: IgComment[] };
};

async function facebookPage(pageId: string, token: string): Promise<MetaPost[]> {
  const data = await graph<{ data?: FbPost[] }>(
    `/${pageId}/feed?fields=id,message,created_time,permalink_url,from,comments.limit(20){id,message,created_time,permalink_url,from}&limit=25`,
    token,
  );
  const out: MetaPost[] = [];
  for (const post of data.data ?? []) {
    if (post.message?.trim()) {
      out.push({
        network: "facebook",
        text: post.message.slice(0, 2000),
        published_at: post.created_time || new Date().toISOString(),
        author: alias(post.from?.name) ?? "Página",
        url: post.permalink_url ?? null,
        external_id: post.id,
      });
    }
    for (const c of post.comments?.data ?? []) {
      if (!c.message?.trim()) continue;
      out.push({
        network: "facebook",
        text: c.message.slice(0, 2000),
        published_at: c.created_time || post.created_time || new Date().toISOString(),
        author: alias(c.from?.name),
        url: c.permalink_url ?? post.permalink_url ?? null,
        external_id: c.id,
      });
    }
  }
  return out;
}

async function instagramAccount(igId: string, token: string): Promise<MetaPost[]> {
  const data = await graph<{ data?: IgMedia[] }>(
    `/${igId}/media?fields=id,caption,timestamp,permalink,comments.limit(20){id,text,timestamp,username}&limit=25`,
    token,
  );
  const out: MetaPost[] = [];
  for (const media of data.data ?? []) {
    if (media.caption?.trim()) {
      out.push({
        network: "instagram",
        text: media.caption.slice(0, 2000),
        published_at: media.timestamp || new Date().toISOString(),
        author: "Cuenta oficial",
        url: media.permalink ?? null,
        external_id: media.id,
      });
    }
    for (const c of media.comments?.data ?? []) {
      if (!c.text?.trim()) continue;
      out.push({
        network: "instagram",
        text: c.text.slice(0, 2000),
        published_at: c.timestamp || media.timestamp || new Date().toISOString(),
        author: alias(c.username),
        url: media.permalink ?? null,
        external_id: c.id,
      });
    }
  }
  return out;
}

/** Posts y comentarios de la Página / Instagram profesional conectados. */
export async function fetchMetaListen(): Promise<MetaPost[]> {
  const token = pageToken();
  if (!token) return [];
  const pageId = process.env.META_PAGE_ID?.trim();
  const igId = process.env.META_INSTAGRAM_ID?.trim();
  const batches = await Promise.all([
    pageId ? facebookPage(pageId, token).catch(() => [] as MetaPost[]) : Promise.resolve([]),
    igId ? instagramAccount(igId, token).catch(() => [] as MetaPost[]) : Promise.resolve([]),
  ]);
  return batches.flat();
}
