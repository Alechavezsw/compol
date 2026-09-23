import { redirect } from "next/navigation";
import { getSessionProfile, homePathFor } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Punto de entrada neutro: manda a cada usuario a su area segun el rol. */
export default async function InicioPage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  redirect(homePathFor(session.profile.role));
}
