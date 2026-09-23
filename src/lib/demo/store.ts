import { buildDemoData, type DemoTables } from "@/lib/demo/dataset";

/**
 * El dataset vive en memoria del proceso. Se cuelga de globalThis para que el
 * hot reload de `next dev` no lo reinicie a cada cambio y para que todas las
 * rutas compartan la misma instancia.
 *
 * Las escrituras del modo demo son reales pero efímeras: se pierden al
 * reiniciar el servidor. Es a propósito — la demo tiene que poder volver a
 * cero sin tocar nada.
 */
const KEY = Symbol.for("consulta.demo.store");

type Holder = { [KEY]?: DemoTables };

export function demoTables(): DemoTables {
  const holder = globalThis as unknown as Holder;
  if (!holder[KEY]) {
    holder[KEY] = buildDemoData();
  }
  return holder[KEY];
}

/** Vuelve el dataset a su estado inicial. */
export function resetDemoData() {
  const holder = globalThis as unknown as Holder;
  holder[KEY] = buildDemoData();
}

let counter = 0;

/** Ids legibles y estables dentro de una misma corrida. */
export function demoId(prefix: string) {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}${counter.toString(36)}`;
}
