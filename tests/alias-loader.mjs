// Permite que `node --test` cargue los módulos de src/ tal como los ve Next:
// el alias "@/" y los imports relativos sin extensión.
import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const src = fileURLToPath(new URL("../src/", import.meta.url));
const candidates = (base) => [base, `${base}.ts`, `${base}.tsx`, path.join(base, "index.ts")];

export async function resolve(specifier, context, nextResolve) {
  let target = null;
  if (specifier.startsWith("@/")) {
    target = path.join(src, specifier.slice(2));
  } else if (
    (specifier.startsWith("./") || specifier.startsWith("../")) &&
    context.parentURL?.startsWith("file:") &&
    !path.extname(specifier)
  ) {
    target = path.resolve(path.dirname(fileURLToPath(context.parentURL)), specifier);
  }
  if (target) {
    const hit = candidates(target).find((p) => existsSync(p) && statSync(p).isFile());
    if (hit) return nextResolve(pathToFileURL(hit).href, context);
  }
  return nextResolve(specifier, context);
}
