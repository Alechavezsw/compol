import { requireRole } from "@/lib/auth";
import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardContent } from "@/components/ui/card";
import { OrgForm } from "./org-form";

export const metadata: Metadata = { title: "Nueva organización" };

export default async function NuevaOrganizacionPage() {
  await requireRole(["super_admin"]);
  return (
    <div className="mx-auto max-w-2xl space-y-7">
      <PageHeader
        title="Nueva organización"
        description="Da de alta un cliente. Después vas a poder cargarle usuarios y encuestas."
      />
      <Card>
        <CardContent className="p-6">
          <OrgForm />
        </CardContent>
      </Card>
    </div>
  );
}
