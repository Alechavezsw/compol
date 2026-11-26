import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { SurveyData } from "../src/lib/analytics";
import { balance, dailySeries, distribution, filterCases, signed, weeklyChange, zoneCenters, zoneSummaries } from "../src/lib/pulse";
import { buildPulse } from "../src/lib/pulse-build";

const option = (question: string, label: string, i: number) => ({ id: `${question}-${i}`, question_id: question, position: i, label, value: null, is_exclusive: false });
const question = (id: string, type: string, section: string, text: string, labels: string[] = []) => ({
  id,
  survey_id: "s1",
  position: 1,
  type,
  text,
  help_text: null,
  is_required: true,
  section,
  min_value: type === "escala" ? 1 : null,
  max_value: type === "escala" ? 10 : null,
  logic: null,
  options: labels.map((label, i) => option(id, label, i)),
});

type Case = { id: string; zone: string | null; day: string; rating: number; age: number; issues: number[]; score: number; gps?: [number, number] };

function survey(cases: Case[]) {
  return {
    survey: { id: "s1", status: "cerrada" },
    questions: [
      question("edad", "opcion_unica", "Perfil", "¿Qué edad tiene?", ["Joven", "Mayor"]),
      question("gestion", "opcion_unica", "Gestión", "¿Cómo evalúa la gestión?", ["Buena", "Regular", "Mala", "No sabe / No contesta"]),
      question("problemas", "opcion_multiple", "Agenda", "¿Qué problemas hay?", ["Seguridad", "Salud"]),
      question("servicios", "escala", "Servicios", "¿Qué tan satisfecho está?"),
    ],
    responses: cases.map((c) => ({
      id: c.id,
      status: "completada",
      zone: c.zone,
      submitted_at: `${c.day}T15:00:00-03:00`,
      started_at: `${c.day}T15:00:00-03:00`,
      latitude: c.gps?.[0] ?? null,
      longitude: c.gps?.[1] ?? null,
      surveyor_id: "persona-secreta",
    })),
    values: new Map(
      cases.map((c) => [
        c.id,
        {
          edad: { optionIds: [`edad-${c.age}`] },
          gestion: { optionIds: [`gestion-${c.rating}`] },
          problemas: { optionIds: c.issues.map((i) => `problemas-${i}`) },
          servicios: { number: c.score },
        },
      ]),
    ),
    assignments: [],
    names: new Map(),
  } as unknown as SurveyData;
}

const cases: Case[] = [
  { id: "r1", zone: "Norte", day: "2026-11-01", rating: 0, age: 0, issues: [0], score: 8, gps: [-31.5, -68.5] },
  { id: "r2", zone: "Norte", day: "2026-11-02", rating: 0, age: 1, issues: [0, 1], score: 6, gps: [-31.52, -68.52] },
  { id: "r3", zone: "Sur", day: "2026-11-09", rating: 2, age: 0, issues: [1], score: 2 },
  { id: "r4", zone: "Sur", day: "2026-11-10", rating: 3, age: 1, issues: [0], score: 4 },
];

const pulse = buildPulse(survey(cases), "2026-11-25")!;
const evaluation = pulse.roles.evaluation!;
const all = { zone: null, segments: {}, day: null };

describe("tablero territorial", () => {
  it("reconoce qué pregunta cumple cada papel", () => {
    assert.equal(pulse.questions[evaluation].id, "gestion");
    assert.equal(pulse.questions[pulse.roles.agenda!].id, "problemas");
    assert.equal(pulse.questions[pulse.roles.scale!].id, "servicios");
    assert.deepEqual(pulse.roles.profile.map((i) => pulse.questions[i].id), ["edad"]);
  });

  it("no manda al navegador ids de personas ni de encuestadores", () => {
    const sent = JSON.stringify(pulse);
    assert.ok(!sent.includes("persona-secreta"));
    assert.ok(!sent.includes('"r1"'));
  });

  it("cuenta los días corridos, incluidos los vacíos", () => {
    assert.equal(pulse.days.length, 10);
    assert.equal(pulse.days[0], "2026-11-01");
    assert.equal(pulse.days.at(-1), "2026-11-10");
  });

  it("el saldo usa como base a todos los que respondieron, incluido NS/NC", () => {
    const result = balance(pulse.cases, evaluation, pulse.questions[evaluation])!;
    assert.deepEqual([result.positive, result.negative, result.net, result.base], [50, 25, 25, 4]);
  });

  it("filtra por zona, perfil y día a la vez", () => {
    assert.equal(filterCases(pulse.cases, { ...all, zone: pulse.zones.indexOf("Sur") }).length, 2);
    assert.equal(filterCases(pulse.cases, { ...all, segments: { [pulse.roles.profile[0]]: 0 } }).length, 2);
    assert.equal(filterCases(pulse.cases, { ...all, day: 1 }).length, 2);
    assert.equal(filterCases(pulse.cases, { zone: 0, segments: { [pulse.roles.profile[0]]: 1 }, day: 0 }).length, 0);
  });

  it("en opción múltiple la base son las personas", () => {
    const { shares, base } = distribution(pulse.cases, pulse.roles.agenda!, pulse.questions[pulse.roles.agenda!]);
    assert.equal(base, 4);
    assert.deepEqual(shares.map((s) => s.percent), [75, 50]);
  });

  it("resume cada zona y ubica su centro solo con los casos que tienen GPS", () => {
    const [norte, sur] = zoneSummaries(pulse, pulse.cases);
    assert.equal(norte.balance!.net, 100);
    assert.equal(sur.balance!.net, -50);
    assert.equal(norte.average, 7);
    const centers = zoneCenters(pulse);
    assert.ok(Math.abs(centers[0]![0] - -31.51) < 1e-9);
    assert.equal(centers[1], null);
  });

  it("compara la última semana con la anterior y suaviza la serie", () => {
    assert.equal(weeklyChange(pulse, pulse.cases, pulse.days.length - 1), -150);
    const series = dailySeries(pulse, pulse.cases, 9);
    assert.equal(series[0].net, 100);
    assert.equal(series[7].net, 100);
    assert.equal(series[9].net, -50);
    assert.equal(series[5].count, 0);
    assert.equal(series[9].base, 2);
  });

  it("no informa un cambio semanal que se apoya en muy pocos casos", () => {
    assert.equal(weeklyChange(pulse, pulse.cases, pulse.days.length - 1, 3), null);
  });

  it("si nadie tiene zona, la toma de la pregunta que la pide", () => {
    const web = survey(cases.map((c) => ({ ...c, zone: null })));
    web.questions.push(
      question("barrio", "opcion_unica", "Perfil", "¿En qué zona vivís?", ["Oeste", "Este"]) as unknown as SurveyData["questions"][number],
    );
    for (const [id, values] of web.values) values.barrio = { optionIds: [id === "r1" ? "barrio-0" : "barrio-1"] };
    const result = buildPulse(web, "2026-11-25")!;
    assert.deepEqual(result.zones, ["Este", "Oeste"]);
    assert.deepEqual(result.cases.map((c) => c.z), [1, 0, 0, 0]);
    assert.ok(!result.questions.some((q) => q.id === "barrio"));
  });

  it("sin casos completados no arma tablero", () => {
    assert.equal(buildPulse(survey([]), "2026-11-25"), null);
  });

  it("muestra el signo del saldo", () => {
    assert.deepEqual([signed(12.4), signed(-8), signed(0.2)], ["+12", "−8", "0"]);
  });
});
