import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_TOPICS, topicHints } from "../src/lib/social/lexicon";
import { cleanTopicHints, jevRequest, jevRow } from "../supabase/functions/_shared/jev";

const TEXT = "Qué lindo, otra semana sin agua en el barrio";
const TOPICS = ["Agua y servicios", "Seguridad", "Tema propio"];
const context = {
  organization: "Municipalidad de San Juan",
  place: "San Juan, Argentina",
  topics: [{ name: "Agua y servicios", includes: "agua, cloacas, cortes", excludes: ["agua mineral"] }],
};

type Question = { type: string; instructions: unknown; criteria?: Record<string, string> };
/** Las instrucciones de la pregunta de tono van como objeto, con un campo por dato. */
const about = (question: Question) => question.instructions as { gestion_evaluada?: string; expresiones: string[] };
const build = (ctx: Parameters<typeof jevRequest>[3] = context) =>
  jevRequest("jev-latest", TEXT, TOPICS, ctx) as { model: string; state: { publicacion: string }; questions: Record<string, Question> };

describe("lo que se le manda a JEV", () => {
  it("le dice a qué gestión se evalúa, solo en la pregunta de tono", () => {
    const { questions } = build();
    assert.equal(about(questions.sentiment).gestion_evaluada, "Municipalidad de San Juan (San Juan, Argentina)");
    assert.match(questions.sentiment.criteria!.neutral, /otro municipio/);
    for (const [id, question] of Object.entries(questions)) {
      if (id !== "sentiment") assert.ok(!JSON.stringify(question).includes("Municipalidad de San Juan"), id);
    }
  });

  it("le explica las expresiones de acá y la ironía", () => {
    const { sentiment } = build().questions;
    assert.ok(about(sentiment).expresiones.some((e) => /ironía/.test(e)));
    assert.match(sentiment.criteria!.negativo, /sarcasmo/);
  });

  it("le dice qué entra y qué no entra en un tema", () => {
    const water = build().questions["topic:Agua y servicios"];
    assert.equal(water.type, "noul");
    assert.match(String(water.instructions), /Agua y servicios/);
    assert.match(water.criteria!.true, /cloacas/);
    assert.match(water.criteria!.false, /agua mineral/);
  });

  it("un tema sin pistas se pregunta igual que siempre", () => {
    const own = build().questions["topic:Tema propio"];
    assert.equal(own.criteria, undefined);
    assert.match(String(own.instructions), /Tema propio/);
  });

  it("sin contexto sigue armando un pedido completo", () => {
    const { questions, state } = build({});
    assert.equal(state.publicacion, TEXT);
    assert.equal(about(questions.sentiment).gestion_evaluada, undefined);
    assert.ok(!/otro municipio/.test(questions.sentiment.criteria!.neutral));
    assert.deepEqual(Object.keys(questions), ["sentiment", "emotion", ...TOPICS.map((t) => `topic:${t}`)]);
  });

  it("recorta publicaciones larguísimas", () => {
    const { state } = jevRequest("jev-latest", "a".repeat(5000), []);
    assert.equal(state.publicacion.length, 1500);
  });

  it("limpia y acota las pistas que llegan en un pedido", () => {
    const dirty = [null, "x", { name: "" }, { name: "Obras", includes: "b".repeat(900), excludes: [1, "  ", "ópera"] }];
    const [hint, ...rest] = cleanTopicHints(dirty);
    assert.deepEqual(rest, []);
    assert.equal(hint.includes!.length, 400);
    assert.deepEqual(hint.excludes, ["ópera"]);
    assert.deepEqual(cleanTopicHints("nada"), []);
  });
});

describe("lo que responde JEV", () => {
  const answers = {
    sentiment: { choice: "negativo", confidence: 0.91234 },
    emotion: { choice: "enojo" },
    "topic:Agua y servicios": { noul: 0.97 },
    "topic:Seguridad": { noul: 0.1 },
  };

  it("arma la fila con el tono con signo, la emoción y los temas", () => {
    assert.deepEqual(jevRow(3, { answers }, TOPICS), {
      index: 3,
      sentiment: -0.912,
      label: "negativo",
      emotion: "enojo",
      topics: ["Agua y servicios"],
    });
  });

  it("descarta una respuesta sin un tono reconocible o con una emoción inventada", () => {
    assert.equal(jevRow(0, {}, TOPICS), null);
    assert.equal(jevRow(0, null, TOPICS), null);
    assert.equal(jevRow(0, { answers: { sentiment: { choice: "ambiguo" } } }, TOPICS), null);
    assert.equal(jevRow(0, { answers: { ...answers, emotion: { choice: "euforia" } } }, TOPICS)!.emotion, null);
    assert.equal(jevRow(0, { answers: { ...answers, emotion: { choice: "ninguna" } } }, TOPICS)!.emotion, null);
  });
});

describe("temas que se le explican", () => {
  it("cada tema base tiene su descripción", () => {
    assert.ok(DEFAULT_TOPICS.every((t) => t.hint.length > 10));
  });

  it("suma las palabras y exclusiones que cargó la organización", () => {
    const hints = topicHints([
      { name: "Seguridad", keywords: ["motochorros"], exclude: ["seguridad vial"] },
      { name: "Zonda", keywords: ["viento zonda"], exclude: [] },
    ]);
    const security = hints.find((h) => h.name === "Seguridad")!;
    assert.match(security.includes, /robos/);
    assert.match(security.includes, /motochorros/);
    assert.deepEqual(security.excludes, ["seguridad vial"]);
    assert.equal(hints.find((h) => h.name === "Zonda")!.includes, "viento zonda");
    assert.equal(hints.length, DEFAULT_TOPICS.length + 1);
  });
});
