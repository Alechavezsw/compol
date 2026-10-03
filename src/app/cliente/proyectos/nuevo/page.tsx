import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardContent } from "@/components/ui/card";
import { ProyectoForm } from "./proyecto-form";

export const metadata: Metadata = { title: "Nuevo proyecto" };

export default function NuevoProyectoPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-7">
      <PageHeader
        title="Nuevo proyecto"
        description="Un proyecto agrupa las olas de una misma línea de servicio: tracking, monitor de gestión, un estudio puntual."
      />
      <Card>
        <CardContent className="p-6">
          <ProyectoForm />
        </CardContent>
      </Card>
    </div>
  );
}
