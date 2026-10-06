const STORY_STOP = new Set(
  "esta este estos estas para como pero cuando donde porque desde hasta sobre entre ante segun segun ciudad juan san capital municipalidad municipio intendente diario noticias nota portal".split(
    " ",
  ),
);

function storyTokens(text: string) {
  return fold(cleanHeadline(text))
    .split(/[^a-z0-9ñ]+/)
    .filter((w) => w.length >= 4 && !STORY_STOP.has(w));
}

function storyEntities(text: string) {
  const t = fold(text);
  const hits: string[] = [];
  if (/unicef|muna/.test(t)) hits.push("unicef-muna");
  if (/baistrocchi/.test(t)) hits.push("baistrocchi");
  if (/plaza ?25/.test(t)) hits.push("plaza-25");
  if (/amas de casa|feriant/.test(t)) hits.push("feria-amas");
  if (/asistencia al vecino/.test(t)) hits.push("asistencia-vecino");
  if (/walter melcher/.test(t)) hits.push("plaza-melcher");
  if (/arbolado/.test(t)) hits.push("arbolado");
  if (/ladrillos? plastic/.test(t)) hits.push("ladrillos-plasticos");
  return new Set(hits);
}

/** Misma noticia contada por varios portales. */
export function sameStory(a: string, b: string) {
  if (fold(cleanHeadline(a)) === fold(cleanHeadline(b))) return true;
  const ea = storyEntities(a);
  const eb = storyEntities(b);
  for (const e of ea) {
    if (eb.has(e)) return true;
  }
  const A = new Set(storyTokens(a));
  const B = new Set(storyTokens(b));
  if (!A.size || !B.size) return false;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter += 1;
  const jaccard = inter / (A.size + B.size - inter);
  return jaccard >= 0.42 || inter >= 4;
}

export function uniqueStories<T extends { text: string }>(posts: T[]): T[] {
  const kept: T[] = [];
  for (const post of posts) {
    if (kept.some((row) => sameStory(row.text, post.text))) continue;
    kept.push(post);
  }
  return kept;
}

/** Título corto para el tablero: saca repeticiones y el medio al final. */
export function cleanHeadline(text: string) {
  const raw = text.replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  const cut = raw.split(/\s+-\s+/)[0]?.trim() || raw;
  return (cut.length >= 12 ? cut : raw).slice(0, 160);
}

function fold(value: string) {
  return value.toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}

const LOCAL_OUTLET =
  /diario de cuyo|el zonda|huarpe|tiempo de san juan|diario 13|canal 13 san juan|estas informado|sanjuan8|la provincia sj|capital \| san juan|municipalidad de capital/;

const FOREIGN =
  /san juan de la costa|osorno|soychile|villa maria del triunfo|miraflores|lurigancho|\bperu\b|criadero|bulldog|perritos|alcalde de|berazategui|trelew|chiloe|lima\b/;

const OTHER_MUNI =
  /\bangaco\b|\bchimbas\b|\bpocito\b|\balbardon\b|\bcaucete\b|\bjachal\b|\biglesia\b|\bcalingasta\b|\bullum\b|\bsarmiento\b|\b9 de julio\b|\bveinticinco de mayo\b/;

const NOISE =
  /como estara el tiempo|pronostico del tiempo|el tiempo en san juan|viento zonda|agenda cultural|tributo a|los piojos|cinthia fernandez|recital|partido de futbol|liga sanjuanina|horoscopo|loteria|danzando|coreograf/;

const CIVIC =
  /municipalidad|intendente|municipio|concejo|ciudad de san juan|municipalidad de capital|obras?|bache|asfalto|vereda|recoleccion|residuos|plaza|unicef|muna|asistencia al vecino|linea(s)? de asistencia|gestion/;

/** Descarta notas de otros “San Juan” (Chile, Perú), clima/espectáculos o municipios ajenos. */
export function looksLikeLocalNews(text: string, organizationName: string, source?: string | null) {
  const t = fold(text);
  const org = fold(organizationName);
  const s = fold(source ?? "");
  const head = fold(cleanHeadline(text));
  if (head.length < 28 || /^municipalidad de capital(\s*\|\s*san juan)?$/.test(head)) return false;
  if (/^noticias sobre\b/.test(head) || /^noticias de\b/.test(head)) return false;
  if (FOREIGN.test(t) || FOREIGN.test(s) || NOISE.test(t)) return false;
  if (OTHER_MUNI.test(t) && !/ciudad de san juan|municipalidad de san juan|municipalidad de capital/.test(t)) {
    return false;
  }
  if (org.length > 6 && t.includes(org) && CIVIC.test(t)) return true;
  if (/ciudad de san juan|municipalidad de san juan|intendente de san juan|municipalidad de capital/.test(t)) {
    return true;
  }
  if (LOCAL_OUTLET.test(s) && CIVIC.test(t)) return true;
  if (/\bcordoba\b|\bcba24n\b/.test(t) && !/san juan/.test(t)) return false;
  return /san juan/.test(t) && CIVIC.test(t);
}
