import type { Metadata } from "next";
import Link from "next/link";
import { IdCard } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { ButtonLink } from "@/components/ui/button";
import { Avatar } from "@/components/ui/misc";
import { createClient } from "@/lib/supabase/server";
import { requireOrganization } from "@/lib/auth";
import { formatPercent } from "@/lib/utils";
import type { Dirigente, DirigenteMedicion } from "@/lib/types";

export const metadata: Metadata = { title: "Banco de dirigentes" };

export default async function DirigentesPage() {
  const { organization, profile } = await requireOrganization(["org_admin", "org_analyst"]);
  const supabase = await createClient();

  const { data: dirigentesData } = await supabase
    .from("dirigentes")
    .select("*")
    .eq("organization_id", organization.id)
    .order("name", { ascending: true });
  const dirigentes = (dirigentesData ?? []) as Dirigente[];

  const ids = dirigentes.map((d) => d.id);
  const { data: medicionesData } = ids.length
    ? await supabase.from("dirigente_mediciones").select("*").in("dirigente_id", ids)
    : { data: [] as DirigenteMedicion[] };
  const mediciones = (medicionesData ?? []) as DirigenteMedicion[];

  const latestByDirigente = new Map<string, DirigenteMedicion>();
  for (const m of mediciones) {
    const current = latestByDirigente.get(m.dirigente_id);
    if (!current || new Date(m.measured_at) > new Date(current.measured_at)) {
      latestByDirigente.set(m.dirigente_id, m);
    }
  }

  const canManage = profile.role === "org_admin";

  return (
    <div className="space-y-7">
      <PageHeader
        title="Banco de dirigentes"
        description="Fichas longitudinales de conocimiento e imagen: quién sube, quién baja y por qué."
        actions={canManage ? <ButtonLink href="/cliente/dirigentes/nuevo">Nuevo dirigente</ButtonLink> : null}
      />

      {dirigentes.length === 0 ? (
        <EmptyState
          icon={<IdCard className="size-5" />}
          title="Todavía no hay dirigentes cargados"
          description="Creá una ficha por cada dirigente que seguís y cargale mediciones en cada ola."
          action={canManage ? <ButtonLink href="/cliente/dirigentes/nuevo">Crear el primero</ButtonLink> : null}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dirigentes.map((d) => {
            const latest = latestByDirigente.get(d.id);
            return (
              <Link
                key={d.id}
                href={`/cliente/dirigentes/${d.id}`}
                className="flex flex-col gap-3 rounded-[22px] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_92%,transparent)] p-5 shadow-[var(--shadow-card)] transition-all hover:-translate-y-1 hover:border-[color-mix(in_oklab,var(--primary)_35%,var(--border))]"
              >
                <div className="flex items-center gap-3">
                  <Avatar name={d.name} src={d.photo_url} size={40} />
                  <div className="min-w-0">
                    <p className="truncate text-[15px] font-semibold text-[var(--foreground)]">
                      {d.name}
                    </p>
                    <p className="truncate text-xs text-[var(--muted)]">
                      {d.role ?? "Sin cargo"}
                      {d.affiliation ? ` · ${d.affiliation}` : ""}
                    </p>
                  </div>
                </div>

                {latest ? (
                  <div className="grid grid-cols-3 gap-2 border-t border-[var(--border)] pt-3">
                    <div>
                      <p className="text-[11px] text-[var(--muted)]">Conocimiento</p>
                      <p className="display text-lg text-[var(--foreground)]">
                        {formatPercent(latest.conocimiento)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[var(--muted)]">Imagen +</p>
                      <p className="display text-lg text-[var(--success)]">
                        {formatPercent(latest.imagen_positiva)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[11px] text-[var(--muted)]">Imagen −</p>
                      <p className="display text-lg text-[var(--danger)]">
                        {formatPercent(latest.imagen_negativa)}
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="border-t border-[var(--border)] pt-3 text-xs text-[var(--muted)]">
                    Sin mediciones todavía.
                  </p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
