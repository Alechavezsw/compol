"use client";

import { useActionState, useState } from "react";
import { Check, Copy, ExternalLink, Globe, MonitorSmartphone, RefreshCw, Save } from "lucide-react";
import { regenerateTokenAction, updateWebChannelAction, type ActionState } from "../../actions";
import { Field, FormMessage, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import type { WebSettings, WidgetMode } from "@/lib/types";
import { cn } from "@/lib/utils";

const MODES: { value: WidgetMode; label: string; hint: string }[] = [
  { value: "flotante", label: "Botón flotante", hint: "Un botón fijo en la esquina abre la encuesta." },
  { value: "emergente", label: "Ventana emergente", hint: "Se abre sola a los segundos que indiques, una vez por visita." },
  { value: "inline", label: "Dentro de la página", hint: "La encuesta queda incrustada en un bloque del sitio." },
];

const SWATCHES = ["#3d2de0", "#0d9488", "#0284c7", "#c2410c", "#be185d", "#15803d", "#1f2937"];

function CopyBlock({ label, code }: { label: string; code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-medium text-[var(--muted)]">{label}</span>
        <button
          type="button"
          onClick={() => {
            navigator.clipboard?.writeText(code).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1800);
            });
          }}
          className={cn(
            "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-colors",
            copied ? "text-[var(--success)]" : "text-[var(--primary)] hover:bg-[var(--primary-soft)]",
          )}
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <pre className="overflow-x-auto rounded-xl bg-[#14111f] p-3 font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap break-all text-[#d9d3f5]">
        {code}
      </pre>
    </div>
  );
}

export function WebChannelCard({
  surveyId,
  surveyStatus,
  enabled,
  token,
  settings,
  origin,
  webResponses,
}: {
  surveyId: string;
  surveyStatus: string;
  enabled: boolean;
  token: string | null;
  settings: WebSettings;
  origin: string;
  webResponses: number;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(updateWebChannelAction, {});
  const [on, setOn] = useState(enabled);
  const [mode, setMode] = useState<WidgetMode>(settings.mode ?? "flotante");
  const [accent, setAccent] = useState(settings.accent ?? "#3d2de0");
  const [tab, setTab] = useState<"codigo" | "config">(enabled && token ? "codigo" : "config");

  const link = token ? `${origin}/e/${token}` : null;
  const scriptTag = token
    ? `<script src="${origin}/widget.js" data-encuesta="${token}" data-modo="${mode}" data-color="${accent}"${
        mode === "inline" ? ' data-contenedor="#encuesta"' : ""
      }${settings.button_label ? ` data-texto="${settings.button_label.replace(/"/g, "&quot;")}"` : ""}${
        mode === "emergente" ? ` data-demora="${settings.popup_delay ?? 6}"` : ""
      } async></script>`
    : "";
  const iframeTag = link
    ? `<iframe src="${link}?embed=1" title="Encuesta" style="width:100%;max-width:560px;height:640px;border:0;border-radius:20px" loading="lazy"></iframe>`
    : "";

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-2xl",
            enabled ? "bg-[var(--accent-soft)] text-[var(--accent)]" : "bg-[var(--surface-2)] text-[var(--muted)]",
          )}
        >
          <Globe className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-[var(--foreground)]">Encuesta web y widget</p>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {enabled
              ? `${webResponses} respuestas web · ${surveyStatus === "activa" ? "recibiendo respuestas" : "se abre cuando la encuesta esté en campo"}`
              : "Publicala en tu sitio o redes: se responde sola, sin encuestador."}
          </p>
        </div>
      </div>

      {enabled && token ? (
        <div className="flex rounded-xl bg-[var(--surface-2)] p-1 text-sm">
          {(
            [
              ["codigo", "Publicar"],
              ["config", "Personalizar"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={cn(
                "flex-1 rounded-lg py-1.5 font-medium transition-colors",
                tab === value ? "bg-[var(--surface)] text-[var(--foreground)] shadow-sm" : "text-[var(--muted)]",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {tab === "codigo" && enabled && link ? (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <a
              href={`/e/${token}/prueba?modo=${mode}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--primary)] px-3 text-sm font-medium text-[var(--primary-fg)] hover:brightness-110"
            >
              <MonitorSmartphone className="size-4" />
              Ver en un sitio de prueba
            </a>
            <a
              href={link}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] px-3 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-2)]"
            >
              <ExternalLink className="size-4" />
              Abrir link
            </a>
          </div>
          <CopyBlock label="Link directo (para WhatsApp, mail o redes)" code={link} />
          <CopyBlock label={`Widget · ${MODES.find((m) => m.value === mode)?.label}`} code={scriptTag} />
          {mode === "inline" ? (
            <p className="-mt-2 text-xs text-[var(--muted)]">
              Poné <code className="font-mono">{'<div id="encuesta"></div>'}</code> donde quieras que aparezca.
            </p>
          ) : null}
          <CopyBlock label="Iframe simple (sin JavaScript)" code={iframeTag} />
          <form action={regenerateTokenAction} className="flex items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
            <input type="hidden" name="survey_id" value={surveyId} />
            <p className="text-xs text-[var(--muted)]">¿Se filtró el link? Generá uno nuevo: el anterior deja de funcionar.</p>
            <button type="submit" className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[var(--danger)] hover:bg-[var(--danger-soft)]">
              <RefreshCw className="size-3.5" />
              Nuevo link
            </button>
          </form>
        </div>
      ) : (
        <form action={formAction} className="space-y-4">
          <input type="hidden" name="survey_id" value={surveyId} />

          <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-[var(--border)] px-4 py-3">
            <span>
              <span className="block text-sm font-medium text-[var(--foreground)]">Habilitar canal web</span>
              <span className="block text-xs text-[var(--muted)]">Genera un link público y el código del widget.</span>
            </span>
            <input type="checkbox" name="web_enabled" checked={on} onChange={(e) => setOn(e.target.checked)} className="peer sr-only" />
            <span className="relative h-6 w-11 shrink-0 rounded-full bg-[var(--border)] transition-colors peer-checked:bg-[var(--accent)] after:absolute after:top-0.5 after:left-0.5 after:size-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:after:translate-x-5" />
          </label>

          <div className={cn("space-y-4", !on && "pointer-events-none opacity-50")}>
            <Field label="Formato del widget">
              <div className="grid gap-2">
                {MODES.map((m) => (
                  <label
                    key={m.value}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-2.5 transition-colors",
                      mode === m.value ? "border-[var(--primary)] bg-[var(--primary-soft)]" : "border-[var(--border)] hover:bg-[var(--surface-2)]",
                    )}
                  >
                    <input type="radio" name="mode" value={m.value} checked={mode === m.value} onChange={() => setMode(m.value)} className="mt-1 accent-[var(--primary)]" />
                    <span>
                      <span className="block text-sm font-medium text-[var(--foreground)]">{m.label}</span>
                      <span className="block text-xs text-[var(--muted)]">{m.hint}</span>
                    </span>
                  </label>
                ))}
              </div>
            </Field>

            <Field label="Color">
              <div className="flex flex-wrap items-center gap-2">
                {SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setAccent(c)}
                    aria-label={`Color ${c}`}
                    className={cn("size-7 rounded-full ring-offset-2 ring-offset-[var(--surface)] transition-transform hover:scale-110", accent === c && "ring-2 ring-[var(--foreground)]")}
                    style={{ background: c }}
                  />
                ))}
                <Input name="accent" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-8 w-24 font-mono text-xs" maxLength={7} />
              </div>
            </Field>

            <Field label="Título de bienvenida">
              <Input name="welcome_title" defaultValue={settings.welcome_title ?? ""} placeholder="¿Qué obra querés para tu barrio?" maxLength={120} />
            </Field>
            <Field label="Texto de bienvenida">
              <Textarea name="welcome_text" defaultValue={settings.welcome_text ?? ""} rows={2} maxLength={400} placeholder="Son pocas preguntas y es anónima." />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Texto del botón">
                <Input name="button_label" defaultValue={settings.button_label ?? ""} placeholder="Responder encuesta" maxLength={40} />
              </Field>
              <Field label="Demora de la emergente (s)">
                <Input name="popup_delay" type="number" min={0} max={120} defaultValue={settings.popup_delay ?? 6} disabled={mode !== "emergente"} />
              </Field>
            </div>
            <Field label="Título de agradecimiento">
              <Input name="thanks_title" defaultValue={settings.thanks_title ?? ""} placeholder="¡Gracias por participar!" maxLength={120} />
            </Field>
            <Field label="Texto de agradecimiento">
              <Textarea name="thanks_text" defaultValue={settings.thanks_text ?? ""} rows={2} maxLength={400} placeholder="Los resultados se publican en…" />
            </Field>
            <label className="flex items-start gap-2.5 text-sm text-[var(--foreground)]">
              <input type="checkbox" name="one_per_device" defaultChecked={settings.one_per_device ?? true} className="mt-0.5 size-4 accent-[var(--primary)]" />
              <span>
                Una respuesta por dispositivo
                <span className="block text-xs text-[var(--muted)]">Huella anónima: no guarda IP ni datos personales.</span>
              </span>
            </label>
          </div>

          {state.error ? <FormMessage>{state.error}</FormMessage> : null}
          {state.ok ? <FormMessage tone="success">{state.ok}</FormMessage> : null}

          <SubmitButton pendingLabel="Guardando…" className="w-full">
            <Save />
            Guardar canal web
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
