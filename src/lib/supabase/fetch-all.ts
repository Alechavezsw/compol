/**
 * Lee todas las filas de una consulta paginando de a `pageSize`.
 *
 * PostgREST corta cada respuesta en `max-rows` (1000 por defecto en Supabase)
 * sin avisar: un `.limit(100000)` devuelve igual 1000 filas. En un operativo
 * con 400 entrevistas y 10 preguntas ya hay 4000 respuestas, así que cualquier
 * agregado que no pagine calcula sobre una fracción de los datos.
 *
 * `build` tiene que armar la consulta de cero en cada página (los builders de
 * supabase-js no se pueden reutilizar) y conviene que tenga un `order` estable.
 */
export async function fetchAll<T>(
  build: (from: number, to: number) => PromiseLike<{
    data: unknown[] | null;
    error: { message: string } | null;
  }>,
  { pageSize = 1000, max = 500_000 }: { pageSize?: number; max?: number } = {},
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; from < max; from += pageSize) {
    const { data, error } = await build(from, from + pageSize - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as T[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }
  return rows;
}
