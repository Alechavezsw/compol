import * as React from "react";
import { cn } from "@/lib/utils";
import {
  INVOICE_STATUS_LABEL,
  ORG_STATUS_LABEL,
  ROLE_LABEL,
  SERVICE_LINE_LABEL,
  SURVEY_STATUS_LABEL,
  type InvoiceStatus,
  type OrgStatus,
  type ReportStatus,
  type ServiceLine,
  type SurveyStatus,
  type UserRole,
} from "@/lib/types";

export type Tone = "neutral" | "primary" | "success" | "warning" | "danger" | "accent";

const tones: Record<Tone, string> = {
  neutral: "bg-[var(--surface-2)] text-[var(--muted)] border-[var(--border)]",
  primary: "bg-[var(--primary-soft)] text-[var(--primary)] border-transparent",
  accent: "bg-[var(--accent-soft)] text-[var(--accent)] border-transparent",
  success: "bg-[var(--success-soft)] text-[var(--success)] border-transparent",
  warning: "bg-[var(--warning-soft)] text-[var(--warning)] border-transparent",
  danger: "bg-[var(--danger-soft)] text-[var(--danger)] border-transparent",
};

export function Badge({
  tone = "neutral",
  className,
  dot,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone; dot?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-wide whitespace-nowrap",
        tones[tone],
        className,
      )}
      {...props}
    >
      {dot ? <span className="size-1.5 rounded-full bg-current" /> : null}
      {props.children}
    </span>
  );
}

const surveyTone: Record<SurveyStatus, Tone> = {
  borrador: "neutral",
  activa: "success",
  pausada: "warning",
  cerrada: "primary",
};

export function SurveyStatusBadge({ status }: { status: SurveyStatus }) {
  return (
    <Badge tone={surveyTone[status]} dot={status === "activa"}>
      {SURVEY_STATUS_LABEL[status]}
    </Badge>
  );
}

const orgTone: Record<OrgStatus, Tone> = {
  activa: "success",
  suspendida: "danger",
  prueba: "warning",
};

export function OrgStatusBadge({ status }: { status: OrgStatus }) {
  return <Badge tone={orgTone[status]}>{ORG_STATUS_LABEL[status]}</Badge>;
}

const roleTone: Record<UserRole, Tone> = {
  super_admin: "primary",
  org_admin: "accent",
  org_analyst: "neutral",
  surveyor: "neutral",
};

export function RoleBadge({ role }: { role: UserRole }) {
  return <Badge tone={roleTone[role]}>{ROLE_LABEL[role]}</Badge>;
}

const reportTone: Record<ReportStatus, Tone> = {
  generando: "warning",
  listo: "success",
  error: "danger",
};

const reportLabel: Record<ReportStatus, string> = {
  generando: "Generando…",
  listo: "Listo",
  error: "Error",
};

export function ReportStatusBadge({ status }: { status: ReportStatus }) {
  return <Badge tone={reportTone[status]}>{reportLabel[status]}</Badge>;
}

const invoiceTone: Record<InvoiceStatus, Tone> = {
  pendiente: "warning",
  pagada: "success",
  vencida: "danger",
  anulada: "neutral",
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return <Badge tone={invoiceTone[status]}>{INVOICE_STATUS_LABEL[status]}</Badge>;
}

const serviceLineTone: Record<ServiceLine, Tone> = {
  opinion_publica: "primary",
  tracking: "accent",
  monitor_gestion: "warning",
  inteligencia_territorial: "success",
  banco_dirigentes: "primary",
  cualitativo: "neutral",
  laboratorio_opinion: "accent",
  radar_conversacion: "success",
  estudios_tematicos: "neutral",
  flash: "warning",
};

export function ServiceLineBadge({ line }: { line: ServiceLine }) {
  return <Badge tone={serviceLineTone[line]}>{SERVICE_LINE_LABEL[line]}</Badge>;
}
