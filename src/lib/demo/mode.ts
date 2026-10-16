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
 * El modo demo se activa explícitamente con NEXT_PUBLIC_DEMO_MODE=true. En
 * desarrollo también se activa solo si no hay Supabase configurado, para que la
 * app arranque mostrando algo en lugar de una pantalla de error.
 *
 * En producción nunca es automático: la demo deja entrar como super_admin sin
 * contraseña, y un deploy al que le falten las variables de Supabase no puede
 * convertirse en eso por accidente. Sin Supabase y sin el flag, el login avisa
 * que falta la configuración.
 */
export function isDemoMode() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "true") return true;
  if (process.env.NEXT_PUBLIC_DEMO_MODE === "false") return false;
  if (process.env.NODE_ENV === "production") return false;
  return !isSupabaseConfigured();
}
