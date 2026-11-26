import Link from "next/link";
import { Building2 } from "lucide-react";
import { OrgMark } from "@/components/org-mark";
import { EmptyState, PageHeader } from "@/components/ui/misc";
import { Card, CardContent } from "@/components/ui/card";
import { ORG_TYPE_LABEL, type OrgType } from "@/lib/types";
import { withOrg } from "@/lib/admin-org";

type OrgRow = {
  id: string;
  name: string;
  region: string | null;
  type: OrgType;
  brand_color: string | null;
};

export function AdminOrgPicker({
  title,
  description,
  nextPath,
  organizations,
}: {
  title: string;
  description: string;
  nextPath: string;
  organizations: OrgRow[];
}) {
  return (
    <div className="space-y-7">
      <PageHeader title={title} description={description} />
      {organizations.length === 0 ? (
        <EmptyState
          icon={<Building2 className="size-5" />}
          title="No hay organizaciones"
          description="Creá un cliente para usar esta herramienta."
        />
      ) : (
        <Card>
          <CardContent className="grid gap-2 p-4 sm:grid-cols-2">
            {organizations.map((o) => (
              <Link
                key={o.id}
                href={withOrg(nextPath, o.id)}
                className="flex items-center gap-3 rounded-2xl border border-[var(--border)] p-3 transition-all hover:-translate-y-0.5 hover:border-[color-mix(in_oklab,var(--primary)_35%,var(--border))] hover:bg-[var(--surface-2)]"
              >
                <OrgMark type={o.type} brandColor={o.brand_color} name={o.name} id={o.id} size="sm" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-[var(--foreground)]">{o.name}</span>
                  <span className="mt-0.5 block truncate text-xs text-[var(--muted)]">
                    {ORG_TYPE_LABEL[o.type]}
                    {o.region ? ` · ${o.region}` : ""}
                  </span>
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
