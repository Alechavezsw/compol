import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { persistInterview } from "../src/lib/questions";
import type { QuestionWithOptions } from "../src/lib/types";

/**
 * Cliente de Supabase mínimo que anota lo que se le pide. Alcanza para ver QUÉ
 * escribe `persistInterview` y en qué orden, sin base de datos de por medio.
 */
function fakeClient(opts: {
  responseError?: { code?: string; message: string };
  answersError?: { code?: string; message: string };
  closeError?: { code?: string; message: string };
  /** Preguntas que ya tienen respuesta guardada en la entrevista que se retoma. */
  storedAnswers?: string[];
} = {}) {
  const calls = {
    responsesInserted: [] as Record<string, unknown>[],
    answersWritten: [] as Record<string, unknown>[][],
    updates: [] as { table: string; values: Record<string, unknown>; id: unknown }[],
    deletes: [] as { table: string; filters: [string, unknown][] }[],
  };

  const client = {
    from(table: string) {
      return {
        insert(rows: Record<string, unknown>) {
          calls.responsesInserted.push(rows);
          return {
            select: () => ({
              single: async () =>
                opts.responseError ? { data: null, error: opts.responseError } : { data: { id: "nueva" }, error: null },
            }),
          };
        },
        async upsert(rows: Record<string, unknown>[]) {
          calls.answersWritten.push(rows);
          return { error: opts.answersError ?? null };
        },
        select() {
          return {
            eq: async () => ({
              data: (opts.storedAnswers ?? []).map((question_id) => ({ question_id })),
              error: null,
            }),
          };
        },
        update(values: Record<string, unknown>) {
          return {
            eq: async (_column: string, id: unknown) => {
              calls.updates.push({ table, values, id });
              return { error: opts.closeError ?? null };
            },
          };
        },
        delete() {
          const filters: [string, unknown][] = [];
          const chain = {
            eq(column: string, value: unknown) {
              filters.push([column, value]);
              return chain;
            },
            in(column: string, values: unknown[]) {
              filters.push([column, values]);
              return chain;
            },
            then(resolve: (result: { error: null }) => unknown) {
              calls.deletes.push({ table, filters });
              return Promise.resolve({ error: null }).then(resolve);
            },
          };
          return chain;
        },
      };
    },
  };
  return { client: client as never, calls };
}

const question = {
  id: "q1",
  survey_id: "s1",
  position: 1,
  type: "si_no",
  text: "¿Aprueba?",
  help_text: null,
  is_required: true,
  section: null,
  min_value: null,
  max_value: null,
  logic: null,
  options: [],
} as unknown as QuestionWithOptions;

const survey = { id: "s1", organization_id: "o1" };
const answers = [{ question_id: "q1", value_text: "si" }];
const meta = { channel: "campo" as const, surveyor_id: "u1", zone: "Capital", duration_seconds: 120 };

describe("guardado de entrevistas", () => {
  it("fecha la entrevista cuando se tomó, no cuando se sincronizó", async () => {
    const { client, calls } = fakeClient();
    const collected = Date.parse("2026-11-20T14:00:00Z");
    const result = await persistInterview(client, {
      survey,
      questions: [question],
      answers,
      meta: { ...meta, collected_at: collected },
    });

    assert.equal(result.ok, true);
    assert.equal(calls.responsesInserted[0].started_at, "2026-11-20T13:58:00.000Z");
    assert.equal(calls.updates[0].values.submitted_at, "2026-11-20T14:00:00.000Z");
    assert.equal(calls.updates[0].values.status, "completada");
  });

  it("un envío repetido con la misma huella se reconoce como duplicado", async () => {
    const { client } = fakeClient({ responseError: { code: "23505", message: "duplicate key value violates unique constraint" } });
    const result = await persistInterview(client, {
      survey,
      questions: [question],
      answers,
      meta: { ...meta, respondent_hash: "huella" },
    });
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.duplicate, true);
  });

  it("sin huella, una violación de unicidad es un error común y no un duplicado", async () => {
    const { client } = fakeClient({ responseError: { code: "23505", message: "boom" } });
    mock.method(console, "error", () => {});
    const result = await persistInterview(client, { survey, questions: [question], answers, meta });
    assert.equal(!result.ok && result.duplicate, undefined);
    mock.restoreAll();
  });

  it("retoma una entrevista que quedó abierta: no abre otra ni la vacía, escribe encima", async () => {
    const { client, calls } = fakeClient({ storedAnswers: ["q1"] });
    const result = await persistInterview(client, {
      survey,
      questions: [question],
      answers,
      meta: { ...meta, respondent_hash: "huella", resume_response_id: "abierta-1" },
    });

    assert.equal(result.ok, true);
    assert.equal(calls.responsesInserted.length, 0);
    assert.deepEqual(calls.deletes, []);
    assert.equal(calls.answersWritten[0][0].response_id, "abierta-1");
    assert.equal(calls.updates[0].id, "abierta-1");
  });

  it("al retomar quita solo las respuestas que ya no están en el recorrido", async () => {
    const { client, calls } = fakeClient({ storedAnswers: ["q1", "q-vieja"] });
    const result = await persistInterview(client, {
      survey,
      questions: [question],
      answers,
      meta: { ...meta, respondent_hash: "huella", resume_response_id: "abierta-1" },
    });

    assert.equal(result.ok, true);
    assert.deepEqual(calls.deletes, [
      { table: "answers", filters: [["response_id", "abierta-1"], ["question_id", ["q-vieja"]]] },
    ]);
  });

  it("si fallan las respuestas de una entrevista retomada, no intenta borrarla", async () => {
    mock.method(console, "error", () => {});
    const { client, calls } = fakeClient({ answersError: { code: "42501", message: "rls" } });
    const result = await persistInterview(client, {
      survey,
      questions: [question],
      answers,
      meta: { ...meta, respondent_hash: "huella", resume_response_id: "abierta-1" },
    });

    assert.equal(result.ok, false);
    assert.deepEqual(calls.deletes, []);
    assert.equal(calls.updates.length, 0);
    mock.restoreAll();
  });

  it("una entrevista que el cuestionario no acepta vuelve marcada como rechazada", async () => {
    const { client, calls } = fakeClient();
    const result = await persistInterview(client, { survey, questions: [question], answers: [], meta });
    assert.equal(result.ok, false);
    assert.equal(!result.ok && result.rejected, true);
    assert.equal(calls.responsesInserted.length, 0);
  });

  it("no muestra detalles de la base a quien responde", async () => {
    mock.method(console, "error", () => {});
    const { client } = fakeClient({ answersError: { code: "42501", message: 'new row violates row-level security policy for table "answers"' } });
    const result = await persistInterview(client, { survey, questions: [question], answers, meta });
    assert.equal(result.ok, false);
    assert.ok(!result.ok && !/row-level|answers|policy/i.test(result.error));
    mock.restoreAll();
  });

  it("ignora elementos nulos en la lista de respuestas en vez de romper", async () => {
    const { client } = fakeClient();
    const result = await persistInterview(client, {
      survey,
      questions: [question],
      answers: [null, "texto", ...answers] as never,
      meta,
    });
    assert.equal(result.ok, true);
  });
});
