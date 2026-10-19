import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { STATUS_FLOW, acceptsResponses, isExpired } from "../src/lib/survey-status";

const NOW = Date.parse("2026-10-18T15:00:00-03:00");

describe("cierre por fecha", () => {
  it("una encuesta activa sin fecha o con cierre futuro recibe respuestas", () => {
    assert.equal(acceptsResponses({ status: "activa", ends_at: null }, NOW), true);
    assert.equal(acceptsResponses({ status: "activa", ends_at: "2026-10-20T23:59:00-03:00" }, NOW), true);
  });

  it("el día del cierre sigue abierta hasta las 23:59 de Argentina", () => {
    assert.equal(acceptsResponses({ status: "activa", ends_at: "2026-10-18T23:59:00-03:00" }, NOW), true);
    const despues = Date.parse("2026-10-19T00:01:00-03:00");
    assert.equal(acceptsResponses({ status: "activa", ends_at: "2026-10-18T23:59:00-03:00" }, despues), false);
  });

  it("vencida, deja de recibir aunque su estado siga siendo activa", () => {
    const vencida = { status: "activa", ends_at: "2026-10-17T23:59:00-03:00" };
    assert.equal(isExpired(vencida, NOW), true);
    assert.equal(acceptsResponses(vencida, NOW), false);
  });

  it("borrador, pausada y cerrada nunca reciben", () => {
    for (const status of ["borrador", "pausada", "cerrada"]) {
      assert.equal(acceptsResponses({ status, ends_at: null }, NOW), false, status);
    }
  });

  it("una fecha ilegible no bloquea la encuesta", () => {
    assert.equal(isExpired({ ends_at: "no-es-fecha" }, NOW), false);
  });
});

describe("transiciones de estado", () => {
  it("no hay transiciones a sí mismo y de todo estado se puede salir", () => {
    for (const [from, targets] of Object.entries(STATUS_FLOW)) {
      assert.ok(targets.length > 0, `${from} no tiene salida`);
      assert.ok(!targets.includes(from as never), `${from} apunta a sí mismo`);
    }
  });

  it("un borrador solo puede salir a campo", () => {
    assert.deepEqual(STATUS_FLOW.borrador, ["activa"]);
  });
});
