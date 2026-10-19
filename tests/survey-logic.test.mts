import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { validateInterview, validateAnswer, resolvePath, looksExclusive } from "../src/lib/survey-logic";
import type { QuestionWithOptions } from "../src/lib/types";

type Opt = { id: string; label: string; is_exclusive?: boolean };

/** Arma una pregunta mínima; solo lo que las reglas leen. */
function q(
  id: string,
  position: number,
  type: string,
  extra: Record<string, unknown> = {},
  options: Opt[] = [],
): QuestionWithOptions {
  return {
    id,
    survey_id: "s1",
    position,
    type,
    text: `Pregunta ${position}`,
    help_text: null,
    is_required: true,
    section: null,
    min_value: null,
    max_value: null,
    logic: null,
    ...extra,
    options: options.map((o, i) => ({
      id: o.id,
      question_id: id,
      position: i + 1,
      label: o.label,
      value: null,
      is_exclusive: o.is_exclusive ?? false,
    })),
  } as unknown as QuestionWithOptions;
}

describe("recorrido del cuestionario", () => {
  const filtro = q("filtro", 1, "si_no", { logic: { end_if: ["no"] } });
  const barrio = q("barrio", 2, "opcion_unica", {}, [
    { id: "centro", label: "Centro" },
    { id: "norte", label: "Norte" },
  ]);
  const motivo = q("motivo", 3, "texto_corto", { logic: { show_if: { question_id: "barrio", values: ["norte"] } } });

  it("corta en la pregunta filtro y no exige lo que viene después", () => {
    const check = validateInterview([filtro, barrio], { filtro: { text: "no" } });
    assert.equal(check.endedAt?.id, "filtro");
    assert.deepEqual(check.errors, []);
    assert.deepEqual(check.path.map((p) => p.id), ["filtro"]);
  });

  it("exige las obligatorias del recorrido", () => {
    const check = validateInterview([filtro, barrio], { filtro: { text: "si" } });
    assert.deepEqual(check.errors.map((e) => e.questionId), ["barrio"]);
  });

  it("una pregunta condicional solo se pide si la rama la activa", () => {
    const sinRama = validateInterview([barrio, motivo], { barrio: { optionIds: ["centro"] } });
    assert.deepEqual(sinRama.errors, []);
    assert.deepEqual(sinRama.path.map((p) => p.id), ["barrio"]);

    const conRama = validateInterview([barrio, motivo], { barrio: { optionIds: ["norte"] } });
    assert.deepEqual(conRama.errors.map((e) => e.questionId), ["motivo"]);
  });

  it("una respuesta huérfana no activa saltos encadenados", () => {
    // P3 depende de P2, y P2 solo se ve con P1 = si. Si el encuestador volvió atrás y cambió P1
    // a "no", la respuesta vieja de P2 sigue guardada pero P3 no debe aparecer.
    const p1 = q("p1", 1, "si_no");
    const p2 = q("p2", 2, "si_no", { logic: { show_if: { question_id: "p1", values: ["si"] } } });
    const p3 = q("p3", 3, "texto_corto", { logic: { show_if: { question_id: "p2", values: ["si"] } } });
    const { path } = resolvePath([p1, p2, p3], { p1: { text: "no" }, p2: { text: "si" } });
    assert.deepEqual(path.map((p) => p.id), ["p1"]);
  });
});

describe("validación de respuestas", () => {
  it("rechaza una opción que pertenece a otra pregunta", () => {
    const pregunta = q("a", 1, "opcion_unica", {}, [{ id: "x", label: "X" }]);
    assert.match(validateAnswer(pregunta, { optionIds: ["de-otra-pregunta"] }) ?? "", /no pertenece/);
    assert.equal(validateAnswer(pregunta, { optionIds: ["x"] }), null);
  });

  it("opción múltiple: respeta el tope y las opciones excluyentes", () => {
    const pregunta = q("m", 1, "opcion_multiple", { max_value: 2 }, [
      { id: "a", label: "Seguridad" },
      { id: "b", label: "Salud" },
      { id: "c", label: "Empleo" },
      { id: "ns", label: "No sabe / no contesta" },
    ]);
    assert.match(validateAnswer(pregunta, { optionIds: ["a", "b", "c"] }) ?? "", /hasta 2/);
    assert.match(validateAnswer(pregunta, { optionIds: ["a", "ns"] }) ?? "", /no se combina/);
    assert.equal(validateAnswer(pregunta, { optionIds: ["a", "b"] }), null);
    assert.equal(validateAnswer(pregunta, { optionIds: ["ns"] }), null);
  });

  it("escala: solo enteros dentro del rango", () => {
    const escala = q("e", 1, "escala", { min_value: 0, max_value: 10 });
    assert.match(validateAnswer(escala, { number: 7.5 }) ?? "", /enteros/);
    assert.match(validateAnswer(escala, { number: 11 }) ?? "", /máximo/);
    assert.match(validateAnswer(escala, { number: -1 }) ?? "", /mínimo/);
    assert.equal(validateAnswer(escala, { number: 10 }), null);
  });

  it("número: usa los límites cuando existen", () => {
    const edad = q("n", 1, "numero", { min_value: 16, max_value: 110 });
    assert.match(validateAnswer(edad, { number: 15 }) ?? "", /mínimo/);
    assert.equal(validateAnswer(edad, { number: 42 }), null);
  });

  it("reconoce las etiquetas excluyentes habituales", () => {
    for (const label of ["No sabe", "NS/NC", "Ninguno", "Prefiero no decirlo"]) assert.equal(looksExclusive(label), true, label);
    assert.equal(looksExclusive("Seguridad"), false);
  });
});
