import type {
  AiReport,
  Answer,
  Dirigente,
  DirigenteMedicion,
  Invoice,
  Organization,
  Profile,
  Project,
  Question,
  QuestionOption,
  Survey,
  SurveyAssignment,
  SurveyZoneQuota,
  SurveyResponse,
  SocialImport,
  SocialPost,
  SocialSource,
  SocialTracker,
} from "@/lib/types";
import { buildDemoSocial } from "@/lib/demo/social";

// ---------------------------------------------------------------------------
// Generador determinístico. Con semilla fija, el servidor y el cliente arman
// exactamente el mismo dataset y los números no bailan entre renders.
// ---------------------------------------------------------------------------
function mulberry32(seed: number) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Normal estándar por Box-Muller, con el mismo generador sembrado. */
function gaussian(random: () => number) {
  const u = Math.max(random(), 1e-9);
  const v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function pickWeighted<T>(random: () => number, items: readonly (readonly [T, number])[]): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let r = random() * total;
  for (const [item, w] of items) {
    r -= w;
    if (r <= 0) return item;
  }
  return items[items.length - 1][0];
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Hora argentina (UTC-3) expresada en ISO, para que las series por día cierren. */
function daysAgo(n: number, hour = 12, minute = 0) {
  const d = new Date(DEMO_NOW);
  d.setUTCDate(d.getUTCDate() - n);
  d.setUTCHours(hour + 3, minute, 0, 0);
  // Las cargas "de hoy" no pueden quedar en el futuro si la demo arranca temprano.
  const latest = DEMO_NOW - (5 + ((hour * 7 + minute) % 50)) * 60_000;
  return new Date(n === 0 ? Math.min(d.getTime(), latest) : d.getTime()).toISOString();
}

/**
 * Referencia temporal del dataset. Se fija al construirlo (una vez por proceso
 * y en cada "Reiniciar datos"), no en cada render: así el operativo siempre
 * aparece en curso respecto de hoy y los números no bailan entre páginas.
 * El dataset solo se arma en el servidor, así que no hay riesgo de hydration.
 */
let DEMO_NOW = Date.now();

export function demoNow() {
  return DEMO_NOW;
}

export const ORG_MUNI = "org-san-juan";
export const ORG_UNI = "org-unl";
export const SURVEY_ACTIVE = "enc-percepcion-ola3";
export const SURVEY_DRAFT = "enc-percepcion-ola4";

export const DEMO_USERS = [
  {
    id: "usr-admin",
    email: "admin@encuestadora.app",
    full_name: "Laura Giménez",
    role: "super_admin" as const,
    organization_id: null,
    description: "Administración central de la plataforma",
  },
  {
    id: "usr-direccion",
    email: "direccion@sanjuan.gob.ar",
    full_name: "Martín Robledo",
    role: "org_admin" as const,
    organization_id: ORG_MUNI,
    description: "Administrador del cliente: crea encuestas e informes",
  },
  {
    id: "usr-analista",
    email: "analista@sanjuan.gob.ar",
    full_name: "Sofía Paredes",
    role: "org_analyst" as const,
    organization_id: ORG_MUNI,
    description: "Analista del cliente: solo lectura",
  },
  {
    id: "usr-campo-1",
    email: "campo1@encuestadora.app",
    full_name: "Diego Ferreyra",
    role: "surveyor" as const,
    organization_id: ORG_MUNI,
    description: "Encuestador: carga entrevistas en campo",
  },
];

const EXTRA_SURVEYORS = [
  { id: "usr-campo-2", email: "campo2@encuestadora.app", full_name: "Carla Ibáñez" },
  { id: "usr-campo-3", email: "campo3@encuestadora.app", full_name: "Nicolás Ovando" },
];

type QuestionSeed = {
  id: string;
  type: Question["type"];
  text: string;
  section: string;
  help_text?: string;
  required?: boolean;
  min?: number;
  max?: number;
  options?: string[];
  logic?: Question["logic"];
};

const QUESTION_SEEDS: QuestionSeed[] = [
  {
    id: "q-reside",
    type: "si_no",
    text: "¿Reside actualmente en el municipio de San Juan?",
    section: "Filtro",
    help_text: "Si responde que no, se agradece y la entrevista termina.",
    logic: { end_if: ["no"] },
  },
  {
    id: "q-edad-rango",
    type: "opcion_unica",
    text: "¿En qué rango de edad se encuentra?",
    section: "Perfil",
    options: ["18 a 29 años", "30 a 44 años", "45 a 59 años", "60 años o más"],
  },
  {
    id: "q-genero",
    type: "opcion_unica",
    text: "Género",
    section: "Perfil",
    options: ["Femenino", "Masculino", "Otro / Prefiero no responder"],
  },
  {
    id: "q-gestion",
    type: "opcion_unica",
    text: "¿Cómo evalúa la gestión del gobierno municipal?",
    section: "Gestión",
    options: ["Muy buena", "Buena", "Regular", "Mala", "Muy mala", "No sabe / No contesta"],
  },
  {
    id: "q-motivo",
    type: "opcion_unica",
    text: "¿Cuál es el principal motivo de su evaluación negativa?",
    section: "Gestión",
    help_text: "Solo para quienes evaluaron la gestión como mala o muy mala.",
    options: [
      "Inseguridad",
      "Las obras no llegan a mi barrio",
      "Atención en salud",
      "Falta de empleo",
      "Aumento de tasas municipales",
      "Otro motivo",
    ],
    logic: { show_if: { question_id: "q-gestion", values: ["q-gestion-o4", "q-gestion-o5"] } },
  },
  {
    id: "q-problemas",
    type: "opcion_multiple",
    text: "¿Cuáles son los principales problemas del municipio?",
    help_text: "Puede marcar hasta tres opciones.",
    section: "Agenda",
    max: 3,
    options: [
      "Seguridad",
      "Salud",
      "Empleo",
      "Transporte público",
      "Estado de las calles",
      "Recolección de residuos",
      "Educación",
      "Alumbrado público",
    ],
  },
  {
    id: "q-satisfaccion",
    type: "escala",
    text: "Del 1 al 10, ¿qué tan satisfecho está con los servicios públicos?",
    section: "Servicios",
    min: 1,
    max: 10,
  },
  {
    id: "q-medios",
    type: "opcion_unica",
    text: "¿Por qué medio se informa principalmente sobre temas locales?",
    section: "Medios",
    options: [
      "Redes sociales",
      "Televisión",
      "Radio",
      "Portales de noticias",
      "Comentarios de vecinos",
    ],
  },
  {
    id: "q-barrio",
    type: "si_no",
    text: "¿Considera que su barrio mejoró durante el último año?",
    section: "Gestión",
  },
  {
    id: "q-edad",
    type: "numero",
    text: "Edad exacta del encuestado",
    section: "Perfil",
    required: false,
    min: 16,
    max: 99,
  },
  {
    id: "q-abierta",
    type: "texto_largo",
    text: "¿Qué le pediría a la gestión municipal para el próximo año?",
    section: "Abierta",
    required: false,
  },
];

const PROBLEM_LABELS = QUESTION_SEEDS.find((q) => q.id === "q-problemas")?.options ?? [];

export const SURVEY_WEB = "enc-presupuesto-web";
export const WEB_TOKEN = "presupuesto-2027";

const WEB_SEEDS: QuestionSeed[] = [
  {
    id: "w-vive",
    type: "si_no",
    text: "¿Vivís en el municipio de San Juan?",
    section: "Filtro",
    logic: { end_if: ["no"] },
  },
  {
    id: "w-barrio",
    type: "opcion_unica",
    text: "¿En qué zona vivís?",
    section: "Perfil",
    options: ["Centro", "Norte", "Sur", "Este", "Oeste", "Distritos rurales"],
  },
  {
    id: "w-obra",
    type: "opcion_unica",
    text: "Si tuvieras que elegir una sola obra para tu zona en 2027, ¿cuál sería?",
    section: "Prioridades",
    options: [
      "Bacheo y pavimento",
      "Iluminación LED",
      "Plazas y espacios verdes",
      "Cloacas y agua potable",
      "Ciclovías",
      "Centro de salud barrial",
    ],
  },
  {
    id: "w-edad",
    type: "opcion_unica",
    text: "¿Qué edad tenés?",
    section: "Perfil",
    options: ["16 a 24", "25 a 39", "40 a 59", "60 o más"],
  },
  {
    id: "w-audiencia",
    type: "escala",
    text: "Del 0 al 10, ¿qué tan probable es que participes de la audiencia pública?",
    section: "Participación",
    min: 0,
    max: 10,
  },
  {
    id: "w-propuesta",
    type: "texto_largo",
    text: "¿Querés dejar una propuesta concreta?",
    section: "Propuesta",
    required: false,
  },
];

/** Textuales agrupados por el problema que más pesa en quien responde. */
const TEXTUALES: Record<string, string[]> = {
  Seguridad: [
    "Más patrullaje nocturno, sobre todo en las plazas.",
    "Que vuelva la policía de proximidad al barrio, de noche no se puede salir.",
    "Cámaras en las esquinas y que alguien las mire.",
  ],
  Salud: [
    "Que mejoren la atención en el hospital y los turnos.",
    "Un centro de salud abierto los fines de semana.",
  ],
  Empleo: [
    "Más programas para jóvenes y capacitación laboral.",
    "Que apoyen a los emprendedores con créditos chicos.",
  ],
  "Transporte público": [
    "Necesitamos más frecuencia de colectivos hacia el centro.",
    "Que el colectivo llegue a las zonas rurales todos los días.",
  ],
  "Estado de las calles": [
    "Que arreglen las calles del barrio, hace años que están rotas.",
    "Está mejorando, pero falta que lleguen las obras a la periferia.",
  ],
  "Recolección de residuos": ["Que la recolección de residuos pase todos los días."],
  Educación: ["Más vacantes en los jardines municipales."],
  "Alumbrado público": ["Más luminarias LED, hay cuadras completas a oscuras."],
  _: [
    "Menos impuestos y más obra visible en los barrios.",
    "Espacios verdes cuidados y seguros para los chicos.",
    "Que escuchen más a los vecinos antes de decidir.",
  ],
};

/** Peso de cada zona en la muestra y encuestador que la cubre. */
const ZONAS = [
  { name: "Centro", weight: 26, surveyor: "usr-campo-1", mood: 0.55 },
  { name: "Norte", weight: 19, surveyor: "usr-campo-1", mood: 0.15 },
  { name: "Sur", weight: 21, surveyor: "usr-campo-2", mood: -0.5 },
  { name: "Oeste", weight: 17, surveyor: "usr-campo-2", mood: -0.3 },
  { name: "Este", weight: 17, surveyor: "usr-campo-3", mood: 0 },
] as const;

/**
 * Centro aproximado de cada zona de San Juan, Argentina. Sirven para dispersar
 * los casos en el mapa de campo: no son coordenadas reales de cada entrevista
 * (nunca se registró eso), son un centro de zona + ruido para dar una lectura
 * territorial verosímil.
 */
const ZONE_COORDS: Record<string, [number, number]> = {
  Centro: [-31.5375, -68.5364],
  Norte: [-31.502, -68.535],
  Sur: [-31.572, -68.545],
  Oeste: [-31.537, -68.575],
  Este: [-31.535, -68.505],
  Rural: [-31.6, -68.62],
};

/** Dispersa un punto alrededor del centro de zona (grados, ~n km de spread). */
function jitterZone(random: () => number, zoneName: string, spreadKm = 1.8) {
  const [lat, lng] = ZONE_COORDS[zoneName] ?? ZONE_COORDS.Centro;
  const kmPerDegLat = 111.32;
  const kmPerDegLng = 111.32 * Math.cos((lat * Math.PI) / 180);
  return {
    latitude: Number((lat + (gaussian(random) * spreadKm) / kmPerDegLat).toFixed(6)),
    longitude: Number((lng + (gaussian(random) * spreadKm) / kmPerDegLng).toFixed(6)),
  };
}

const BARRIO_ZONE = ["Centro", "Norte", "Sur", "Este", "Oeste", "Rural"] as const;

export type DemoTables = {
  organizations: Organization[];
  profiles: Profile[];
  projects: Project[];
  surveys: Survey[];
  questions: Question[];
  question_options: QuestionOption[];
  survey_assignments: SurveyAssignment[];
  survey_zone_quotas: SurveyZoneQuota[];
  responses: SurveyResponse[];
  answers: Answer[];
  ai_reports: AiReport[];
  social_trackers: SocialTracker[];
  social_posts: SocialPost[];
  social_sources: SocialSource[];
  social_imports: SocialImport[];
  invoices: Invoice[];
  dirigentes: Dirigente[];
  dirigente_mediciones: DirigenteMedicion[];
};

export function buildDemoData(): DemoTables {
  DEMO_NOW = Date.now();
  const random = mulberry32(20260829);

  // ------------------------------------------------------------- organizaciones
  const organizations: Organization[] = [
    {
      id: ORG_MUNI,
      name: "Municipalidad de San Juan",
      slug: "san-juan",
      type: "gobierno",
      status: "activa",
      contact_email: "direccion@sanjuan.gob.ar",
      contact_phone: "+54 264 422 0000",
      country: "Argentina",
      region: "San Juan",
      logo_url: null,
      brand_color: "#1e40af",
      notes: "Convenio anual. Monitor trimestral de opinión pública.",
      created_at: daysAgo(240),
      updated_at: daysAgo(20),
    },
    {
      id: ORG_UNI,
      name: "Universidad Nacional del Litoral",
      slug: "unl",
      type: "institucion",
      status: "prueba",
      contact_email: "rectorado@unl.edu.ar",
      contact_phone: null,
      country: "Argentina",
      region: "Santa Fe",
      logo_url: null,
      brand_color: "#0d9488",
      notes: "Piloto de clima institucional para la Secretaría Académica.",
      created_at: daysAgo(35),
      updated_at: daysAgo(35),
    },
  ];

  // ------------------------------------------------------------------- perfiles
  const profiles: Profile[] = [
    ...DEMO_USERS.map((u, i) => ({
      id: u.id,
      organization_id: u.organization_id,
      full_name: u.full_name,
      email: u.email,
      phone: null,
      role: u.role,
      avatar_url: null,
      is_active: true,
      last_seen_at: daysAgo(i === 0 ? 0 : 1),
      created_at: daysAgo(230 - i * 12),
      updated_at: daysAgo(2),
    })),
    ...EXTRA_SURVEYORS.map((u, i) => ({
      id: u.id,
      organization_id: ORG_MUNI,
      full_name: u.full_name,
      email: u.email,
      phone: null,
      role: "surveyor" as const,
      avatar_url: null,
      is_active: true,
      last_seen_at: daysAgo(1),
      created_at: daysAgo(120 - i * 20),
      updated_at: daysAgo(3),
    })),
    {
      id: "usr-unl-admin",
      organization_id: ORG_UNI,
      full_name: "Valeria Sosa",
      email: "valeria.sosa@unl.edu.ar",
      phone: null,
      role: "org_admin",
      avatar_url: null,
      is_active: true,
      last_seen_at: daysAgo(6),
      created_at: daysAgo(35),
      updated_at: daysAgo(35),
    },
  ];

  // ------------------------------------------------------------------ proyectos
  const projects: Project[] = [
    {
      id: "proj-monitor",
      organization_id: ORG_MUNI,
      name: "Monitor de Opinión Pública 2026",
      description: "Serie trimestral de medición de percepción ciudadana.",
      color: "#0ea5a4",
      service_line: "tracking",
      created_by: "usr-direccion",
      created_at: daysAgo(200),
    },
    {
      id: "proj-presupuesto-participativo",
      organization_id: ORG_MUNI,
      name: "Presupuesto Participativo 2027",
      description: "Consulta vecinal online para priorizar obras del año próximo.",
      color: "#7c3aed",
      service_line: "monitor_gestion",
      created_by: "usr-direccion",
      created_at: daysAgo(14),
    },
    {
      id: "proj-clima-unl",
      organization_id: ORG_UNI,
      name: "Clima institucional — Piloto",
      description: "Prueba de la plataforma con una muestra reducida de docentes.",
      color: "#0d9488",
      service_line: "opinion_publica",
      created_by: "usr-unl-admin",
      created_at: daysAgo(30),
    },
  ];

  // ------------------------------------------------------------------ encuestas
  const surveys: Survey[] = [
    {
      id: SURVEY_ACTIVE,
      organization_id: ORG_MUNI,
      project_id: "proj-monitor",
      title: "Percepción Ciudadana — Ola 3 (Agosto 2026)",
      description:
        "Medición de imagen de gestión, prioridades vecinales y satisfacción con servicios públicos.",
      status: "activa",
      target_responses: 600,
      starts_at: daysAgo(20),
      ends_at: daysAgo(-10),
      geography: "San Juan, Argentina",
      methodology: "Presencial cara a cara, muestreo por cuotas",
      web_enabled: false,
      public_token: null,
      web_settings: {},
      created_by: "usr-direccion",
      created_at: daysAgo(26),
      updated_at: daysAgo(1),
    },
    {
      id: SURVEY_DRAFT,
      organization_id: ORG_MUNI,
      project_id: "proj-monitor",
      title: "Percepción Ciudadana — Ola 4 (Noviembre 2026)",
      description: "Próxima ola del monitor trimestral. Cuestionario en armado.",
      status: "borrador",
      target_responses: 600,
      starts_at: null,
      ends_at: null,
      geography: "San Juan, Argentina",
      methodology: "Presencial cara a cara, muestreo por cuotas",
      web_enabled: false,
      public_token: null,
      web_settings: {},
      created_by: "usr-direccion",
      created_at: daysAgo(4),
      updated_at: daysAgo(4),
    },
    {
      id: "enc-clima-unl",
      organization_id: ORG_UNI,
      project_id: "proj-clima-unl",
      title: "Clima institucional — Piloto",
      description: "Prueba de la plataforma con una muestra reducida de docentes.",
      status: "borrador",
      target_responses: 120,
      starts_at: null,
      ends_at: null,
      geography: "Santa Fe capital",
      methodology: "Telefónica asistida",
      web_enabled: false,
      public_token: null,
      web_settings: {},
      created_by: "usr-unl-admin",
      created_at: daysAgo(30),
      updated_at: daysAgo(30),
    },
  ];

  // ------------------------------------------------------- preguntas y opciones
  const questions: Question[] = [];
  const question_options: QuestionOption[] = [];

  QUESTION_SEEDS.forEach((seed, i) => {
    questions.push({
      id: seed.id,
      survey_id: SURVEY_ACTIVE,
      position: i + 1,
      type: seed.type,
      text: seed.text,
      help_text: seed.help_text ?? null,
      is_required: seed.required ?? true,
      section: seed.section,
      min_value: seed.min ?? null,
      max_value: seed.max ?? null,
      logic: seed.logic ?? null,
      created_at: daysAgo(26),
    });

    seed.options?.forEach((label, j) => {
      question_options.push({
        id: `${seed.id}-o${j + 1}`,
        question_id: seed.id,
        position: j + 1,
        label,
        value: null,
        is_exclusive: /^no sabe|^ninguno/i.test(label),
      });
    });
  });

  // ---------------------------------------------------------------- asignaciones
  const survey_assignments: SurveyAssignment[] = [
    {
      id: "asg-1",
      survey_id: SURVEY_ACTIVE,
      surveyor_id: "usr-campo-1",
      quota: 220,
      zone: "Zona Centro y Norte",
      created_at: daysAgo(20),
    },
    {
      id: "asg-2",
      survey_id: SURVEY_ACTIVE,
      surveyor_id: "usr-campo-2",
      quota: 220,
      zone: "Zona Sur y Oeste",
      created_at: daysAgo(20),
    },
    {
      id: "asg-3",
      survey_id: SURVEY_ACTIVE,
      surveyor_id: "usr-campo-3",
      quota: 160,
      zone: "Zona Este y rural",
      created_at: daysAgo(14),
    },
  ];

  // ------------------------------------------------------- respuestas y answers
  //
  // Cada persona tiene un perfil latente (zona, edad, género) y un "humor" hacia
  // la gestión que depende de la zona y la edad. Las respuestas salen de ese
  // perfil, así los cruces muestran diferencias reales y no ruido: la edad por
  // tramo coincide con la edad exacta, la satisfacción acompaña a la evaluación
  // y la agenda de problemas cambia con la edad y el barrio.
  const responses: SurveyResponse[] = [];
  const answers: Answer[] = [];
  const opt = (questionId: string, n: number) => `${questionId}-o${n}`;

  const push = (
    responseId: string,
    questionId: string,
    when: string,
    value: Partial<Pick<Answer, "value_text" | "value_number" | "option_ids">>,
  ) => {
    answers.push({
      id: `ans-${responseId}-${questionId}`,
      response_id: responseId,
      question_id: questionId,
      value_text: value.value_text ?? null,
      value_number: value.value_number ?? null,
      value_date: null,
      option_ids: value.option_ids ?? [],
      created_at: when,
    });
  };

  const TOTAL = 430;

  for (let i = 0; i < TOTAL; i += 1) {
    const id = `resp-${i + 1}`;
    const zone = pickWeighted(random, ZONAS.map((z) => [z, z.weight] as const));

    // El operativo arrancó lento y fue tomando ritmo. El encuestador del Este
    // dejó de cargar hace tres días: el tablero lo tiene que detectar.
    let day = Math.floor(Math.pow(random(), 0.8) * 20);
    if (zone.surveyor === "usr-campo-3") day = Math.max(day, 3);
    const submitted = daysAgo(day, 9 + Math.floor(random() * 10), Math.floor(random() * 60));

    // Una de cada ocho entrevistas del Este es "exprés": duración muy por debajo
    // de la mediana, típico indicador de carga sin entrevista real.
    const express = zone.surveyor === "usr-campo-3" && random() < 0.13;
    const duration = express
      ? 70 + Math.floor(random() * 80)
      : Math.round(clamp(540 + gaussian(random) * 130, 300, 900));

    // --- filtro: el 6% no reside y la entrevista se descarta ----------------
    const resides = random() >= 0.06;
    responses.push({
      id,
      survey_id: SURVEY_ACTIVE,
      organization_id: ORG_MUNI,
      surveyor_id: zone.surveyor,
      status: resides ? "completada" : "descartada",
      channel: "campo",
      source_url: null,
      respondent_hash: null,
      zone: zone.name,
      ...jitterZone(random, zone.name),
      duration_seconds: resides ? duration : 40 + Math.floor(random() * 40),
      started_at: submitted,
      submitted_at: submitted,
    });

    push(id, "q-reside", submitted, { value_text: resides ? "si" : "no" });
    if (!resides) continue;

    // --- perfil ------------------------------------------------------------
    const age = Math.round(
      pickWeighted(random, [
        [18 + random() * 12, 27],
        [30 + random() * 15, 27],
        [45 + random() * 15, 24],
        [60 + random() * 25, 22],
      ] as const),
    );
    const ageBand = age < 30 ? 1 : age < 45 ? 2 : age < 60 ? 3 : 4;
    push(id, "q-edad-rango", submitted, { option_ids: [opt("q-edad-rango", ageBand)] });

    const gender = pickWeighted(random, [
      [1, 52],
      [2, 46],
      [3, 2],
    ] as const);
    push(id, "q-genero", submitted, { option_ids: [opt("q-genero", gender)] });

    // --- gestión -----------------------------------------------------------
    const ageMood = ageBand === 1 ? -0.35 : ageBand === 4 ? 0.3 : 0;
    const mood = zone.mood + ageMood + gaussian(random) * 0.95;
    const noOpina = random() < 0.06;
    const gestion = noOpina
      ? 6
      : mood > 1.25
        ? 1
        : mood > 0.4
          ? 2
          : mood > -0.35
            ? 3
            : mood > -1.1
              ? 4
              : 5;
    push(id, "q-gestion", submitted, { option_ids: [opt("q-gestion", gestion)] });

    // Pregunta condicional: solo si la evaluación fue mala o muy mala.
    if (gestion === 4 || gestion === 5) {
      const motivo = pickWeighted(random, [
        [1, zone.name === "Sur" || zone.name === "Oeste" ? 38 : 18],
        [2, zone.name === "Este" || zone.name === "Norte" ? 30 : 14],
        [3, ageBand === 4 ? 26 : 12],
        [4, ageBand === 1 ? 28 : 12],
        [5, 14],
        [6, 5],
      ] as const);
      push(id, "q-motivo", submitted, { option_ids: [opt("q-motivo", motivo)] });
    }

    // --- agenda: hasta tres problemas, con peso por edad y zona -------------
    const weights: [number, number][] = [
      [1, 0.42 + (zone.name === "Sur" || zone.name === "Oeste" ? 0.2 : 0)],
      [2, 0.2 + (ageBand === 4 ? 0.25 : 0)],
      [3, 0.22 + (ageBand === 1 ? 0.28 : ageBand === 2 ? 0.1 : 0)],
      [4, 0.12 + (zone.name === "Este" ? 0.22 : 0)],
      [5, 0.2 + (zone.name === "Norte" || zone.name === "Este" ? 0.14 : 0)],
      [6, 0.12],
      [7, 0.1 + (ageBand === 2 ? 0.1 : 0)],
      [8, 0.1 + (zone.name === "Oeste" ? 0.16 : 0)],
    ];
    const problems = weights
      .map(([n, p]) => ({ n, p, hit: random() < p }))
      .filter((w) => w.hit)
      .sort((a, b) => b.p - a.p + (random() - 0.5) * 0.1)
      .slice(0, 3)
      .map((w) => w.n);
    if (!problems.length) problems.push(pickWeighted(random, weights));
    push(id, "q-problemas", submitted, { option_ids: problems.map((n) => opt("q-problemas", n)) });

    // --- servicios: la satisfacción acompaña el humor general ---------------
    const satisfaction = Math.round(clamp(5.6 + mood * 1.7 + gaussian(random) * 1.3, 1, 10));
    push(id, "q-satisfaccion", submitted, { value_number: satisfaction });

    // --- medios: los jóvenes se informan por redes, los mayores por TV y radio
    const medio = pickWeighted(random, [
      [1, ageBand === 1 ? 62 : ageBand === 2 ? 45 : ageBand === 3 ? 28 : 12],
      [2, ageBand === 4 ? 38 : 16],
      [3, ageBand === 4 ? 26 : 9],
      [4, ageBand === 2 || ageBand === 3 ? 22 : 12],
      [5, 12],
    ] as const);
    push(id, "q-medios", submitted, { option_ids: [opt("q-medios", medio)] });

    const improved = random() < 1 / (1 + Math.exp(-(mood * 1.4 - 0.35)));
    push(id, "q-barrio", submitted, { value_text: improved ? "si" : "no" });

    // Edad exacta: opcional, uno de cada diez no la da.
    if (random() >= 0.1) push(id, "q-edad", submitted, { value_number: age });

    if (random() < 0.36) {
      const pool = TEXTUALES[PROBLEM_LABELS[problems[0] - 1]] ?? TEXTUALES._;
      const source = random() < 0.25 ? TEXTUALES._ : pool;
      push(id, "q-abierta", submitted, {
        value_text: source[Math.floor(random() * source.length)],
      });
    }
  }

  // Un puñado de entrevistas abiertas ahora mismo, para que el tablero muestre
  // el estado "en curso".
  for (let i = 0; i < 4; i += 1) {
    const zone = ZONAS[i % 2 === 0 ? 0 : 2];
    responses.push({
      id: `resp-curso-${i + 1}`,
      survey_id: SURVEY_ACTIVE,
      organization_id: ORG_MUNI,
      surveyor_id: zone.surveyor,
      status: "en_curso",
      channel: "campo",
      source_url: null,
      respondent_hash: null,
      zone: zone.name,
      ...jitterZone(random, zone.name),
      duration_seconds: null,
      started_at: daysAgo(0, 11 + i),
      submitted_at: null,
    });
  }

  // ------------------------------------------------------- encuesta web embebida
  //
  // Consulta abierta que el municipio publica con el widget en su sitio y en
  // redes. Sirve para mostrar el canal web: respuestas sin encuestador, origen
  // de cada respuesta y resultados en el mismo tablero.
  surveys.push({
    id: SURVEY_WEB,
    organization_id: ORG_MUNI,
    project_id: "proj-presupuesto-participativo",
    title: "Presupuesto Participativo 2027 — Consulta vecinal online",
    description: "Consulta abierta para priorizar las obras del presupuesto participativo del año próximo.",
    status: "activa",
    target_responses: 500,
    starts_at: daysAgo(12),
    ends_at: daysAgo(-18),
    geography: "San Juan, Argentina",
    methodology: "Autoadministrada online (widget en sitio web y redes). Muestra no probabilística.",
    web_enabled: true,
    public_token: WEB_TOKEN,
    web_settings: {
      accent: "#0d9488",
      welcome_title: "¿Qué obra querés para tu barrio en 2027?",
      welcome_text: "Lleva menos de 2 minutos y es anónima. Tu opinión define qué obras entran en el presupuesto participativo.",
      thanks_title: "¡Gracias por participar!",
      thanks_text: "Los resultados se publican en la audiencia pública de noviembre.",
      button_label: "Opiná sobre el presupuesto 2027",
      mode: "flotante",
      one_per_device: true,
      popup_delay: 8,
    },
    created_by: "usr-direccion",
    created_at: daysAgo(14),
    updated_at: daysAgo(1),
  });

  WEB_SEEDS.forEach((seed, i) => {
    questions.push({
      id: seed.id,
      survey_id: SURVEY_WEB,
      position: i + 1,
      type: seed.type,
      text: seed.text,
      help_text: seed.help_text ?? null,
      is_required: seed.required ?? true,
      section: seed.section,
      min_value: seed.min ?? null,
      max_value: seed.max ?? null,
      logic: seed.logic ?? null,
      created_at: daysAgo(14),
    });
    seed.options?.forEach((label, j) => {
      question_options.push({
        id: `${seed.id}-o${j + 1}`,
        question_id: seed.id,
        position: j + 1,
        label,
        value: null,
        is_exclusive: false,
      });
    });
  });

  const SOURCES = [
    ["https://www.sanjuan.gob.ar/presupuesto-participativo", 46],
    ["https://www.sanjuan.gob.ar/", 18],
    ["https://www.instagram.com/", 20],
    ["https://www.facebook.com/", 10],
    ["https://diariodecuyo.com.ar/politica/", 6],
  ] as const;

  const WEB_TOTAL = 212;
  for (let i = 0; i < WEB_TOTAL; i += 1) {
    const id = `web-${i + 1}`;
    // La consulta tuvo un pico cuando se difundió en redes, hace 6 días.
    const day = random() < 0.35 ? 5 + Math.floor(random() * 3) : Math.floor(random() * 12);
    const submitted = daysAgo(day, 8 + Math.floor(random() * 15), Math.floor(random() * 60));
    const barrio = pickWeighted(random, [
      [1, 24],
      [2, 20],
      [3, 22],
      [4, 12],
      [5, 16],
      [6, 6],
    ] as const);
    const young = random() < 0.46;
    // Una de cada doce personas es de otro municipio: la consulta la descarta.
    const local = random() >= 0.08;

    responses.push({
      id,
      survey_id: SURVEY_WEB,
      organization_id: ORG_MUNI,
      surveyor_id: null,
      status: local ? "completada" : "descartada",
      channel: "web",
      source_url: pickWeighted(random, SOURCES),
      respondent_hash: `demo-${id}`,
      zone: null,
      ...jitterZone(random, BARRIO_ZONE[barrio - 1], 1.2),
      duration_seconds: local ? Math.round(clamp(95 + gaussian(random) * 35, 35, 260)) : 12,
      started_at: submitted,
      submitted_at: submitted,
    });

    push(id, "w-vive", submitted, { value_text: local ? "si" : "no" });
    if (!local) continue;

    push(id, "w-barrio", submitted, { option_ids: [opt("w-barrio", barrio)] });

    const obra = pickWeighted(random, [
      [1, barrio === 3 || barrio === 5 ? 34 : 20],
      [2, barrio === 3 ? 24 : 14],
      [3, young ? 22 : 12],
      [4, barrio === 6 ? 40 : barrio === 4 ? 26 : 10],
      [5, young ? 16 : 4],
      [6, young ? 8 : 20],
    ] as const);
    push(id, "w-obra", submitted, { option_ids: [opt("w-obra", obra)] });

    push(id, "w-edad", submitted, {
      option_ids: [opt("w-edad", young ? (random() < 0.5 ? 1 : 2) : random() < 0.55 ? 3 : 4)],
    });

    const nps = Math.round(clamp((young ? 5.2 : 6.6) + gaussian(random) * 2.4, 0, 10));
    push(id, "w-audiencia", submitted, { value_number: nps });

    if (random() < 0.3) {
      const ideas = [
        "Asfaltar las calles de tierra que quedan en el barrio.",
        "Una plaza con juegos inclusivos y buena iluminación.",
        "Terminar la red cloacal, hay cuadras que siguen con pozo.",
        "Ciclovía segura hasta el centro y las escuelas.",
        "Un centro de salud con guardia en el barrio.",
        "Más luminarias LED en las calles internas.",
      ];
      push(id, "w-propuesta", submitted, { value_text: ideas[(obra - 1) % ideas.length] });
    }
  }

  // Arranca vacío a propósito: generar el primer informe con un click es la
  // mejor forma de mostrar que el motor funciona sobre los datos reales.
  const ai_reports: AiReport[] = [];

  const social = buildDemoSocial(ORG_MUNI, random, () => gaussian(random), DEMO_NOW);

  // ------------------------------------------------------------- facturación
  const invoices: Invoice[] = [
    {
      id: "fac-2026-0001",
      organization_id: ORG_MUNI,
      number: "FC-0001-00000001",
      concept: "Monitor de Opinión Pública 2026 — Ola 1",
      amount: 850000,
      currency: "ARS",
      status: "pagada",
      issued_at: daysAgo(200),
      due_at: daysAgo(170),
      paid_at: daysAgo(175),
      notes: null,
      created_by: "usr-admin",
      created_at: daysAgo(200),
      updated_at: daysAgo(175),
    },
    {
      id: "fac-2026-0002",
      organization_id: ORG_MUNI,
      number: "FC-0001-00000002",
      concept: "Monitor de Opinión Pública 2026 — Ola 2",
      amount: 850000,
      currency: "ARS",
      status: "pagada",
      issued_at: daysAgo(110),
      due_at: daysAgo(80),
      paid_at: daysAgo(85),
      notes: null,
      created_by: "usr-admin",
      created_at: daysAgo(110),
      updated_at: daysAgo(85),
    },
    {
      id: "fac-2026-0003",
      organization_id: ORG_MUNI,
      number: "FC-0001-00000003",
      concept: "Encuestadores adicionales — refuerzo zona Este",
      amount: 150000,
      currency: "ARS",
      status: "vencida",
      issued_at: daysAgo(65),
      due_at: daysAgo(35),
      paid_at: null,
      notes: "Reclamar por mail a la dirección de administración.",
      created_by: "usr-admin",
      created_at: daysAgo(65),
      updated_at: daysAgo(65),
    },
    {
      id: "fac-2026-0004",
      organization_id: ORG_MUNI,
      number: "FC-0001-00000004",
      concept: "Monitor de Opinión Pública 2026 — Ola 3 (Agosto 2026)",
      amount: 920000,
      currency: "ARS",
      status: "pendiente",
      issued_at: daysAgo(20),
      due_at: daysAgo(-10),
      paid_at: null,
      notes: null,
      created_by: "usr-admin",
      created_at: daysAgo(20),
      updated_at: daysAgo(20),
    },
    {
      id: "fac-2026-0005",
      organization_id: ORG_UNI,
      number: "FC-0002-00000001",
      concept: "Piloto clima institucional — activación",
      amount: 180000,
      currency: "ARS",
      status: "pendiente",
      issued_at: daysAgo(30),
      due_at: daysAgo(0),
      paid_at: null,
      notes: "Primera factura del piloto: incluye alta y capacitación.",
      created_by: "usr-admin",
      created_at: daysAgo(30),
      updated_at: daysAgo(30),
    },
  ];

  // ------------------------------------------------------- banco de dirigentes
  const dirigentes: Dirigente[] = [
    {
      id: "dir-intendente",
      organization_id: ORG_MUNI,
      name: "Ricardo Salvatierra",
      role: "Intendente",
      affiliation: "Frente Vecinal",
      photo_url: null,
      notes: "Referente principal de la gestión municipal.",
      created_by: "usr-direccion",
      created_at: daysAgo(200),
      updated_at: daysAgo(20),
    },
    {
      id: "dir-concejal-oposicion",
      organization_id: ORG_MUNI,
      name: "Marina Quiroga",
      role: "Concejala",
      affiliation: "Unión Departamental",
      photo_url: null,
      notes: "Principal referente de la oposición en el Concejo.",
      created_by: "usr-direccion",
      created_at: daysAgo(200),
      updated_at: daysAgo(20),
    },
    {
      id: "dir-secretario-obras",
      organization_id: ORG_MUNI,
      name: "Hugo Pereyra",
      role: "Secretario de Obras Públicas",
      affiliation: "Frente Vecinal",
      photo_url: null,
      notes: null,
      created_by: "usr-direccion",
      created_at: daysAgo(150),
      updated_at: daysAgo(20),
    },
  ];

  const dirigente_mediciones: DirigenteMedicion[] = [
    {
      id: "dmed-intendente-1",
      dirigente_id: "dir-intendente",
      project_id: "proj-monitor",
      conocimiento: 88,
      imagen_positiva: 41,
      imagen_negativa: 33,
      segmento: "Total municipio",
      notes: null,
      measured_at: daysAgo(200),
      created_by: "usr-direccion",
      created_at: daysAgo(200),
    },
    {
      id: "dmed-intendente-2",
      dirigente_id: "dir-intendente",
      project_id: "proj-monitor",
      conocimiento: 91,
      imagen_positiva: 38,
      imagen_negativa: 37,
      segmento: "Total municipio",
      notes: "Cae imagen positiva tras el aumento de tasas.",
      measured_at: daysAgo(110),
      created_by: "usr-direccion",
      created_at: daysAgo(110),
    },
    {
      id: "dmed-intendente-3",
      dirigente_id: "dir-intendente",
      project_id: "proj-monitor",
      conocimiento: 93,
      imagen_positiva: 44,
      imagen_negativa: 31,
      segmento: "Total municipio",
      notes: "Recupera imagen con el anuncio de obras en Zona Sur.",
      measured_at: daysAgo(20),
      created_by: "usr-direccion",
      created_at: daysAgo(20),
    },
    {
      id: "dmed-oposicion-1",
      dirigente_id: "dir-concejal-oposicion",
      project_id: "proj-monitor",
      conocimiento: 46,
      imagen_positiva: 22,
      imagen_negativa: 19,
      segmento: "Total municipio",
      notes: null,
      measured_at: daysAgo(200),
      created_by: "usr-direccion",
      created_at: daysAgo(200),
    },
    {
      id: "dmed-oposicion-2",
      dirigente_id: "dir-concejal-oposicion",
      project_id: "proj-monitor",
      conocimiento: 52,
      imagen_positiva: 27,
      imagen_negativa: 21,
      segmento: "Total municipio",
      notes: "Sube conocimiento tras su exposición en el debate de tasas.",
      measured_at: daysAgo(20),
      created_by: "usr-direccion",
      created_at: daysAgo(20),
    },
    {
      id: "dmed-obras-1",
      dirigente_id: "dir-secretario-obras",
      project_id: "proj-monitor",
      conocimiento: 34,
      imagen_positiva: 18,
      imagen_negativa: 12,
      segmento: "Total municipio",
      notes: "Bajo conocimiento: perfil técnico, poca exposición pública.",
      measured_at: daysAgo(110),
      created_by: "usr-direccion",
      created_at: daysAgo(110),
    },
  ];

  return {
    organizations,
    profiles,
    projects,
    surveys,
    questions,
    question_options,
    survey_assignments,
    survey_zone_quotas: [],
    responses,
    answers,
    ai_reports,
    social_trackers: social.trackers,
    social_posts: social.posts,
    social_sources: [],
    social_imports: [],
    invoices,
    dirigentes,
    dirigente_mediciones,
  };
}
