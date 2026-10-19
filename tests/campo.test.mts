import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { qualityFlags, type QualityRow } from "../src/lib/quality";
import { addDays, dayBoundsIso, dayKey, daysBetween } from "../src/lib/stats";

const at = (iso: string) => iso;

function fila(extra: Partial<QualityRow>): QualityRow {
  return { surveyor_id: "u1", zone: "Capital", channel: "campo", duration_seconds: 300, submitted_at: at("2026-10-18T14:00:00Z"), ...extra };
}

describe("control de calidad del campo", () => {
  it("marca las entrevistas exprés respecto de la mediana", () => {
    const rows = [fila({ duration_seconds: 300 }), fila({ duration_seconds: 320 }), fila({ duration_seconds: 280 }), fila({ duration_seconds: 40 })];
    assert.equal(qualityFlags(rows).express, 1);
  });

  it("detecta ráfagas: cuatro entrevistas de un encuestador en la misma zona en media hora", () => {
    const minutos = [0, 5, 9, 14].map((m) => fila({ submitted_at: new Date(Date.parse("2026-10-18T14:00:00Z") + m * 60_000).toISOString() }));
    const flags = qualityFlags(minutos);
    assert.equal(flags.bursts.length, 1);
    assert.equal(flags.bursts[0].count, 4);
  });

  it("tres entrevistas seguidas no son ráfaga", () => {
    const minutos = [0, 5, 9].map((m) => fila({ submitted_at: new Date(Date.parse("2026-10-18T14:00:00Z") + m * 60_000).toISOString() }));
    assert.equal(qualityFlags(minutos).bursts.length, 0);
  });

  it("cuenta las entrevistas fuera de las zonas con cuota, ignorando tildes y mayúsculas", () => {
    const rows = [fila({ zone: "capital" }), fila({ zone: "Santa Lucía" }), fila({ zone: "Jáchal" })];
    assert.equal(qualityFlags(rows, ["Capital", "Santa Lucia"]).offQuota, 1);
  });

  it("las respuestas web no entran en el control de campo", () => {
    const rows = [fila({ channel: "web", duration_seconds: 1 }), fila({ channel: "web", zone: "Otra" })];
    const flags = qualityFlags(rows, ["Capital"]);
    assert.deepEqual([flags.express, flags.offQuota, flags.bursts.length], [0, 0, 0]);
  });
});

describe("días del operativo (Argentina, UTC-3)", () => {
  it("la madrugada UTC todavía es el día anterior", () => {
    assert.equal(dayKey("2026-10-18T02:30:00Z"), "2026-10-17");
    assert.equal(dayKey("2026-10-18T03:00:00Z"), "2026-10-18");
  });

  it("calcula límites de día y suma días cruzando el mes", () => {
    assert.deepEqual(dayBoundsIso("2026-10-18"), { start: "2026-10-18T03:00:00.000Z", end: "2026-10-19T03:00:00.000Z" });
    assert.equal(addDays("2026-10-31", 1), "2026-11-01");
    assert.equal(addDays("2026-03-01", -1), "2026-02-28");
    assert.equal(daysBetween("2026-10-18", "2026-10-25"), 7);
  });
});
