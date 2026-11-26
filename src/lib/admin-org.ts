import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Organization } from "@/lib/types";
import type { requireClientViewer } from "@/lib/auth";

type Viewer = Awaited<ReturnType<typeof requireClientViewer>>;

/** Resuelve la org del panel: la del perfil, o la elegida por administración central. */
export async function resolveClientOrganization(
  viewer: Viewer,
  orgParam?: string | string[] | undefined,
): Promise<Organization | null> {
  if (!viewer.isCentralAdmin) return viewer.organization;

  const id = Array.isArray(orgParam) ? orgParam[0] : orgParam;
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) return null;

  const supabase = await createClient();
  const { data } = await supabase.from("organizations").select("*").eq("id", id).maybeSingle();
  return (data as Organization | null) ?? null;
}

export function withOrg(href: string, orgId: string | null | undefined) {
  if (!orgId) return href;
  const join = href.includes("?") ? "&" : "?";
  return `${href}${join}org=${orgId}`;
}

export async function listOrganizationsForPicker() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("id, name, region, type, brand_color")
    .order("name");
  return data ?? [];
}
