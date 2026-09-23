"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { homePathFor, isSupabaseConfigured } from "@/lib/auth";
import { isDemoMode } from "@/lib/demo/mode";
import { setDemoUser } from "@/lib/demo/session";
import { demoTables } from "@/lib/demo/store";

export type LoginState = { error?: string | null };

/** Ingreso de la demo: se elige un rol, no hay contraseña que validar. */
export async function signInDemoAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  if (!isDemoMode()) return { error: "El modo demo no está activo." };

  const userId = String(formData.get("user_id") ?? "");
  const profile = demoTables().profiles.find((p) => p.id === userId);

  if (!profile) return { error: "Elegí con qué rol querés entrar." };

  await setDemoUser(profile.id);
  redirect(homePathFor(profile.role));
}

export async function signInAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  if (!isSupabaseConfigured()) {
    return {
      error:
        "Supabase todavía no está configurado. Cargá NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local.",
    };
  }

  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = String(formData.get("next") ?? "");

  if (!email || !password) {
    return { error: "Ingresá tu correo y tu contraseña." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return {
      error:
        error.message === "Invalid login credentials"
          ? "Correo o contraseña incorrectos."
          : `No se pudo iniciar sesión: ${error.message}`,
    };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, is_active")
    .eq("id", data.user.id)
    .maybeSingle();

  if (profile && !profile.is_active) {
    await supabase.auth.signOut();
    return { error: "Tu usuario está desactivado. Contactá al administrador." };
  }

  redirect(next && next.startsWith("/") ? next : homePathFor(profile?.role ?? "surveyor"));
}
