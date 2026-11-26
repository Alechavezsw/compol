import assert from "node:assert/strict";
import { describe, it } from "node:test";

process.env.WEB_FORM_SECRET = "clave-de-prueba-solo-para-tests";

const { MAX_FORM_AGE_MS, connectionHash, formAgeSeconds, issueFormToken } = await import("../src/lib/web-guard");

const NOW = Date.parse("2026-11-23T15:00:00Z");

describe("token de formulario de la encuesta web", () => {
  it("mide en el servidor cuánto lleva abierto el formulario", () => {
    const token = issueFormToken("encuesta-abc", NOW);
    assert.equal(formAgeSeconds("encuesta-abc", token, NOW + 12_000), 12);
  });

  it("rechaza un token inventado, vacío o con otro formato", () => {
    for (const falso of ["", "x", "123.abc", `${NOW}.firma-falsa`, `${NOW}`, null, undefined, 42]) {
      assert.equal(formAgeSeconds("encuesta-abc", falso, NOW + 5_000), null, String(falso));
    }
  });

  it("no sirve si se cambia la hora de emisión para parecer más viejo", () => {
    const token = issueFormToken("encuesta-abc", NOW);
    const [, firma] = token.split(".");
    assert.equal(formAgeSeconds("encuesta-abc", `${NOW - 60_000}.${firma}`, NOW + 5_000), null);
  });

  it("está atado a la encuesta: no se reutiliza en otra", () => {
    const token = issueFormToken("encuesta-abc", NOW);
    assert.equal(formAgeSeconds("otra-encuesta", token, NOW + 5_000), null);
  });

  it("vence a las 24 horas y no acepta emisiones del futuro", () => {
    const token = issueFormToken("encuesta-abc", NOW);
    assert.notEqual(formAgeSeconds("encuesta-abc", token, NOW + MAX_FORM_AGE_MS), null);
    assert.equal(formAgeSeconds("encuesta-abc", token, NOW + MAX_FORM_AGE_MS + 1_000), null);
    assert.equal(formAgeSeconds("encuesta-abc", token, NOW - 1_000), null);
  });
});

describe("huella de la conexión", () => {
  it("es estable para la misma conexión y distinta entre conexiones y entre encuestas", () => {
    const a = connectionHash("encuesta-1", "200.1.2.3");
    assert.equal(a, connectionHash("encuesta-1", "200.1.2.3"));
    assert.notEqual(a, connectionHash("encuesta-1", "200.1.2.4"));
    assert.notEqual(a, connectionHash("encuesta-2", "200.1.2.3"));
  });

  it("no contiene la dirección IP", () => {
    const hash = connectionHash("encuesta-1", "200.1.2.3");
    assert.match(hash, /^[A-Za-z0-9_-]{32}$/);
    assert.ok(!hash.includes("200.1.2.3"));
  });
});
