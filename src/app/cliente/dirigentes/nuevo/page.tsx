import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardContent } from "@/components/ui/card";
import { DirigenteForm } from "./dirigente-form";

export const metadata: Metadata = { title: "Nuevo dirigente" };

export default function NuevoDirigentePage() {
  return (
    <div className="mx-auto max-w-2xl space-y-7">
      <PageHeader
        title="Nuevo dirigente"
        description="Creá la ficha. Después le vas a cargar una medición por cada ola en la que lo sigas."
      />
      <Card>
        <CardContent className="p-6">
          <DirigenteForm />
        </CardContent>
      </Card>
    </div>
  );
}
