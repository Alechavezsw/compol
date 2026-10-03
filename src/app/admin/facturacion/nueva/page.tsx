import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import type { Organization } from "@/lib/types";
import { InvoiceForm } from "./invoice-form";

export const metadata: Metadata = { title: "Nueva factura" };

export default async function NuevaFacturaPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organizations")
    .select("id, name")
    .order("name", { ascending: true });

  const organizations = (data ?? []) as Pick<Organization, "id" | "name">[];

  return (
    <div className="mx-auto max-w-2xl space-y-7">
      <PageHeader
        title="Nueva factura"
        description="Emití un comprobante para una organización cliente."
      />
      <Card>
        <CardContent className="p-6">
          <InvoiceForm organizations={organizations} />
        </CardContent>
      </Card>
    </div>
  );
}
