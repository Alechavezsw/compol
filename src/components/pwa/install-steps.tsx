import { EllipsisVertical, MonitorDown, Share, SquarePlus } from "lucide-react";
import type { InstallPlatform } from "./install-store";

type Step = { icon: React.ReactNode; text: React.ReactNode };

const STEPS: Record<InstallPlatform, { title: string; steps: Step[] }> = {
  ios: {
    title: "En iPhone o iPad",
    steps: [
      {
        icon: <Share className="size-4" />,
        text: (
          <>
            Tocá <strong>Compartir</strong> en la barra de Safari (el cuadrado con la flecha hacia arriba).
          </>
        ),
      },
      {
        icon: <SquarePlus className="size-4" />,
        text: (
          <>
            Elegí <strong>Agregar a inicio</strong>. Si no aparece, deslizá la lista hacia abajo.
          </>
        ),
      },
      {
        icon: <span className="text-[11px] font-bold">OK</span>,
        text: (
          <>
            Confirmá con <strong>Agregar</strong>. El ícono de Consulta queda en tu pantalla de inicio.
          </>
        ),
      },
    ],
  },
  android: {
    title: "En Android",
    steps: [
      {
        icon: <EllipsisVertical className="size-4" />,
        text: (
          <>
            Abrí el menú del navegador (los <strong>tres puntos</strong>, arriba a la derecha).
          </>
        ),
      },
      {
        icon: <SquarePlus className="size-4" />,
        text: (
          <>
            Tocá <strong>Instalar app</strong> o <strong>Agregar a pantalla principal</strong>.
          </>
        ),
      },
      {
        icon: <span className="text-[11px] font-bold">OK</span>,
        text: <>Confirmá. Consulta queda entre tus apps, como cualquier otra.</>,
      },
    ],
  },
  desktop: {
    title: "En la computadora",
    steps: [
      {
        icon: <MonitorDown className="size-4" />,
        text: (
          <>
            En Chrome o Edge, tocá el ícono de <strong>instalar</strong> al final de la barra de direcciones.
          </>
        ),
      },
      {
        icon: <EllipsisVertical className="size-4" />,
        text: (
          <>
            Si no lo ves: menú del navegador → <strong>Transmitir, guardar y compartir</strong> →{" "}
            <strong>Instalar Consulta</strong>. En Safari: Archivo → <strong>Agregar al Dock</strong>.
          </>
        ),
      },
    ],
  },
};

export function InstallSteps({ platform, compact = false }: { platform: InstallPlatform; compact?: boolean }) {
  const { title, steps } = STEPS[platform];
  return (
    <div>
      {!compact ? (
        <p className="text-xs font-semibold tracking-[0.14em] text-[var(--muted)] uppercase">{title}</p>
      ) : null}
      <ol className={compact ? "space-y-3" : "mt-3 space-y-3"}>
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3 text-sm leading-snug text-[var(--foreground)]">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
              {step.icon}
            </span>
            <span className="pt-1.5">{step.text}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
