"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { isDemoMode } from "@/lib/demo/mode";
import { clearDemoUser, getDemoProfile } from "@/lib/demo/session";
import { demoTables, resetDemoData } from "@/lib/demo/store";
import { homePathFor } from "@/lib/auth";

/**
 * Devuelve el dataset de la demo a su estado original. Si quien lo pidió es
 * uno de los usuarios de base, sigue logueado y vuelve a su panel; si era un
 * usuario creado durante la sesión, deja de existir y se lo manda al login.
 */
export async function resetDemoAction() {
  if (!isDemoMode()) return;
  const current = await getDemoProfile();
  resetDemoData();
  revalidatePath("/", "layout");

  const survivor = current ? demoTables().profiles.find((p) => p.id === current.id) : null;
  if (survivor) redirect(homePathFor(survivor.role));

  await clearDemoUser();
  redirect("/login");
}
