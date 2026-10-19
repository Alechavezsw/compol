import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { neutralizeFormula } from "../src/lib/csv";
import { UnsafeUrlError, fetchPublic } from "../src/lib/net-safety";
import { safeInternalPath } from "../src/lib/utils";

describe("redirecciones internas", () => {
  it("acepta rutas de la propia app", () => {
    assert.equal(safeInternalPath("/cliente"), "/cliente");
    assert.equal(safeInternalPath("/cliente/encuestas?x=1#y"), "/cliente/encuestas?x=1#y");
  });

  it("rechaza lo que los navegadores leen como otro sitio", () => {
    for (const raw of ["//evil.com", "/\\evil.com", "/\t/evil.com", "/\n/evil.com", "https://evil.com", "evil.com", "javascript:alert(1)", "", null, undefined]) {
      assert.equal(safeInternalPath(raw as string | null | undefined), null, String(raw));
    }
  });
});

describe("salidas a internet pedidas por usuarios", () => {
  const bloqueadas = [
    "http://localhost/x",
    "http://127.0.0.1/",
    "http://127.1/",
    "http://2130706433/", // 127.0.0.1 en decimal
    "http://0x7f.0.0.1/",
    "http://169.254.169.254/latest/meta-data/", // metadatos de la nube
    "http://10.0.0.5/",
    "http://172.16.0.1/",
    "http://172.31.255.255/",
    "http://192.168.1.1/",
    "http://100.64.0.1/", // CGNAT
    "http://[::1]/",
    "http://[::ffff:127.0.0.1]/",
    "http://[fd00::1]/",
    "http://[fe80::1]/",
    "http://metadata.google.internal/",
    "http://user:pass@example.com/",
    "http://example.com:8080/",
    "ftp://example.com/",
    "file:///etc/passwd",
    "javascript:alert(1)",
  ];

  for (const url of bloqueadas) {
    it(`bloquea ${url}`, async () => {
      await assert.rejects(fetchPublic(url, { timeoutMs: 2000 }), UnsafeUrlError);
    });
  }
});

describe("CSV", () => {
  it("neutraliza texto que Excel interpretaría como fórmula", () => {
    for (const peligroso of ["=HYPERLINK(\"http://evil\")", "+1+1", "-2+3", "@SUM(A1)", "\tcmd", "\rcmd"]) {
      assert.equal(neutralizeFormula(peligroso), `'${peligroso}`, JSON.stringify(peligroso));
    }
  });

  it("deja el texto normal como está", () => {
    for (const normal of ["Capital", "Hay baches en la calle", "", "1=1 no empieza con ="]) {
      assert.equal(neutralizeFormula(normal), normal);
    }
    assert.equal(neutralizeFormula(null), "");
  });
});
