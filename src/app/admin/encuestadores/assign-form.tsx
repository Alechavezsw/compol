"use client";

import { useActionState, useMemo, useState } from "react";
import { UserPlus } from "lucide-react";
import { assignSurveyorAction, type ActionState } from "../actions";
import { Field, FormMessage, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";

type SurveyOption = { id: string; title: string; organization_id: string; remaining: number; status: string };
type SurveyorOption = { id: string; name: string; organization_id: string | null; assigned: string[] };

export function AssignForm({ surveys, surveyors }: { surveys: SurveyOption[]; surveyors: SurveyorOption[] }) {
  const [state, formAction] = useActionState<ActionState, FormData>(assignSurveyorAction, {});
  const [surveyorId, setSurveyorId] = useState("");
  const [surveyId, setSurveyId] = useState("");

  const surveyor = surveyors.find((s) => s.id === surveyorId);
  // Solo encuestas de su organización a las que todavía no está asignado.
  const available = useMemo(
    () =>
      surveyor
        ? surveys.filter((s) => s.organization_id === surveyor.organization_id && !surveyor.assigned.includes(s.id))
        : [],
    [surveyor, surveys],
  );
  const survey = available.find((s) => s.id === surveyId);

  return (
    <form action={formAction} className="space-y-4">
      <Field label="Encuestador">
        <Select
          name="surveyor_id"
          required
          value={surveyorId}
          onChange={(e) => {
            setSurveyorId(e.target.value);
            setSurveyId("");
          }}
        >
          <option value="" disabled>
            Elegir…
          </option>
          {surveyors.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Encuesta"
        hint={surveyor && !available.length ? "No quedan encuestas abiertas de su organización para asignarle." : undefined}
      >
        <Select name="survey_id" required value={surveyId} onChange={(e) => setSurveyId(e.target.value)} disabled={!surveyor}>
          <option value="" disabled>
            {surveyor ? "Elegir encuesta…" : "Primero elegí un encuestador"}
          </option>
          {available.map((s) => (
            <option key={s.id} value={s.id}>
              {s.title} {s.status === "borrador" ? "(borrador)" : ""}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cuota" hint={survey ? `Sin cubrir por otras cuotas: ${Math.max(0, survey.remaining)}` : undefined}>
          <Input
            key={surveyId}
            name="quota"
            type="number"
            min={1}
            max={5000}
            defaultValue={survey ? Math.max(10, Math.min(250, survey.remaining)) : 50}
            required
          />
        </Field>
        <Field label="Zona" hint="Opcional">
          <Input name="zone" placeholder="Centro y Norte" maxLength={80} />
        </Field>
      </div>

      {state.error ? <FormMessage>{state.error}</FormMessage> : null}
      {state.ok ? <FormMessage tone="success">{state.ok}</FormMessage> : null}

      <SubmitButton pendingLabel="Asignando…" className="w-full">
        <UserPlus />
        Asignar
      </SubmitButton>
    </form>
  );
}
