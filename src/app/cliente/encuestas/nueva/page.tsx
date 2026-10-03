import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/misc";
import { Card, CardContent } from "@/components/ui/card";
import { SurveyForm } from "./survey-form";
import { requireOrganization } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Nueva encuesta" };

export default async function NuevaEncuestaPage() {
  const { organization } = await requireOrganization(["org_admin"]);
  const supabase = await createClient();

  const [{ data: surveys }, { data: projects }] = await Promise.all([
    supabase
      .from("surveys")
      .select("id, title")
      .eq("organization_id", organization.id)
      .order("updated_at", { ascending: false }),
    supabase
      .from("projects")
      .select("id, name")
      .eq("organization_id", organization.id)
      .order("name", { ascending: true }),
  ]);
  const ids = (surveys ?? []).map((s) => s.id);
  const { data: questions } = ids.length
    ? await supabase.from("questions").select("survey_id").in("survey_id", ids)
    : { data: [] as { survey_id: string }[] };

  const count = new Map<string, number>();
  for (const q of questions ?? []) count.set(q.survey_id, (count.get(q.survey_id) ?? 0) + 1);

  return (
    <div className="mx-auto max-w-2xl space-y-7">
      <PageHeader
        title="Nueva encuesta"
        description="Definí la ficha del relevamiento. En el paso siguiente cargás las preguntas, los saltos y el canal web."
      />
      <Card>
        <CardContent className="p-6">
          <SurveyForm
            surveys={(surveys ?? []).map((s) => ({ id: s.id, title: s.title, questions: count.get(s.id) ?? 0 }))}
            projects={(projects ?? []).map((p) => ({ id: p.id, name: p.name }))}
          />
        </CardContent>
      </Card>
    </div>
  );
}
