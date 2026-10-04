"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth";
import { slugify } from "@/lib/utils";
import type { InvoiceStatus, OrgStatus, OrgType, UserRole } from "@/lib/types";

export type ActionState = { error?: string | null; ok?: string | null };

const ORG_TYPES: OrgType[] = ["gobierno", "institucion", "ong", "privado"];
const ORG_STATUSES: OrgStatus[] = ["activa", "prueba", "suspendida"];
const ROLES: UserRole[] = ["super_admin", "org_admin", "org_analyst", "surveyor"];
const INVOICE_STATUSES: InvoiceStatus[] = ["pendiente", "pagada", "vencida", "anulada"];

export async function createOrganizationAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["super_admin"]);

  const name = String(formData.get("name") ?? "").trim();
  const type = String(formData.get("type") ?? "gobierno") as OrgType;
  const status = String(formData.get("status") ?? "prueba") as OrgStatus;
  const region = String(formData.get("region") ?? "").trim() || null;
  const contactEmail = String(formData.get("contact_email") ?? "").trim() || null;
  const contactPhone = String(formData.get("contact_phone") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (name.length < 3) return { error: "El nombre de la organización es demasiado corto." };
  if (!ORG_TYPES.includes(type)) return { error: "Tipo de organización inválido." };
  if (!ORG_STATUSES.includes(status)) return { error: "Estado inválido." };

  const supabase = await createClient();
  const base = slugify(name) || "organizacion";

  // El slug es unico: si ya existe, le agregamos un sufijo corto.
  let slug = base;
  for (let i = 0; i < 5; i += 1) {
    const { data: taken } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!taken) break;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const { error } = await supabase.from("organizations").insert({
    name,
    slug,
    type,
    status,
    region,
    contact_email: contactEmail,
    contact_phone: contactPhone,
    notes,
  });

  if (error) return { error: `No se pudo crear la organización: ${error.message}` };

  revalidatePath("/admin/organizaciones");
  revalidatePath("/admin");
  redirect("/admin/organizaciones");
}

export async function updateOrganizationStatusAction(formData: FormData) {
  await requireRole(["super_admin"]);

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as OrgStatus;
  if (!id || !ORG_STATUSES.includes(status)) return;

  const supabase = await createClient();
  await supabase.from("organizations").update({ status }).eq("id", id);
  revalidatePath("/admin/organizaciones");
}

export async function createUserAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["super_admin"]);

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const role = String(formData.get("role") ?? "surveyor") as UserRole;
  const organizationId = String(formData.get("organization_id") ?? "") || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;

  if (!email.includes("@")) return { error: "El correo no es válido." };
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };
  if (fullName.length < 3) return { error: "Ingresá el nombre y apellido." };
  if (!ROLES.includes(role)) return { error: "Rol inválido." };
  if (role !== "super_admin" && !organizationId) {
    return { error: "Los roles de cliente y de campo necesitan una organización." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Falta la service role key." };
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, role },
  });

  if (error || !data.user) {
    return { error: `No se pudo crear el usuario: ${error?.message ?? "error desconocido"}` };
  }

  // El trigger `on_auth_user_created` ya creó el perfil; completamos el resto.
  const { error: profileError } = await admin
    .from("profiles")
    .update({
      full_name: fullName,
      email,
      phone,
      role,
      organization_id: role === "super_admin" ? null : organizationId,
    })
    .eq("id", data.user.id);

  if (profileError) {
    return { error: `El usuario se creó pero no se pudo completar el perfil: ${profileError.message}` };
  }

  revalidatePath("/admin/usuarios");
  revalidatePath("/admin/encuestadores");
  const back = String(formData.get("volver") ?? "");
  redirect(back === "/admin/encuestadores" ? back : "/admin/usuarios");
}

export async function toggleUserActiveAction(formData: FormData) {
  const { profile } = await requireRole(["super_admin"]);

  const id = String(formData.get("id") ?? "");
  const next = String(formData.get("next") ?? "true") === "true";
  if (!id) return;
  // Bloquearse a uno mismo deja la plataforma sin nadie que pueda deshacerlo.
  if (id === profile.id && !next) return;

  const supabase = await createClient();
  await supabase.from("profiles").update({ is_active: next }).eq("id", id);
  revalidatePath("/admin/usuarios");
  revalidatePath("/admin/encuestadores");
}

// ---------------------------------------------------------------------------
// Equipo de campo
//
// Los encuestadores y sus asignaciones los gestiona solo la administración
// central: el cliente ve el avance, pero no arma ni modifica el equipo. La
// misma regla está en RLS (migración 05), esto es la primera barrera.
// ---------------------------------------------------------------------------

function parseZoneQuotas(formData: FormData): { rows: { zone: string; quota: number }[]; total: number } | { error: string } {
  const zones = formData.getAll("zones").map((v) => String(v).trim()).filter(Boolean);
  const quotas = formData.getAll("quotas").map((v) => Number(v));
  const rows: { zone: string; quota: number }[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < zones.length; i += 1) {
    const zone = zones[i].slice(0, 80);
    const quota = quotas[i];
    const key = zone.toLowerCase();
    if (seen.has(key)) continue;
    if (!Number.isInteger(quota) || quota < 1 || quota > 5000) {
      return { error: `La cuota de ${zone} tiene que ser un entero entre 1 y 5000.` };
    }
    seen.add(key);
    rows.push({ zone, quota });
  }
  if (!rows.length) return { error: "Cargá al menos un departamento con su cuota." };
  return { rows, total: rows.reduce((sum, r) => sum + r.quota, 0) };
}

async function replaceZoneQuotas(
  supabase: Awaited<ReturnType<typeof createClient>>,
  assignmentId: string,
  rows: { zone: string; quota: number }[],
) {
  await supabase.from("survey_zone_quotas").delete().eq("assignment_id", assignmentId);
  if (!rows.length) return;
  await supabase.from("survey_zone_quotas").insert(rows.map((r) => ({ assignment_id: assignmentId, ...r })));
}

async function loadAssignable(supabase: Awaited<ReturnType<typeof createClient>>, surveyId: string, surveyorId: string) {
  const [{ data: survey }, { data: surveyor }] = await Promise.all([
    supabase.from("surveys").select("id, title, status, organization_id, target_responses").eq("id", surveyId).maybeSingle(),
    supabase.from("profiles").select("id, full_name, role, organization_id, is_active").eq("id", surveyorId).maybeSingle(),
  ]);
  return { survey, surveyor };
}

export async function assignSurveyorAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireRole(["super_admin"]);

  const surveyId = String(formData.get("survey_id") ?? "");
  const surveyorId = String(formData.get("surveyor_id") ?? "");
  const parsed = parseZoneQuotas(formData);
  if ("error" in parsed) return { error: parsed.error };
  const quota = parsed.total;
  const zone = parsed.rows.length > 1 ? "Gran San Juan" : (parsed.rows[0]?.zone ?? null);

  if (!surveyId || !surveyorId) return { error: "Elegí la encuesta y el encuestador." };

  const supabase = await createClient();
  const { survey, surveyor } = await loadAssignable(supabase, surveyId, surveyorId);

  if (!survey) return { error: "No se encontró la encuesta." };
  if (!surveyor || surveyor.role !== "surveyor") return { error: "La persona elegida no es encuestadora." };
  if (!surveyor.is_active) return { error: `${surveyor.full_name} está bloqueado. Reactivalo antes de asignarle trabajo.` };
  if (surveyor.organization_id !== survey.organization_id) {
    return { error: "El encuestador pertenece a otra organización que la encuesta." };
  }
  if (survey.status === "cerrada") return { error: "La encuesta está cerrada: no admite nuevas asignaciones." };

  const { data: assignment, error } = await supabase
    .from("survey_assignments")
    .upsert({ survey_id: surveyId, surveyor_id: surveyorId, quota, zone }, { onConflict: "survey_id,surveyor_id" })
    .select("id")
    .single();
  if (error || !assignment) return { error: `No se pudo asignar: ${error?.message ?? "sin detalle"}` };
  await replaceZoneQuotas(supabase, assignment.id, parsed.rows);

  // Aviso útil: si las cuotas no alcanzan la meta, alguien va a tener que cubrir la diferencia.
  const { data: all } = await supabase.from("survey_assignments").select("quota").eq("survey_id", surveyId);
  const totalQuota = (all ?? []).reduce((s, a) => s + a.quota, 0);
  const gap = survey.target_responses - totalQuota;

  revalidatePath("/admin/encuestadores");
  revalidatePath(`/cliente/encuestas/${surveyId}`);
  revalidatePath("/campo");
  return {
    ok:
      gap > 0
        ? `${surveyor.full_name} asignado a «${survey.title}». Las cuotas suman ${totalQuota}: faltan ${gap} para la meta.`
        : `${surveyor.full_name} asignado a «${survey.title}». Las cuotas cubren la meta de ${survey.target_responses}.`,
  };
}

export async function updateAssignmentAction(formData: FormData) {
  await requireRole(["super_admin"]);
  const id = String(formData.get("id") ?? "");
  const parsed = parseZoneQuotas(formData);
  if (!id || "error" in parsed) return;

  const supabase = await createClient();
  const zone = parsed.rows.length > 1 ? "Gran San Juan" : (parsed.rows[0]?.zone ?? null);
  await supabase.from("survey_assignments").update({ quota: parsed.total, zone }).eq("id", id);
  await replaceZoneQuotas(supabase, id, parsed.rows);
  revalidatePath("/admin/encuestadores");
  revalidatePath("/campo");
}

export async function removeAssignmentAction(formData: FormData) {
  await requireRole(["super_admin"]);
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // Las entrevistas ya cargadas no se tocan: siguen en la base con su encuestador.
  const supabase = await createClient();
  await supabase.from("survey_assignments").delete().eq("id", id);
  revalidatePath("/admin/encuestadores");
  revalidatePath("/campo");
}

// ---------------------------------------------------------------------------
// Facturación
//
// Interna de la administración central: la consultora factura a cada
// organización cliente. Ningún otro rol lee ni escribe esta tabla (ver RLS).
// ---------------------------------------------------------------------------

export async function createInvoiceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireRole(["super_admin"]);

  const organizationId = String(formData.get("organization_id") ?? "");
  const number = String(formData.get("number") ?? "").trim();
  const concept = String(formData.get("concept") ?? "").trim();
  const amount = Number(formData.get("amount") ?? 0);
  const currency = String(formData.get("currency") ?? "ARS").trim() || "ARS";
  const dueAt = String(formData.get("due_at") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!organizationId) return { error: "Elegí la organización a facturar." };
  if (number.length < 2) return { error: "Ingresá el número de comprobante." };
  if (concept.length < 3) return { error: "Ingresá el concepto de la factura." };
  if (!Number.isFinite(amount) || amount <= 0) {
    return { error: "El monto tiene que ser mayor a cero." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("invoices").insert({
    organization_id: organizationId,
    number,
    concept,
    amount,
    currency,
    due_at: dueAt,
    notes,
  });

  if (error) return { error: `No se pudo crear la factura: ${error.message}` };

  revalidatePath("/admin/facturacion");
  revalidatePath("/admin/contabilidad");
  redirect("/admin/facturacion");
}

export async function updateInvoiceStatusAction(formData: FormData) {
  await requireRole(["super_admin"]);

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "") as InvoiceStatus;
  if (!id || !INVOICE_STATUSES.includes(status)) return;

  const supabase = await createClient();
  await supabase
    .from("invoices")
    .update({ status, paid_at: status === "pagada" ? new Date().toISOString() : null })
    .eq("id", id);

  revalidatePath("/admin/facturacion");
  revalidatePath("/admin/contabilidad");
}
