import type { Emotion, SentimentLabel, SocialNetwork, SocialPost, SocialTracker } from "@/lib/types";
import { classifyText } from "@/lib/social/lexicon";

type Template = { topic: string; label: SentimentLabel; emotion: Emotion | null; text: string };

const BARRIOS = ["Centro", "Rivadavia", "Chimbas", "Rawson", "Santa Lucía", "Pocito", "Desamparados", "Trinidad"];
const CALLES = ["Av. Libertador", "calle Mendoza", "Av. Ignacio de la Roza", "calle Entre Ríos", "Av. Rawson", "Ruta 40"];

const T: Template[] = [
  // Seguridad
  { topic: "Seguridad", label: "negativo", emotion: "miedo", text: "Otra vez robaron en {barrio}, de noche no se puede salir. Inseguridad total" },
  { topic: "Seguridad", label: "negativo", emotion: "enojo", text: "Tercer robo en la cuadra este mes en {barrio}. ¿La policía dónde está? Basta!!" },
  { topic: "Seguridad", label: "positivo", emotion: "confianza", text: "Se nota más patrullaje en {barrio} desde que pusieron la base, gracias 👏" },
  { topic: "Seguridad", label: "neutral", emotion: null, text: "¿Alguien sabe si van a poner cámaras de seguridad en {barrio}?" },
  // Calles y obras
  { topic: "Calles y obras", label: "negativo", emotion: "enojo", text: "El bache de {calle} ya es un cráter, rompí la cubierta. Una vergüenza 🙄" },
  { topic: "Calles y obras", label: "positivo", emotion: "alegria", text: "Por fin asfaltaron {calle}! Quedó hermoso, gracias municipio 👏" },
  { topic: "Calles y obras", label: "negativo", emotion: "tristeza", text: "Las obras de {barrio} están abandonadas hace meses, lamentable" },
  { topic: "Calles y obras", label: "neutral", emotion: null, text: "Cortan {calle} por obra de pavimento desde el lunes, tomen precauciones" },
  // Agua y servicios
  { topic: "Agua y servicios", label: "negativo", emotion: "enojo", text: "Tercer día sin agua en {barrio} y nadie avisa nada 😡 una vergüenza" },
  { topic: "Agua y servicios", label: "negativo", emotion: "enojo", text: "Corte de agua otra vez en {barrio}. Pagamos la tasa para esto?? Harto" },
  { topic: "Agua y servicios", label: "positivo", emotion: "confianza", text: "Volvió el agua en {barrio}, gracias a los operarios que trabajaron toda la noche" },
  // Salud
  { topic: "Salud", label: "negativo", emotion: "tristeza", text: "Imposible conseguir turno en el hospital, esperé 5 horas en la guardia" },
  { topic: "Salud", label: "positivo", emotion: "confianza", text: "Excelente atención en el centro de salud de {barrio}, muy buena la doctora" },
  // Residuos
  { topic: "Residuos", label: "negativo", emotion: "enojo", text: "No pasa la recolección de basura hace tres días en {barrio}, mugre por todos lados" },
  { topic: "Residuos", label: "positivo", emotion: "alegria", text: "Qué bien quedó la plaza de {barrio} después de la limpieza 💚" },
  // Transporte
  { topic: "Transporte", label: "negativo", emotion: "enojo", text: "La frecuencia del colectivo a {barrio} es horrible, una hora esperando" },
  { topic: "Transporte", label: "neutral", emotion: null, text: "Cambian el recorrido del colectivo que pasa por {calle} desde mañana" },
  // Tasas
  { topic: "Tasas e impuestos", label: "negativo", emotion: "enojo", text: "Llegó la boleta con otro aumento de la tasa municipal. Tarifazo y las calles igual de rotas" },
  // Presupuesto participativo
  { topic: "Presupuesto participativo", label: "positivo", emotion: "confianza", text: "Ya voté en la consulta vecinal del presupuesto participativo, ojalá gane la plaza para {barrio}!" },
  { topic: "Presupuesto participativo", label: "positivo", emotion: "alegria", text: "Genial que pregunten qué obra queremos, así sí dan ganas de participar 🙌" },
  { topic: "Presupuesto participativo", label: "neutral", emotion: null, text: "¿Dónde se completa la consulta del presupuesto participativo 2027?" },
  { topic: "Presupuesto participativo", label: "negativo", emotion: "enojo", text: "El presupuesto participativo es puro marketing, las obras del año pasado nunca se hicieron" },
  // Gestión
  { topic: "Gestión municipal", label: "positivo", emotion: "confianza", text: "Muy buena la gestión del intendente con las obras en los distritos, se nota el cambio" },
  { topic: "Gestión municipal", label: "negativo", emotion: "enojo", text: "El municipio solo hace fotos para las redes, gestión pésima" },
  { topic: "Empleo", label: "negativo", emotion: "tristeza", text: "No hay trabajo para los pibes en San Juan, se van todos a Mendoza" },
  { topic: "Empleo", label: "positivo", emotion: "alegria", text: "Arrancó la capacitación en oficios del municipio, excelente para los jóvenes" },
];

const NEWS: Template[] = [
  { topic: "Calles y obras", label: "neutral", emotion: null, text: "El municipio anunció un plan de pavimentación para {barrio} y {calle}" },
  { topic: "Agua y servicios", label: "negativo", emotion: null, text: "Vecinos de {barrio} reclaman por cortes de agua reiterados" },
  { topic: "Presupuesto participativo", label: "neutral", emotion: null, text: "Abrió la consulta online del presupuesto participativo 2027" },
  { topic: "Seguridad", label: "neutral", emotion: null, text: "Presentaron las nuevas cámaras del centro de monitoreo" },
];

const NETWORK_WEIGHTS: [SocialNetwork, number][] = [
  ["facebook", 34],
  ["x", 22],
  ["instagram", 18],
  ["tiktok", 8],
  ["youtube", 4],
  ["noticias", 14],
];

export function buildDemoSocial(
  organizationId: string,
  random: () => number,
  gaussian: () => number,
  now: number,
): { trackers: SocialTracker[]; posts: SocialPost[] } {
  const pick = <V,>(items: V[]) => items[Math.floor(random() * items.length)];
  const weighted = <V,>(items: [V, number][]) => {
    const total = items.reduce((s, [, w]) => s + w, 0);
    let r = random() * total;
    for (const [v, w] of items) if ((r -= w) <= 0) return v;
    return items[items.length - 1][0];
  };

  const created = new Date(now - 60 * 86_400_000).toISOString();
  const trackers: SocialTracker[] = [
    {
      id: "trk-gestion",
      organization_id: organizationId,
      name: "Gestión municipal",
      keywords: ["municipalidad de san juan", "intendente", "municipio"],
      exclude: ["san juan, puerto rico"],
      is_active: true,
      created_at: created,
    },
    {
      id: "trk-presupuesto",
      organization_id: organizationId,
      name: "Presupuesto participativo",
      keywords: ["presupuesto participativo", "consulta vecinal", "presupuesto 2027"],
      exclude: [],
      is_active: true,
      created_at: created,
    },
  ];

  const posts: SocialPost[] = [];
  const add = (tpl: Template, daysAgo: number, network: SocialNetwork, boost = 1) => {
    const when = new Date(now - daysAgo * 86_400_000 - Math.floor(random() * 14) * 3_600_000);
    if (when.getTime() > now) when.setTime(now - 20 * 60_000);
    const text = tpl.text.replace("{barrio}", pick(BARRIOS)).replace("{calle}", pick(CALLES));
    const detected = classifyText(text);
    const base = tpl.label === "positivo" ? 0.55 : tpl.label === "negativo" ? -0.6 : 0;
    const n = posts.length + 1;
    posts.push({
      id: `soc-${n}`,
      organization_id: organizationId,
      network,
      external_id: `demo-${n}`,
      author: network === "noticias" ? pick(["Diario de Cuyo", "Radio Sarmiento", "El Zonda"]) : `usuario-${(n * 7919).toString(16).slice(-6)}`,
      url: null,
      text,
      published_at: when.toISOString(),
      engagement: Math.round(Math.exp(gaussian() * 1.1 + (network === "noticias" ? 3.4 : 2.2)) * boost),
      sentiment: Math.max(-1, Math.min(1, Math.round((base + gaussian() * 0.18) * 1000) / 1000)),
      label: tpl.label,
      emotion: tpl.emotion,
      topics: [...new Set([tpl.topic, ...detected.topics])],
      classified_by: "demo",
      created_at: when.toISOString(),
    });
  };

  // 75 días: alcanza para comparar los últimos 30 contra los 30 anteriores.
  for (let day = 74; day >= 0; day -= 1) {
    // Hace un mes la seguridad dominaba la conversación; después bajó.
    const volume = 16 + Math.floor(random() * 8);
    for (let i = 0; i < volume; i += 1) {
      const network = weighted(NETWORK_WEIGHTS);
      let pool = network === "noticias" ? NEWS : T;
      if (day > 25 && network !== "noticias" && random() < 0.25) pool = T.filter((t) => t.topic === "Seguridad" && t.label !== "positivo");
      // La consulta vecinal existe hace 12 días.
      if (day > 12) pool = pool.filter((t) => t.topic !== "Presupuesto participativo");
      add(pick(pool), day, network);
    }

    // Consulta del presupuesto participativo: crece desde su lanzamiento.
    if (day <= 12) {
      const extra = Math.round((13 - day) * 0.9);
      for (let i = 0; i < extra; i += 1) {
        add(pick(T.filter((t) => t.topic === "Presupuesto participativo")), day, weighted([["instagram", 4], ["facebook", 4], ["x", 2]]));
      }
    }
  }

  // Evento: corte de agua masivo hace 4 días, con coletazo al día siguiente.
  for (const [day, count] of [
    [4, 38],
    [3, 16],
  ] as const) {
    for (let i = 0; i < count; i += 1) {
      add(pick(T.filter((t) => t.topic === "Agua y servicios" && t.label === "negativo")), day, weighted([["facebook", 5], ["x", 4], ["instagram", 2]]), 1.6);
    }
  }
  // Evento: inauguración de plaza y asfalto hace 11 días.
  for (let i = 0; i < 18; i += 1) {
    add(pick(T.filter((t) => t.label === "positivo" && (t.topic === "Calles y obras" || t.topic === "Residuos"))), 11, weighted([["instagram", 5], ["facebook", 5]]), 1.3);
  }

  return { trackers, posts };
}
