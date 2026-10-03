import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Profile } from "@/lib/types";
import { demoTables, demoId } from "@/lib/demo/store";
import type { DemoTables } from "@/lib/demo/dataset";

type TableName = keyof DemoTables;
type Row = Record<string, unknown>;

type Filter = { column: string; op: "eq" | "neq" | "in" | "gte" | "lte"; value: unknown };
type Order = { column: string; ascending: boolean };

// ---------------------------------------------------------------------------
// Relaciones para resolver los select embebidos, del tipo
// `.select("*, organizations(name)")`. Todas son to-one.
// ---------------------------------------------------------------------------
const EMBEDS: Record<string, { fk: string; target: TableName }> = {
  "surveys.organizations": { fk: "organization_id", target: "organizations" },
  "surveys.projects": { fk: "project_id", target: "projects" },
  "profiles.organizations": { fk: "organization_id", target: "organizations" },
  "projects.organizations": { fk: "organization_id", target: "organizations" },
  "survey_assignments.profiles": { fk: "surveyor_id", target: "profiles" },
  "survey_assignments.surveys": { fk: "survey_id", target: "surveys" },
  "responses.profiles": { fk: "surveyor_id", target: "profiles" },
  "responses.surveys": { fk: "survey_id", target: "surveys" },
  "ai_reports.surveys": { fk: "survey_id", target: "surveys" },
  "answers.questions": { fk: "question_id", target: "questions" },
  "invoices.organizations": { fk: "organization_id", target: "organizations" },
  "dirigentes.organizations": { fk: "organization_id", target: "organizations" },
  "dirigente_mediciones.dirigentes": { fk: "dirigente_id", target: "dirigentes" },
  "dirigente_mediciones.projects": { fk: "project_id", target: "projects" },
};

const HAS_UPDATED_AT: TableName[] = ["organizations", "profiles", "surveys", "invoices", "dirigentes"];

/** Equivalente de los ON DELETE CASCADE del esquema. */
const CASCADES: Partial<Record<TableName, { table: TableName; fk: string }[]>> = {
  organizations: [
    { table: "surveys", fk: "organization_id" },
    { table: "projects", fk: "organization_id" },
    { table: "responses", fk: "organization_id" },
    { table: "ai_reports", fk: "organization_id" },
    { table: "social_trackers", fk: "organization_id" },
    { table: "social_posts", fk: "organization_id" },
    { table: "dirigentes", fk: "organization_id" },
  ],
  surveys: [
    { table: "questions", fk: "survey_id" },
    { table: "survey_assignments", fk: "survey_id" },
    { table: "responses", fk: "survey_id" },
    { table: "ai_reports", fk: "survey_id" },
  ],
  questions: [
    { table: "question_options", fk: "question_id" },
    { table: "answers", fk: "question_id" },
  ],
  responses: [{ table: "answers", fk: "response_id" }],
  dirigentes: [{ table: "dirigente_mediciones", fk: "dirigente_id" }],
};

function cascadeDelete(table: TableName, removedIds: unknown[]) {
  const children = CASCADES[table];
  if (!children || removedIds.length === 0) return;

  const tables = demoTables();
  for (const child of children) {
    const store = tables[child.table] as unknown as Row[];
    const doomed = store.filter((r) => removedIds.includes(r[child.fk]));
    if (doomed.length === 0) continue;

    const survivors = store.filter((r) => !removedIds.includes(r[child.fk]));
    store.length = 0;
    store.push(...survivors);
    cascadeDelete(child.table, doomed.map((r) => r.id));
  }
}

/** Valores que Postgres pondría por defecto al insertar. */
function withDefaults(table: TableName, row: Row): Row {
  const now = new Date().toISOString();
  const base: Row = { ...row };

  if (base.id === undefined) base.id = demoId(table.slice(0, 3));
  if (base.created_at === undefined) base.created_at = now;
  if (HAS_UPDATED_AT.includes(table) && base.updated_at === undefined) base.updated_at = now;

  const perTable: Partial<Record<TableName, Row>> = {
    organizations: { type: "gobierno", status: "prueba", country: "Argentina", brand_color: "#1e40af" },
    profiles: { role: "surveyor", is_active: true, full_name: "" },
    projects: { service_line: "opinion_publica", color: null, description: null },
    surveys: { status: "borrador", target_responses: 400, web_enabled: false, public_token: null, web_settings: {} },
    questions: { position: 0, is_required: true, type: "opcion_unica", logic: null },
    question_options: { position: 0, is_exclusive: false },
    survey_assignments: { quota: 50 },
    responses: { status: "en_curso", started_at: now, channel: "campo", source_url: null, respondent_hash: null },
    answers: { option_ids: [] },
    ai_reports: { status: "generando", kind: "ejecutivo", highlights: [] },
    social_trackers: { is_active: true, keywords: [], exclude: [] },
    social_posts: { engagement: 0, sentiment: 0, label: "neutral", topics: [], classified_by: "lexico", emotion: null },
    invoices: { currency: "ARS", status: "pendiente", concept: "Servicio de encuestas", issued_at: now, due_at: null, paid_at: null, notes: null },
    dirigentes: { role: null, affiliation: null, photo_url: null, notes: null },
    dirigente_mediciones: {
      project_id: null,
      conocimiento: null,
      imagen_positiva: null,
      imagen_negativa: null,
      segmento: null,
      notes: null,
      measured_at: now,
    },
  };

  for (const [key, value] of Object.entries(perTable[table] ?? {})) {
    if (base[key] === undefined) base[key] = value;
  }

  // Las columnas nulas explícitas evitan `undefined` en la UI.
  return base;
}

// ---------------------------------------------------------------------------
// Emulación de RLS: cada rol ve exactamente lo que le permiten las policies
// de supabase/migrations/*_rls.sql. Sin esto la demo mentiría justo sobre lo
// que más importa mostrar, que es el aislamiento entre clientes.
// ---------------------------------------------------------------------------
function visibleRows(table: TableName, viewer: Profile | null, tables: DemoTables): Row[] {
  const all = tables[table] as unknown as Row[];
  if (!viewer) return [];
  if (viewer.role === "super_admin") return all;

  const org = viewer.organization_id;

  const assignedSurveyIds = new Set(
    tables.survey_assignments
      .filter((a) => a.surveyor_id === viewer.id)
      .map((a) => a.survey_id),
  );

  const readableSurveyIds = new Set(
    tables.surveys
      .filter((s) => s.organization_id === org || assignedSurveyIds.has(s.id))
      .map((s) => s.id),
  );

  const readableResponseIds = new Set(
    tables.responses
      .filter((r) => r.surveyor_id === viewer.id || r.organization_id === org)
      .map((r) => r.id),
  );

  switch (table) {
    case "organizations":
      return all.filter((r) => r.id === org);
    case "profiles":
      return all.filter((r) => r.id === viewer.id || (org != null && r.organization_id === org));
    case "projects":
      return all.filter((r) => r.organization_id === org);
    case "surveys":
      return all.filter((r) => readableSurveyIds.has(r.id as string));
    case "questions":
      return all.filter((r) => readableSurveyIds.has(r.survey_id as string));
    case "question_options": {
      const readableQuestionIds = new Set(
        tables.questions
          .filter((q) => readableSurveyIds.has(q.survey_id))
          .map((q) => q.id),
      );
      return all.filter((r) => readableQuestionIds.has(r.question_id as string));
    }
    case "survey_assignments":
      return all.filter(
        (r) => r.surveyor_id === viewer.id || readableSurveyIds.has(r.survey_id as string),
      );
    case "responses":
      return all.filter((r) => readableResponseIds.has(r.id as string));
    case "answers":
      return all.filter((r) => readableResponseIds.has(r.response_id as string));
    case "ai_reports":
    case "social_trackers":
    case "social_posts":
    case "dirigentes":
      return all.filter((r) => r.organization_id === org);
    case "dirigente_mediciones": {
      const ownDirigenteIds = new Set(
        tables.dirigentes.filter((d) => d.organization_id === org).map((d) => d.id),
      );
      return all.filter((r) => ownDirigenteIds.has(r.dirigente_id as string));
    }
    case "invoices":
      // La facturación es interna de la consultora: solo la ve super_admin
      // (ya resuelto arriba), ningún otro rol tiene acceso.
      return [];
  }
}

// ---------------------------------------------------------------------------
// Parseo del string de select
// ---------------------------------------------------------------------------
type ParsedSelect = { columns: string[] | "*"; embeds: { alias: string; columns: string[] | "*" }[] };

function parseSelect(select: string): ParsedSelect {
  const tokens: string[] = [];
  let depth = 0;
  let current = "";

  for (const char of select) {
    if (char === "(") depth += 1;
    if (char === ")") depth -= 1;
    if (char === "," && depth === 0) {
      tokens.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) tokens.push(current.trim());

  const columns: string[] = [];
  const embeds: ParsedSelect["embeds"] = [];
  let star = false;

  for (const token of tokens) {
    const match = /^([a-z_]+)\(([\s\S]*)\)$/.exec(token);
    if (match) {
      const inner = match[2].trim();
      embeds.push({
        alias: match[1],
        columns: inner === "*" ? "*" : inner.split(",").map((c) => c.trim()),
      });
    } else if (token === "*") {
      star = true;
    } else {
      columns.push(token);
    }
  }

  return { columns: star ? "*" : columns, embeds };
}

function project(row: Row, columns: string[] | "*"): Row {
  if (columns === "*") return { ...row };
  const out: Row = {};
  for (const c of columns) out[c] = row[c];
  return out;
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "es");
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------
type Result<T> = { data: T; error: { message: string } | null; count: number | null };

class DemoQuery implements PromiseLike<Result<unknown>> {
  private filters: Filter[] = [];
  private orders: Order[] = [];
  private limitValue: number | null = null;
  private offsetValue = 0;
  private selectString: string | null = null;
  private head = false;
  private wantsCount = false;
  private mode: "select" | "insert" | "update" | "delete" | "upsert" = "select";
  private payload: Row[] = [];
  private conflictColumns: string[] = [];

  constructor(
    private table: TableName,
    private viewer: Profile | null,
    private bypassRls: boolean,
  ) {}

  select(select = "*", options?: { count?: string; head?: boolean }) {
    this.selectString = select;
    this.head = options?.head ?? false;
    this.wantsCount = Boolean(options?.count);
    if (this.mode === "select") this.mode = "select";
    return this;
  }

  insert(values: Row | Row[]) {
    this.mode = "insert";
    this.payload = Array.isArray(values) ? values : [values];
    return this;
  }

  update(patch: Row) {
    this.mode = "update";
    this.payload = [patch];
    return this;
  }

  upsert(values: Row | Row[], options?: { onConflict?: string }) {
    this.mode = "upsert";
    this.payload = Array.isArray(values) ? values : [values];
    this.conflictColumns = (options?.onConflict ?? "id").split(",").map((c) => c.trim());
    return this;
  }

  delete() {
    this.mode = "delete";
    return this;
  }

  eq(column: string, value: unknown) {
    this.filters.push({ column, op: "eq", value });
    return this;
  }

  in(column: string, values: unknown[]) {
    this.filters.push({ column, op: "in", value: values });
    return this;
  }

  neq(column: string, value: unknown) {
    this.filters.push({ column, op: "neq", value });
    return this;
  }

  gte(column: string, value: unknown) {
    this.filters.push({ column, op: "gte", value });
    return this;
  }

  lte(column: string, value: unknown) {
    this.filters.push({ column, op: "lte", value });
    return this;
  }

  /** Paginado inclusivo, igual que PostgREST: range(0, 999) son 1000 filas. */
  range(from: number, to: number) {
    this.offsetValue = from;
    this.limitValue = to - from + 1;
    return this;
  }

  order(column: string, options?: { ascending?: boolean }) {
    this.orders.push({ column, ascending: options?.ascending ?? true });
    return this;
  }

  limit(n: number) {
    this.limitValue = n;
    return this;
  }

  maybeSingle() {
    return this.run().then(({ data, error, count }) => {
      const rows = (data as Row[]) ?? [];
      return { data: rows[0] ?? null, error, count };
    });
  }

  single() {
    return this.run().then(({ data, error, count }) => {
      const rows = (data as Row[]) ?? [];
      if (!error && rows.length === 0) {
        return { data: null, error: { message: "No se encontró la fila" }, count };
      }
      return { data: rows[0] ?? null, error, count };
    });
  }

  then<R1 = Result<unknown>, R2 = never>(
    onfulfilled?: ((value: Result<unknown>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.run().then(onfulfilled, onrejected);
  }

  // -------------------------------------------------------------------------

  private matches(row: Row): boolean {
    return this.filters.every((f) => {
      const cell = row[f.column];
      switch (f.op) {
        case "eq":
          return cell === f.value;
        case "neq":
          return cell !== f.value;
        case "in":
          return Array.isArray(f.value) && f.value.includes(cell);
        case "gte":
          return cell !== null && cell !== undefined && compare(cell, f.value) >= 0;
        case "lte":
          return cell !== null && cell !== undefined && compare(cell, f.value) <= 0;
      }
    });
  }

  private async run(): Promise<Result<unknown>> {
    const tables = demoTables();
    const store = tables[this.table] as unknown as Row[];

    // --- escrituras -------------------------------------------------------
    if (this.mode === "insert" || this.mode === "upsert") {
      const written: Row[] = [];

      for (const raw of this.payload) {
        if (this.mode === "upsert") {
          const existing = store.find((r) =>
            this.conflictColumns.every((c) => r[c] === raw[c]),
          );
          if (existing) {
            Object.assign(existing, raw);
            written.push(existing);
            continue;
          }
        }
        const row = withDefaults(this.table, raw);
        store.push(row);
        written.push(row);
      }

      const cols = this.selectString ? parseSelect(this.selectString).columns : "*";
      return { data: written.map((r) => project(r, cols)), error: null, count: written.length };
    }

    if (this.mode === "update") {
      const patch = this.payload[0];
      const touched = store.filter((r) => this.matches(r));
      for (const row of touched) {
        Object.assign(row, patch);
        if (HAS_UPDATED_AT.includes(this.table)) row.updated_at = new Date().toISOString();
      }
      const cols = this.selectString ? parseSelect(this.selectString).columns : "*";
      return { data: touched.map((r) => project(r, cols)), error: null, count: touched.length };
    }

    if (this.mode === "delete") {
      const doomed = store.filter((r) => this.matches(r));
      const survivors = store.filter((r) => !this.matches(r));
      store.length = 0;
      store.push(...survivors);
      cascadeDelete(
        this.table,
        doomed.map((r) => r.id),
      );
      return { data: [], error: null, count: doomed.length };
    }

    // --- lectura ----------------------------------------------------------
    const source = this.bypassRls ? store : visibleRows(this.table, this.viewer, tables);
    let rows = source.filter((r) => this.matches(r));

    if (this.orders.length) {
      rows = [...rows].sort((a, b) => {
        for (const o of this.orders) {
          const diff = compare(a[o.column], b[o.column]);
          if (diff !== 0) return o.ascending ? diff : -diff;
        }
        return 0;
      });
    }

    const total = rows.length;
    if (this.offsetValue || this.limitValue !== null) {
      rows = rows.slice(
        this.offsetValue,
        this.limitValue === null ? undefined : this.offsetValue + this.limitValue,
      );
    }

    if (this.head) {
      return { data: null, error: null, count: total };
    }

    const parsed = parseSelect(this.selectString ?? "*");
    const data = rows.map((row) => {
      const out = project(row, parsed.columns);
      for (const embed of parsed.embeds) {
        const rel = EMBEDS[`${this.table}.${embed.alias}`];
        if (!rel) {
          out[embed.alias] = null;
          continue;
        }
        const target = tables[rel.target] as unknown as Row[];
        const match = target.find((t) => t.id === row[rel.fk]);
        out[embed.alias] = match ? project(match, embed.columns) : null;
      }
      return out;
    });

    return { data, error: null, count: this.wantsCount ? total : null };
  }
}

// ---------------------------------------------------------------------------
// Cliente
// ---------------------------------------------------------------------------
function buildClient(viewer: Profile | null, bypassRls: boolean) {
  return {
    from(table: TableName) {
      return new DemoQuery(table, viewer, bypassRls);
    },
    auth: {
      async getUser() {
        if (!viewer) return { data: { user: null }, error: null };
        return {
          data: {
            user: {
              id: viewer.id,
              email: viewer.email,
              aud: "authenticated",
              app_metadata: {},
              user_metadata: { full_name: viewer.full_name },
              created_at: viewer.created_at,
            },
          },
          error: null,
        };
      },
      async signOut() {
        return { error: null };
      },
      admin: {
        async createUser(params: {
          email: string;
          user_metadata?: { full_name?: string; role?: string };
        }) {
          const tables = demoTables();
          const exists = tables.profiles.some((p) => p.email === params.email);
          if (exists) {
            return { data: { user: null }, error: { message: "Ya existe un usuario con ese correo" } };
          }
          const id = demoId("usr");
          tables.profiles.push({
            id,
            organization_id: null,
            full_name: params.user_metadata?.full_name ?? "",
            email: params.email,
            phone: null,
            role: (params.user_metadata?.role as Profile["role"]) ?? "surveyor",
            avatar_url: null,
            is_active: true,
            last_seen_at: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          return { data: { user: { id, email: params.email } }, error: null };
        },
      },
    },
  };
}

/**
 * El cast es deliberado: el cliente demo implementa el subconjunto de la API de
 * Supabase que usa esta app, no la API entera. Se mantiene la firma para que
 * las páginas no tengan que saber en qué modo están corriendo.
 */
export function createDemoClient(viewer: Profile | null): SupabaseClient<Database> {
  return buildClient(viewer, false) as unknown as SupabaseClient<Database>;
}

/** Equivalente demo de la service role: ignora la emulación de RLS. */
export function createDemoAdminClient(): SupabaseClient<Database> {
  return buildClient(null, true) as unknown as SupabaseClient<Database>;
}
