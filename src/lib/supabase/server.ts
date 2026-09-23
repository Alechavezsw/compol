import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";
import { isDemoMode } from "@/lib/demo/mode";
import { createDemoAdminClient, createDemoClient } from "@/lib/demo/client";
import { getDemoProfile } from "@/lib/demo/session";

/**
 * Cliente para Server Components, Route Handlers y Server Actions.
 * Escribe cookies cuando puede; en un Server Component la escritura falla y se
 * ignora a proposito (el refresco de sesion lo hace el proxy).
 *
 * En modo demo devuelve el cliente en memoria, que respeta la misma firma.
 */
export async function createClient() {
  if (isDemoMode()) {
    return createDemoClient(await getDemoProfile());
  }

  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component: no se pueden escribir cookies. Sin efecto.
          }
        },
      },
    },
  );
}

/**
 * Cliente con service role: ignora RLS. Solo para operaciones de la
 * administracion central (alta de usuarios, etc.). Nunca en el navegador.
 */
export function createAdminClient() {
  if (isDemoMode()) return createDemoAdminClient();

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "Falta SUPABASE_SERVICE_ROLE_KEY. Configuralo en .env.local para usar funciones de administracion.",
    );
  }

  return createSupabaseClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
