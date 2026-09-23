import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { WebSurvey } from "./web-survey";
import { loadPublicSurvey } from "@/lib/web";

// Página pública: depende del estado de la encuesta, nunca se prerenderiza.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ token: string }> }): Promise<Metadata> {
  const { token } = await params;
  const data = await loadPublicSurvey(token);
  if (!data) return { title: "Encuesta no disponible", robots: { index: false } };
  return {
    title: data.settings.welcomeTitle,
    description: data.settings.welcomeText,
    robots: { index: false, follow: false },
    openGraph: { title: data.settings.welcomeTitle, description: data.settings.welcomeText },
  };
}

export default async function PublicSurveyPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const query = await searchParams;
  const data = await loadPublicSurvey(token);
  if (!data) notFound();

  const first = (key: string) => {
    const v = query[key];
    return Array.isArray(v) ? v[0] : v;
  };
  const embed = first("embed") === "1";
  const mode = first("modo");

  return (
    <>
      {embed ? (
        // Dentro del iframe el fondo lo pone la tarjeta, no la app.
        <style>{`html,body{background:transparent!important;background-image:none!important;min-height:0!important}`}</style>
      ) : null}
      <WebSurvey
        token={token}
        questions={data.questions}
        settings={data.settings}
        organizationName={data.organizationName}
        embed={embed}
        closable={embed && (mode === "flotante" || mode === "emergente")}
        sourceUrl={first("ref") ?? null}
        open={data.survey.status === "activa"}
      />
    </>
  );
}
