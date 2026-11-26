import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";
import { persistInterview } from "../src/lib/questions";
import type { QuestionWithOptions } from "../src/lib/types";

/**
 * Dos envíos de la misma entrevista pueden cruzarse: el teléfono reintenta
 * mientras el servidor todavía guarda el primero, y el segundo la encuentra
 * `en_curso` y la retoma. Acá se prueban todos los órdenes posibles contra una
 * base en memoria que imita lo que RLS le permite a un encuestador: solo puede
 * tocar respuestas de una entrevista abierta, y nunca borrar la entrevista.
 */

type Sender = "A" | "B";
type Row = Record<string, unknown>;
type Filter = { column: string; values: unknown[] };

function sharedDatabase() {
  const responses = new Map<string, Row>();
  const answers = new Map<string, Row>();
  /** Operaciones que cada envío pidió y todavía no se ejecutaron. */
  const pending: Record<Sender, (() => void)[]> = { A: [], B: [] };

  const isOpen = (id: unknown) => responses.get(String(id))?.status === "en_curso";
  const keyOf = (row: Row) => `${row.response_id}|${row.question_id}`;
  const matches = (row: Row, filters: Filter[]) => filters.every((f) => f.values.includes(row[f.column]));
  const denied = { error: { code: "42501", message: "row-level security" } };

  function client(sender: Sender) {
    const run = <T,>(op: () => T) => new Promise<T>((resolve) => pending[sender].push(() => resolve(op())));

    function query(action: (filters: Filter[]) => unknown) {
      const filters: Filter[] = [];
      const chain = {
        eq(column: string, value: unknown) {
          filters.push({ column, values: [value] });
          return chain;
        },
        in(column: string, values: unknown[]) {
          filters.push({ column, values });
          return chain;
        },
        then(onOk: (value: unknown) => unknown, onError?: (reason: unknown) => unknown) {
          return run(() => action(filters)).then(onOk, onError);
        },
      };
      return chain;
    }

    function write(rows: Row[], allowExisting: boolean) {
      return run(() => {
        if (rows.some((row) => !isOpen(row.response_id))) return denied;
        if (!allowExisting && rows.some((row) => answers.has(keyOf(row)))) {
          return { error: { code: "23505", message: "duplicate key" } };
        }
        for (const row of rows) answers.set(keyOf(row), row);
        return { error: null };
      });
    }

    return {
      from(table: "responses" | "answers") {
        return {
          insert(rows: Row | Row[]) {
            if (table === "answers") return write(rows as Row[], false);
            return {
              select: () => ({
                single: () =>
                  run(() => {
                    responses.set("r1", { ...(rows as Row), id: "r1" });
                    return { data: { id: "r1" }, error: null };
                  }),
              }),
            };
          },
          upsert: (rows: Row[]) => write(rows, true),
          select: () =>
            query((filters) => ({ data: [...answers.values()].filter((row) => matches(row, filters)), error: null })),
          update: (values: Row) =>
            query((filters) => {
              for (const row of responses.values()) {
                if (matches(row, filters) && isOpen(row.id)) Object.assign(row, values);
              }
              return { error: null };
            }),
          delete: () =>
            query((filters) => {
              if (table === "answers") {
                for (const [key, row] of answers) {
                  if (matches(row, filters) && isOpen(row.response_id)) answers.delete(key);
                }
              }
              return { error: null };
            }),
        };
      },
    } as never;
  }

  return { client, pending, responses, answers };
}

const questions = ["q1", "q2"].map(
  (id, index) =>
    ({
      id,
      survey_id: "s1",
      position: index + 1,
      type: "si_no",
      text: `Pregunta ${index + 1}`,
      help_text: null,
      is_required: true,
      section: null,
      min_value: null,
      max_value: null,
      logic: null,
      options: [],
    }) as unknown as QuestionWithOptions,
);

const interview = {
  survey: { id: "s1", organization_id: "o1" },
  questions,
  answers: [
    { question_id: "q1", value_text: "si" },
    { question_id: "q2", value_text: "no" },
  ],
};
const meta = {
  channel: "campo" as const,
  surveyor_id: "u1",
  zone: "Capital",
  duration_seconds: 120,
  respondent_hash: "huella",
};

const tick = () => new Promise((resolve) => setImmediate(resolve));

/** El envío A abre la entrevista; B la encuentra abierta y la retoma. `order` decide quién avanza en cada paso. */
async function race(order: string) {
  const db = sharedDatabase();
  const step = async (sender: Sender) => {
    db.pending[sender].shift()!();
    await tick();
  };

  const a = persistInterview(db.client("A"), { ...interview, meta });
  await tick();
  await step("A");
  const b = persistInterview(db.client("B"), { ...interview, meta: { ...meta, resume_response_id: "r1" } });
  await tick();

  for (let i = 0; db.pending.A.length || db.pending.B.length; i++) {
    const wanted = (order[i] ?? "A") as Sender;
    await step(db.pending[wanted].length ? wanted : wanted === "A" ? "B" : "A");
  }
  return { a: await a, b: await b, db };
}

describe("dos envíos de la misma entrevista a la vez", () => {
  it("en cualquier orden, la entrevista queda completada con todas sus respuestas", async () => {
    mock.method(console, "error", () => {});
    const broken: string[] = [];
    const steps = 8;

    for (let n = 0; n < 2 ** steps; n++) {
      const order = n.toString(2).padStart(steps, "0").replaceAll("0", "A").replaceAll("1", "B");
      const { a, b, db } = await race(order);
      const status = db.responses.get("r1")?.status;
      const saved = db.answers.size;
      if (status !== "completada" || saved !== 2 || !(a.ok || b.ok)) {
        broken.push(`${order}: ${status}, ${saved} respuestas`);
      }
    }

    mock.restoreAll();
    assert.deepEqual(broken.slice(0, 5), [], `${broken.length} órdenes dejan la entrevista mal guardada`);
  });
});
