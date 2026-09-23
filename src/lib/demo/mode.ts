export const DEMO_COOKIE = "consulta_demo_user";

/**
 * Detección de modo. Vive en su propio módulo para que `auth.ts`, el proxy y
 * los clientes de Supabase puedan preguntarlo sin importarse entre sí.
 */

export function isSupabaseConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return Boolean(url && anon && !url.includes("xxxxxxxx"));
}

/**
 * El modo demo se activa explícitamente con NEXT_PUBLIC_DEMO_MODE=true, o solo
 * por no haber configurado Supabase. Así la app arranca mostrando algo real en
 * lugar de una pantalla de error.
 */
export function isDemoMode() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") return true;
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "false") return false;
  return !isSupabaseConfigured();
}
