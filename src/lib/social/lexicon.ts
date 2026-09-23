// ---------------------------------------------------------------------------
// Clasificador local de publicaciones en español rioplatense.
//
// Es el respaldo cuando no hay GEMINI_API_KEY: un léxico con negación e
// intensificadores. Acierta bien en textos cortos y directos (lo típico de
// redes) y falla con ironía, que es justo lo que el modelo resuelve mejor.
// Por eso cada publicación guarda `classified_by`.
// ---------------------------------------------------------------------------

import type { Emotion, SentimentLabel, SocialTracker } from "@/lib/types";

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

// Raíces (se comparan con startsWith) y su peso.
const POSITIVE: [string, number][] = [
  ["excelente", 2], ["genial", 2], ["espectacular", 2], ["impecable", 2], ["felicit", 2], ["orgullo", 2],
  ["gracias", 1.5], ["agradec", 1.5], ["buenisim", 2], ["bueno", 1], ["buena", 1], ["bien", 1], ["mejor", 1.2],
  ["mejora", 1.2], ["lindo", 1.2], ["linda", 1.2], ["hermos", 1.5], ["contento", 1.5], ["contenta", 1.5],
  ["feliz", 1.5], ["alegr", 1.5], ["apoy", 1], ["acierto", 1.5], ["solucion", 1], ["resolvieron", 1.5],
  ["cumpl", 1.2], ["inaugur", 1], ["avanza", 1], ["por fin", 1.2], ["al fin", 1], ["recomiendo", 1.5],
  ["rapido", 0.8], ["limpi", 0.8], ["seguro", 0.8], ["segura", 0.8], ["funciona", 1], ["participar", 0.8],
  ["escuch", 0.8], ["transparen", 1], ["aplaud", 1.5], ["joya", 1.5], ["crack", 1.2], ["dale", 0.6], ["top", 1],
];

const NEGATIVE: [string, number][] = [
  ["verguenza", 2.5], ["desastre", 2.5], ["horrible", 2], ["pesim", 2], ["asco", 2], ["indignant", 2],
  ["indign", 2], ["basta", 1.5], ["harto", 2], ["harta", 2], ["cansad", 1.2], ["mal", 1.2], ["malo", 1.2],
  ["mala", 1.2], ["peor", 1.5], ["abandon", 1.8], ["olvid", 1.2], ["inseguridad", 1.5], ["robo", 1.8],
  ["robaron", 2], ["asalt", 2], ["miedo", 1.5], ["peligro", 1.5], ["corte", 1.2], ["sin agua", 2],
  ["sin luz", 2], ["baches", 1.2], ["bache", 1.2], ["pozo", 1], ["roto", 1.2], ["rota", 1.2], ["basura", 1],
  ["mugre", 1.5], ["demora", 1.2], ["mentira", 2], ["chanta", 2],
  ["inutil", 2], ["corrup", 2.5], ["queja", 1.2], ["reclam", 1], ["problema", 1], ["caos", 2], ["colaps", 2],
  ["tarifazo", 2], ["aumento", 1], ["caro", 1], ["impuesto", 0.8], ["nadie", 0.8],
  ["triste", 1.5], ["bronca", 2], ["lamentable", 2], ["desidia", 2], ["no anda", 1.8], ["no funciona", 1.8],
];

const NEGATORS = new Set(["no", "nunca", "ni", "tampoco", "jamas", "sin"]);
const INTENSIFIERS = new Set(["muy", "re", "super", "mega", "tan", "demasiado", "totalmente", "bastante"]);

const EMOTIONS: [Emotion, string[]][] = [
  ["enojo", ["verguenza", "indign", "harto", "harta", "basta", "bronca", "chanta", "mentira", "corrup", "asco", "caradura"]],
  ["miedo", ["miedo", "peligro", "inseguridad", "asalt", "robo", "robaron", "no se puede salir", "tengo miedo"]],
  ["tristeza", ["triste", "lamentable", "abandon", "olvid", "pena", "dolor"]],
  ["alegria", ["feliz", "alegr", "contento", "contenta", "genial", "hermos", "lindo", "linda", "espectacular", "joya"]],
  ["confianza", ["gracias", "agradec", "confi", "cumpl", "apoy", "escuch", "transparen", "felicit"]],
  ["sorpresa", ["increible", "sorpren", "no puedo creer", "wow", "que loco"]],
];

/** Temas por defecto; los trackers de cada organización se suman a estos. */
export const DEFAULT_TOPICS: { name: string; keywords: string[] }[] = [
  { name: "Seguridad", keywords: ["seguridad", "insegur", "robo", "robaron", "asalt", "policia", "patrull", "camaras", "delito"] },
  { name: "Salud", keywords: ["salud", "hospital", "turno", "guardia", "medic", "centro de salud", "vacun"] },
  { name: "Empleo", keywords: ["empleo", "trabajo", "desocup", "changa", "laburo", "capacitacion"] },
  { name: "Calles y obras", keywords: ["calle", "bache", "asfalt", "pavimento", "obra", "vereda", "cordon"] },
  { name: "Transporte", keywords: ["colectivo", "transporte", "micro", "frecuencia", "parada", "boleto"] },
  { name: "Agua y servicios", keywords: ["agua", "cloaca", "corte", "luz", "electricidad", "gas", "servicio"] },
  { name: "Residuos", keywords: ["basura", "residuos", "recoleccion", "contenedor", "mugre", "limpieza"] },
  { name: "Tasas e impuestos", keywords: ["tasa", "impuesto", "tarifazo", "aumento", "boleta", "cobr"] },
  { name: "Presupuesto participativo", keywords: ["presupuesto participativo", "presupuesto 2027", "consulta vecinal", "audiencia publica"] },
  { name: "Gestión municipal", keywords: ["intendent", "municipio", "municipalidad", "gestion", "concejo", "gobierno"] },
];

export type Classification = {
  sentiment: number;
  label: SentimentLabel;
  emotion: Emotion | null;
  topics: string[];
};

const EMOJI_POSITIVE = /[👏🙌❤️💪😍😊🥰👍✅🎉💚]/u;
const EMOJI_NEGATIVE = /[😡🤬😤👎💩😢😭😠🙄]/u;

export function classifyText(
  raw: string,
  trackers: Pick<SocialTracker, "name" | "keywords" | "exclude">[] = [],
): Classification {
  const text = norm(raw);
  const tokens = text.split(/[^a-zñ0-9]+/).filter(Boolean);

  let score = 0;
  // Frases de dos palabras primero ("sin agua", "no anda"), después raíces sueltas.
  for (const [phrase, w] of [...POSITIVE, ...NEGATIVE.map(([p, v]) => [p, -v] as [string, number])]) {
    if (phrase.includes(" ") && text.includes(phrase)) score += w;
  }
  tokens.forEach((tok, i) => {
    const pos = POSITIVE.find(([root]) => !root.includes(" ") && tok.startsWith(root));
    const neg = NEGATIVE.find(([root]) => !root.includes(" ") && tok.startsWith(root));
    const hit = neg ? -neg[1] : pos ? pos[1] : 0;
    if (!hit) return;
    const window = tokens.slice(Math.max(0, i - 3), i);
    const negated = window.some((w) => NEGATORS.has(w));
    const intense = window.some((w) => INTENSIFIERS.has(w));
    score += (negated ? -0.8 : 1) * (intense ? 1.5 : 1) * hit;
  });

  if (EMOJI_POSITIVE.test(raw)) score += 1;
  if (EMOJI_NEGATIVE.test(raw)) score -= 1.2;
  if (/!{2,}/.test(raw)) score *= 1.2;
  if (/\?{2,}/.test(raw) && score <= 0) score -= 0.4;

  const sentiment = Math.max(-1, Math.min(1, Math.tanh(score / 3)));
  const label: SentimentLabel = sentiment > 0.2 ? "positivo" : sentiment < -0.2 ? "negativo" : "neutral";

  let emotion: Emotion | null = null;
  let best = 0;
  for (const [name, roots] of EMOTIONS) {
    const hits = roots.filter((r) => text.includes(r)).length;
    if (hits > best) {
      best = hits;
      emotion = name;
    }
  }

  const topics = new Set<string>();
  const catalog: { name: string; keywords: string[]; exclude?: string[] }[] = [...DEFAULT_TOPICS, ...trackers];
  for (const t of catalog) {
    const excluded = t.exclude?.some((x) => text.includes(norm(x)));
    if (!excluded && t.keywords.some((k) => text.includes(norm(k)))) topics.add(t.name);
  }

  return { sentiment: Math.round(sentiment * 1000) / 1000, label, emotion, topics: [...topics] };
}

/** ¿La publicación habla de algo que la organización sigue? */
export function matchesTrackers(raw: string, trackers: Pick<SocialTracker, "keywords" | "exclude">[]) {
  if (!trackers.length) return true;
  const text = norm(raw);
  return trackers.some(
    (t) => t.keywords.some((k) => text.includes(norm(k))) && !t.exclude.some((x) => text.includes(norm(x))),
  );
}
