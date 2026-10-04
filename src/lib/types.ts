// ---------------------------------------------------------------------------
// Tipos del dominio + tipado de la base para el cliente de Supabase.
// Espejo de supabase/migrations/*.sql
// ---------------------------------------------------------------------------

export type UserRole = "super_admin" | "org_admin" | "org_analyst" | "surveyor";
export type OrgType = "gobierno" | "institucion" | "ong" | "privado";
export type OrgStatus = "activa" | "suspendida" | "prueba";
export type SurveyStatus = "borrador" | "activa" | "pausada" | "cerrada";
export type QuestionType =
  | "texto_corto"
  | "texto_largo"
  | "opcion_unica"
  | "opcion_multiple"
  | "escala"
  | "numero"
  | "fecha"
  | "si_no";
export type ResponseStatus = "en_curso" | "completada" | "descartada";
export type ReportStatus = "generando" | "listo" | "error";
export type ReportKind = "ejecutivo" | "tecnico" | "comunicacional" | "comparativo";
export type InvoiceStatus = "pendiente" | "pagada" | "vencida" | "anulada";

/** Las 10 líneas de producto del portfolio de investigación. */
export type ServiceLine =
  | "opinion_publica"
  | "tracking"
  | "monitor_gestion"
  | "inteligencia_territorial"
  | "banco_dirigentes"
  | "cualitativo"
  | "laboratorio_opinion"
  | "radar_conversacion"
  | "estudios_tematicos"
  | "flash";

export type Organization = {
  id: string;
  name: string;
  slug: string;
  type: OrgType;
  status: OrgStatus;
  contact_email: string | null;
  contact_phone: string | null;
  country: string | null;
  region: string | null;
  logo_url: string | null;
  brand_color: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type Profile = {
  id: string;
  organization_id: string | null;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: UserRole;
  avatar_url: string | null;
  is_active: boolean;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
}

export type Project = {
  id: string;
  organization_id: string;
  name: string;
  description: string | null;
  color: string | null;
  service_line: ServiceLine;
  created_by: string | null;
  created_at: string;
}

export type Survey = {
  id: string;
  organization_id: string;
  project_id: string | null;
  title: string;
  description: string | null;
  status: SurveyStatus;
  target_responses: number;
  starts_at: string | null;
  ends_at: string | null;
  geography: string | null;
  methodology: string | null;
  /** Canal web: la encuesta se puede responder por link o widget embebido. */
  web_enabled: boolean;
  public_token: string | null;
  web_settings: WebSettings;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type WidgetMode = "inline" | "flotante" | "emergente";

export type WebSettings = {
  accent?: string | null;
  welcome_title?: string | null;
  welcome_text?: string | null;
  thanks_title?: string | null;
  thanks_text?: string | null;
  button_label?: string | null;
  mode?: WidgetMode | null;
  /** Una respuesta por dispositivo (huella anónima, sin datos personales). */
  one_per_device?: boolean | null;
  /** Segundos antes de abrir la ventana emergente. */
  popup_delay?: number | null;
};

export type ResponseChannel = "campo" | "web";

export type Question = {
  id: string;
  survey_id: string;
  position: number;
  type: QuestionType;
  text: string;
  help_text: string | null;
  is_required: boolean;
  section: string | null;
  /** Escala y número: rango válido. Opción múltiple: `max_value` es el tope de marcas. */
  min_value: number | null;
  max_value: number | null;
  logic: QuestionLogic | null;
  created_at: string;
}

/**
 * Lógica de salto. Los `values` son ids de opción para preguntas de opción y
 * "si" / "no" para las de Sí/No: es lo mismo que queda guardado en la respuesta.
 */
export type QuestionLogic = {
  /** La pregunta solo se hace si la respuesta a `question_id` incluye alguno de `values`. */
  show_if?: { question_id: string; values: string[] } | null;
  /** Si la respuesta a ESTA pregunta incluye alguno de estos valores, la entrevista termina (filtro). */
  end_if?: string[] | null;
};

export type QuestionOption = {
  id: string;
  question_id: string;
  position: number;
  label: string;
  value: string | null;
  is_exclusive: boolean;
}

export type SurveyAssignment = {
  id: string;
  survey_id: string;
  surveyor_id: string;
  quota: number;
  zone: string | null;
  created_at: string;
}

export type SurveyZoneQuota = {
  id: string;
  assignment_id: string;
  zone: string;
  quota: number;
}

export type SurveyResponse = {
  id: string;
  survey_id: string;
  organization_id: string;
  surveyor_id: string | null;
  status: ResponseStatus;
  channel: ResponseChannel;
  /** Web: página donde estaba embebido el widget (origen + ruta, sin query). */
  source_url: string | null;
  /** Web: hash anónimo del dispositivo, para limitar a una respuesta. */
  respondent_hash: string | null;
  zone: string | null;
  latitude: number | null;
  longitude: number | null;
  duration_seconds: number | null;
  started_at: string;
  submitted_at: string | null;
}

export type Answer = {
  id: string;
  response_id: string;
  question_id: string;
  value_text: string | null;
  value_number: number | null;
  value_date: string | null;
  option_ids: string[];
  created_at: string;
}

export type AiReport = {
  id: string;
  survey_id: string;
  organization_id: string;
  title: string;
  kind: ReportKind;
  status: ReportStatus;
  model: string | null;
  audience: string | null;
  focus: string | null;
  content: string | null;
  highlights: ReportHighlight[];
  error_message: string | null;
  created_by: string | null;
  created_at: string;
}

export type ReportHighlight = {
  titulo: string;
  detalle: string;
  metrica?: string | null;
}

export type AiCall = {
  id: string;
  organization_id: string | null;
  action: "classify" | "report" | "ask" | "status";
  provider: "gemini" | "jev" | "none";
  model: string | null;
  status: "ok" | "error";
  error_message: string | null;
  created_by: string | null;
  created_at: string;
}

// --- Humor en redes ----------------------------------------------------------

export type SocialNetwork = "x" | "facebook" | "instagram" | "tiktok" | "youtube" | "noticias" | "otros";
export type SentimentLabel = "positivo" | "neutral" | "negativo";
export type Emotion = "enojo" | "miedo" | "tristeza" | "alegria" | "confianza" | "sorpresa";

/** Un tema que la organización sigue en redes: nombre y palabras clave. */
export type SocialTracker = {
  id: string;
  organization_id: string;
  name: string;
  keywords: string[];
  exclude: string[];
  is_active: boolean;
  created_at: string;
};

export type SocialPost = {
  id: string;
  organization_id: string;
  network: SocialNetwork;
  external_id: string | null;
  author: string | null;
  url: string | null;
  text: string;
  published_at: string;
  engagement: number;
  /** -1 (muy negativo) a 1 (muy positivo). */
  sentiment: number;
  label: SentimentLabel;
  emotion: Emotion | null;
  topics: string[];
  classified_by: string;
  created_at: string;
};

export type SocialSourceKind = "rss" | "noticias";

export type SocialSource = {
  id: string;
  organization_id: string;
  kind: SocialSourceKind;
  name: string;
  query: string | null;
  url: string | null;
  is_active: boolean;
  last_fetched_at: string | null;
  last_error: string | null;
  created_at: string;
};

export type SocialImport = {
  id: string;
  organization_id: string;
  source_id: string | null;
  mode: string;
  inserted: number;
  duplicates: number;
  status: "ok" | "error";
  error_message: string | null;
  created_at: string;
};

export const NETWORK_LABEL: Record<SocialNetwork, string> = {
  x: "X / Twitter",
  facebook: "Facebook",
  instagram: "Instagram",
  tiktok: "TikTok",
  youtube: "YouTube",
  noticias: "Portales de noticias",
  otros: "Otras fuentes",
};

export const EMOTION_LABEL: Record<Emotion, string> = {
  enojo: "Enojo",
  miedo: "Miedo",
  tristeza: "Tristeza",
  alegria: "Alegría",
  confianza: "Confianza",
  sorpresa: "Sorpresa",
};

// --- Facturación --------------------------------------------------------------

/** Facturación interna de la consultora hacia cada organización cliente. */
export type Invoice = {
  id: string;
  organization_id: string;
  number: string;
  concept: string;
  amount: number;
  currency: string;
  status: InvoiceStatus;
  issued_at: string;
  due_at: string | null;
  paid_at: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// --- Banco de dirigentes ------------------------------------------------------

/** Ficha longitudinal de un dirigente: conocimiento e imagen medidos en el tiempo. */
export type Dirigente = {
  id: string;
  organization_id: string;
  name: string;
  role: string | null;
  affiliation: string | null;
  photo_url: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Una medición puntual de un dirigente, opcionalmente atada al proyecto que la generó. */
export type DirigenteMedicion = {
  id: string;
  dirigente_id: string;
  project_id: string | null;
  /** Porcentaje 0-100 que reconoce al dirigente. */
  conocimiento: number | null;
  /** Porcentaje 0-100 con imagen positiva. */
  imagen_positiva: number | null;
  /** Porcentaje 0-100 con imagen negativa. */
  imagen_negativa: number | null;
  segmento: string | null;
  notes: string | null;
  measured_at: string;
  created_by: string | null;
  created_at: string;
}

// --- Composiciones usadas en la UI -----------------------------------------

export type QuestionWithOptions = Question & { options: QuestionOption[] };

export type SurveyWithMeta = Survey & {
  organization?: Pick<Organization, "id" | "name" | "slug"> | null;
  project?: Pick<Project, "id" | "name"> | null;
  response_count?: number;
};

// --- Tipado para @supabase/supabase-js --------------------------------------

type TableDef<Row, Rel extends unknown[] = []> = {
  Row: Row;
  Insert: Partial<Row>;
  Update: Partial<Row>;
  Relationships: Rel;
};

/** Atajo para declarar una clave foránea sin repetir la forma completa. */
type FK<Col extends string, Ref extends string> = {
  foreignKeyName: `fk_${Col}_${Ref}`;
  columns: [Col];
  isOneToOne: false;
  referencedRelation: Ref;
  referencedColumns: ["id"];
};

export type Database = {
  public: {
    Tables: {
      organizations: TableDef<Organization>;
      profiles: TableDef<Profile, [FK<"organization_id", "organizations">]>;
      projects: TableDef<
        Project,
        [FK<"organization_id", "organizations">, FK<"created_by", "profiles">]
      >;
      surveys: TableDef<
        Survey,
        [
          FK<"organization_id", "organizations">,
          FK<"project_id", "projects">,
          FK<"created_by", "profiles">,
        ]
      >;
      questions: TableDef<Question, [FK<"survey_id", "surveys">]>;
      question_options: TableDef<QuestionOption, [FK<"question_id", "questions">]>;
      survey_assignments: TableDef<
        SurveyAssignment,
        [FK<"survey_id", "surveys">, FK<"surveyor_id", "profiles">]
      >;
      survey_zone_quotas: TableDef<SurveyZoneQuota, [FK<"assignment_id", "survey_assignments">]>;
      responses: TableDef<
        SurveyResponse,
        [
          FK<"survey_id", "surveys">,
          FK<"organization_id", "organizations">,
          FK<"surveyor_id", "profiles">,
        ]
      >;
      answers: TableDef<Answer, [FK<"response_id", "responses">, FK<"question_id", "questions">]>;
      social_trackers: TableDef<SocialTracker, [FK<"organization_id", "organizations">]>;
      social_posts: TableDef<SocialPost, [FK<"organization_id", "organizations">]>;
      social_sources: TableDef<SocialSource, [FK<"organization_id", "organizations">]>;
      social_imports: TableDef<
        SocialImport,
        [FK<"organization_id", "organizations">, FK<"source_id", "social_sources">]
      >;
      ai_reports: TableDef<
        AiReport,
        [
          FK<"survey_id", "surveys">,
          FK<"organization_id", "organizations">,
          FK<"created_by", "profiles">,
        ]
      >;
      ai_calls: TableDef<
        AiCall,
        [FK<"organization_id", "organizations">, FK<"created_by", "profiles">]
      >;
      invoices: TableDef<
        Invoice,
        [FK<"organization_id", "organizations">, FK<"created_by", "profiles">]
      >;
      dirigentes: TableDef<
        Dirigente,
        [FK<"organization_id", "organizations">, FK<"created_by", "profiles">]
      >;
      dirigente_mediciones: TableDef<
        DirigenteMedicion,
        [FK<"dirigente_id", "dirigentes">, FK<"project_id", "projects">, FK<"created_by", "profiles">]
      >;
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      user_role: UserRole;
      org_type: OrgType;
      org_status: OrgStatus;
      survey_status: SurveyStatus;
      question_type: QuestionType;
      response_status: ResponseStatus;
      report_status: ReportStatus;
      report_kind: ReportKind;
      invoice_status: InvoiceStatus;
      service_line: ServiceLine;
    };
    CompositeTypes: { [_ in never]: never };
  };
};

// --- Etiquetas legibles ------------------------------------------------------

export const ROLE_LABEL: Record<UserRole, string> = {
  super_admin: "Administración central",
  org_admin: "Administrador de cliente",
  org_analyst: "Analista",
  surveyor: "Encuestador",
};

export const SURVEY_STATUS_LABEL: Record<SurveyStatus, string> = {
  borrador: "Borrador",
  activa: "En campo",
  pausada: "Pausada",
  cerrada: "Cerrada",
};

export const ORG_TYPE_LABEL: Record<OrgType, string> = {
  gobierno: "Gobierno",
  institucion: "Institución",
  ong: "ONG",
  privado: "Privado",
};

export const ORG_STATUS_LABEL: Record<OrgStatus, string> = {
  activa: "Activa",
  suspendida: "Suspendida",
  prueba: "En prueba",
};

export const QUESTION_TYPE_LABEL: Record<QuestionType, string> = {
  texto_corto: "Texto corto",
  texto_largo: "Texto largo",
  opcion_unica: "Opción única",
  opcion_multiple: "Opción múltiple",
  escala: "Escala numérica",
  numero: "Número",
  fecha: "Fecha",
  si_no: "Sí / No",
};

export const REPORT_KIND_LABEL: Record<ReportKind, string> = {
  ejecutivo: "Informe ejecutivo",
  tecnico: "Informe técnico",
  comunicacional: "Placa comunicacional",
  comparativo: "Análisis comparativo",
};

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  pendiente: "Pendiente",
  pagada: "Pagada",
  vencida: "Vencida",
  anulada: "Anulada",
};

export const SERVICE_LINE_LABEL: Record<ServiceLine, string> = {
  opinion_publica: "Estudios de opinión pública",
  tracking: "Tracking político",
  monitor_gestion: "Monitor de gestión",
  inteligencia_territorial: "Inteligencia territorial",
  banco_dirigentes: "Banco de dirigentes",
  cualitativo: "Investigación cualitativa",
  laboratorio_opinion: "Laboratorio de opinión",
  radar_conversacion: "Radar de conversación pública",
  estudios_tematicos: "Estudios temáticos",
  flash: "Estudios Flash",
};

export const SERVICE_LINE_DESCRIPTION: Record<ServiceLine, string> = {
  opinion_publica:
    "Imagen, gestión, problemas, expectativas e intención de voto en un territorio.",
  tracking:
    "Mediciones comparables en el tiempo con indicadores nucleares estables.",
  monitor_gestion:
    "Seguimiento de servicios, prioridades y demandas territoriales para gobiernos.",
  inteligencia_territorial:
    "Mapas y cruces geográficos cuando el diseño y la muestra lo permiten.",
  banco_dirigentes:
    "Fichas longitudinales de conocimiento, imagen y atributos de dirigentes.",
  cualitativo: "Focus groups, entrevistas en profundidad e informantes clave.",
  laboratorio_opinion:
    "Pruebas de comprensión y evaluación de formulaciones con diseños experimentales.",
  radar_conversacion:
    "Análisis de fuentes digitales públicas: temas, volumen y evolución.",
  estudios_tematicos: "Investigación propia sobre agenda pública y temas específicos.",
  flash: "Operativos breves para preguntas puntuales, con alcance acotado.",
};
