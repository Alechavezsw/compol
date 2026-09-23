import { cookies } from "next/headers";
import { demoTables } from "@/lib/demo/store";
import { DEMO_COOKIE } from "@/lib/demo/mode";
import type { Profile } from "@/lib/types";

/** Perfil activo en la demo, según la cookie de selección de usuario. */
export async function getDemoProfile(): Promise<Profile | null> {
  const store = await cookies();
  const id = store.get(DEMO_COOKIE)?.value;
  if (!id) return null;
  return demoTables().profiles.find((p) => p.id === id) ?? null;
}

export async function setDemoUser(id: string) {
  const store = await cookies();
  store.set(DEMO_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function clearDemoUser() {
  const store = await cookies();
  store.delete(DEMO_COOKIE);
}
