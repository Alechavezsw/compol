import type { Metadata } from "next";
import Script from "next/script";
import { notFound } from "next/navigation";
import { loadPublicSurvey } from "@/lib/web";
import type { WidgetMode } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Prueba del widget", robots: { index: false } };

const MODES: { mode: WidgetMode; label: string }[] = [
  { mode: "flotante", label: "Botón flotante" },
  { mode: "emergente", label: "Ventana emergente" },
  { mode: "inline", label: "Dentro de la página" },
];

/**
 * Sitio de mentira para ver el widget como lo vería un vecino en la web del
 * municipio. Carga el mismo /widget.js que se pega en un sitio real.
 */
export default async function WidgetPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ modo?: string }>;
}) {
  const { token } = await params;
  const { modo } = await searchParams;
  const data = await loadPublicSurvey(token);
  if (!data) notFound();

  const mode = (MODES.find((m) => m.mode === modo)?.mode ?? data.settings.mode) as WidgetMode;
  const org = data.organizationName ?? "Tu organización";

  return (
    <div className="force-light min-h-dvh bg-[#f6f7f9] text-[#1f2430]" style={{ backgroundImage: "none" }}>
      <style>{`body{background:#f6f7f9!important;background-image:none!important}`}</style>

      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-center gap-2 bg-[#14111f] px-4 py-2 text-xs text-white/80">
        <span className="font-semibold text-white">Vista de prueba del widget</span>
        <span className="hidden sm:inline">· así se ve en el sitio de {org} ·</span>
        {MODES.map((m) => (
          <a
            key={m.mode}
            href={`?modo=${m.mode}`}
            className={`rounded-full px-2.5 py-1 font-medium transition-colors ${m.mode === mode ? "bg-white text-[#14111f]" : "bg-white/10 hover:bg-white/20"}`}
          >
            {m.label}
          </a>
        ))}
      </div>

      <header className="border-b border-black/5 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full text-sm font-bold text-white" style={{ background: data.settings.accent }}>
              {org
                .split(" ")
                .filter((w) => w.length > 2)
                .slice(0, 2)
                .map((w) => w[0])
                .join("")}
            </span>
            <div className="leading-tight">
              <p className="text-[15px] font-bold">{org}</p>
              <p className="text-xs text-black/50">Portal oficial</p>
            </div>
          </div>
          <nav className="hidden gap-6 text-sm text-black/60 md:flex">
            <span>Trámites</span>
            <span>Noticias</span>
            <span className="font-semibold" style={{ color: data.settings.accent }}>
              Participación
            </span>
            <span>Contacto</span>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-12">
        <p className="text-xs font-bold tracking-[0.2em] uppercase" style={{ color: data.settings.accent }}>
          Participación ciudadana
        </p>
        <h1 className="mt-3 max-w-2xl text-4xl leading-tight font-extrabold tracking-tight">{data.survey.title}</h1>
        <p className="mt-4 max-w-2xl text-lg leading-relaxed text-black/60">
          {data.survey.description ?? "Queremos conocer tu opinión para tomar mejores decisiones."}
        </p>

        {mode === "inline" ? (
          <section className="mt-10 max-w-xl">
            <div id="encuesta-inline" className="overflow-hidden rounded-3xl bg-white shadow-[0_30px_70px_-40px_rgba(0,0,0,.35)] ring-1 ring-black/5" />
          </section>
        ) : (
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {["Nuevo cronograma de recolección", "Se inauguró la plaza del barrio", "Inscripciones a talleres culturales"].map((t, i) => (
              <article key={t} className="overflow-hidden rounded-2xl bg-white ring-1 ring-black/5">
                <div className="h-32" style={{ background: `linear-gradient(135deg, ${data.settings.accent}${["33", "22", "44"][i]}, #e5e7eb)` }} />
                <div className="p-5">
                  <p className="text-xs text-black/40">Hace {i + 2} días</p>
                  <h2 className="mt-1 font-semibold">{t}</h2>
                  <p className="mt-2 text-sm text-black/55">Texto de ejemplo de una noticia del portal institucional.</p>
                </div>
              </article>
            ))}
          </div>
        )}

        <p className="mt-12 text-sm text-black/45">
          {mode === "flotante"
            ? "El botón aparece abajo a la derecha."
            : mode === "emergente"
              ? `La ventana se abre sola a los ${data.settings.popupDelay} segundos (una vez por visita).`
              : "La encuesta está incrustada dentro del contenido."}
        </p>
      </main>

      <Script
        key={mode}
        id={`consulta-widget-${mode}`}
        src="/widget.js"
        strategy="afterInteractive"
        data-encuesta={token}
        data-modo={mode}
        data-color={data.settings.accent}
        data-texto={data.settings.buttonLabel}
        data-demora={String(data.settings.popupDelay)}
        data-contenedor="#encuesta-inline"
      />
    </div>
  );
}
