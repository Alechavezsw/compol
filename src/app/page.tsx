import {
  ArrowRight,
  BarChart3,
  Building2,
  ClipboardList,
  Lock,
  MapPin,
  Smartphone,
  Sparkles,
  Users,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { ThemeToggle } from "@/components/theme-toggle";
import { HeroPreview } from "@/components/hero-preview";
import { Photo, Polaroid } from "@/components/photo";
import { getSessionProfile, homePathFor } from "@/lib/auth";

const IMG = {
  hero: "/landing/catedral.jpg",
  plaza: "/landing/plaza.jpg",
  peatonal: "/landing/peatonal2.jpg",
  civico: "/landing/civico.jpg",
  ullum: "/landing/ullum2.jpg",
  vinedos: "/landing/vinedos.jpg",
  ciudad: "/landing/ciudad.jpg",
  parque: "/landing/parque.jpg",
  plan: "/landing/tablero.jpg",
  laptop: "/landing/celular.jpg",
};

const MODULES = [
  {
    icon: ClipboardList,
    title: "Constructor de cuestionarios",
    text: "Opción única y múltiple, escalas, numéricas, abiertas y filtros. Secciones, obligatoriedad y cuotas por encuestador.",
    image: IMG.plan,
    alt: "Manos armando el cuestionario sobre papel y laptop",
  },
  {
    icon: Smartphone,
    title: "Campo en el celular",
    text: "Los encuestadores cargan cara a cara desde cualquier teléfono, con avance sobre su cuota y registro de zona y duración.",
    image: IMG.peatonal,
    alt: "Gente transitando la peatonal Rivadavia, en San Juan",
  },
  {
    icon: BarChart3,
    title: "Tablero en vivo",
    text: "Distribuciones, evolución diaria, rendimiento por encuestador y por zona. Sin esperar al cierre del relevamiento.",
    image: IMG.laptop,
    alt: "Consulta de resultados en una computadora",
  },
  {
    icon: Sparkles,
    title: "Informes con IA",
    text: "Gemini redacta el informe ejecutivo, técnico o comunicacional sobre los agregados reales, citando la base de cada cifra.",
    image: IMG.ciudad,
    alt: "Vista de la ciudad de San Juan hacia la precordillera",
  },
  {
    icon: Building2,
    title: "Multi-cliente",
    text: "Cada organismo ve solo lo suyo. La administración central gestiona altas, planes y equipos desde un único lugar.",
    image: IMG.civico,
    alt: "Centro Cívico de San Juan",
  },
  {
    icon: Lock,
    title: "Aislamiento por fila",
    text: "Las políticas de acceso viven en la base de datos, no en el frontend. Un cliente no puede leer datos de otro.",
    image: IMG.parque,
    alt: "Laguna del Parque de Mayo, San Juan",
  },
];

const STEPS = [
  {
    n: "01",
    title: "La consultora da de alta al organismo",
    text: "Desde la administración central se crea el cliente, se define su plan y se cargan los usuarios que van a operar.",
    image: IMG.civico,
    alt: "Centro Cívico de San Juan, sede de la administración provincial",
    word: "Centro Cívico",
  },
  {
    n: "02",
    title: "Se diseña el cuestionario y sale a campo",
    text: "El equipo arma la encuesta, fija la meta muestral y asigna cuotas y zonas a cada encuestador.",
    image: IMG.peatonal,
    alt: "Peatonal de San Juan, donde se releva cara a cara",
    word: "Cara a cara",
  },
  {
    n: "03",
    title: "El cliente sigue todo desde su panel",
    text: "Ve el avance en tiempo real, explora los resultados y pide informes redactados por el motor de IA.",
    image: IMG.ciudad,
    alt: "San Juan capital y la precordillera",
    word: "Tablero",
  },
];

export default async function LandingPage() {
  const session = await getSessionProfile();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--background)_72%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <Logo />
          <div className="flex items-center gap-2 sm:gap-3">
            <ThemeToggle className="hidden sm:inline-flex" />
            {session ? (
              <ButtonLink href={homePathFor(session.profile.role)} size="sm">
                Ir a mi panel
                <ArrowRight />
              </ButtonLink>
            ) : (
              <ButtonLink href="/login" size="sm">
                Ingresar
              </ButtonLink>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative min-h-[88vh] overflow-hidden">
          <Photo
            src={IMG.hero}
            alt="Catedral de San Juan Bautista y su campanil, frente a la Plaza 25 de Mayo"
            priority
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/55 to-black/20" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/50 to-transparent" />

          <div className="relative mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 sm:py-20 lg:grid-cols-[1.05fr_.95fr] lg:py-24">
            <div className="animate-rise text-white">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-medium text-white/85 backdrop-blur">
                <span className="size-1.5 rounded-full bg-[#2dd4bf] animate-pulse-soft" />
                Hecho para operar en San Juan y en cada organismo
              </span>

              <h1 className="display mt-6 text-5xl leading-[1.02] text-balance sm:text-6xl lg:text-[4.35rem]">
                Del trabajo de campo al informe,{" "}
                <em className="not-italic text-[#c4b8ff]">en la misma plataforma</em>.
              </h1>

              <p className="mt-6 max-w-xl text-base leading-relaxed text-white/75 sm:text-lg">
                De la Plaza 25 de Mayo a la peatonal: diseñá el cuestionario, coordiná a los
                encuestadores y entregale a cada organismo su tablero, con informes escritos sobre
                los datos reales del relevamiento.
              </p>

              <div className="mt-8 flex flex-wrap gap-2">
                {["Plaza 25", "Catedral", "Peatonal", "Ullum"].map((w) => (
                  <span
                    key={w}
                    className="rounded-full border border-white/20 bg-white/8 px-3 py-1 text-[12px] font-medium tracking-wide text-white/80"
                  >
                    {w}
                  </span>
                ))}
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <ButtonLink href="/login" size="lg">
                  Entrar a la plataforma
                  <ArrowRight />
                </ButtonLink>
                <ButtonLink
                  href="#modulos"
                  variant="outline"
                  size="lg"
                  className="border-white/25 bg-white/10 text-white hover:bg-white/18"
                >
                  Ver los módulos
                </ButtonLink>
              </div>
            </div>

            <div className="animate-rise" style={{ animationDelay: "90ms" }}>
              <HeroPreview />
            </div>
          </div>
        </section>

        <section className="relative mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--primary)] uppercase">
              San Juan
            </p>
            <h2 className="display mt-3 text-4xl text-[var(--foreground)] sm:text-5xl">
              La encuesta pasa en la calle, no en una planilla.
            </h2>
            <p className="mt-4 text-[var(--muted)]">
              Fotos reales de la ciudad: la plaza, la peatonal, el Centro Cívico y el dique de
              Ullum. Ahí se pregunta. Acá se ve el resultado.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-2 items-end gap-4 md:grid-cols-4">
            <Polaroid
              src={IMG.plaza}
              alt="Gente caminando por la Plaza 25 de Mayo"
              caption="Plaza 25"
              className="-rotate-2"
            />
            <Polaroid
              src={IMG.peatonal}
              alt="Peatonal Rivadavia con vecinos y comercios"
              caption="Peatonal"
              className="rotate-3 md:mb-10"
            />
            <Polaroid
              src={IMG.civico}
              alt="Centro Cívico de San Juan"
              caption="Cívico"
              className="-rotate-1"
            />
            <Polaroid
              src={IMG.ullum}
              alt="Quebrada y dique de Ullum, San Juan"
              caption="Ullum"
              className="rotate-2 md:mb-6"
            />
          </div>
        </section>

        <section id="modulos" className="mx-auto w-full max-w-6xl px-4 pb-16 sm:px-6 sm:pb-24">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-[var(--primary)] uppercase">
              El ciclo completo
            </p>
            <h2 className="display mt-3 text-4xl text-[var(--foreground)] sm:text-5xl">
              Todo el ciclo de una encuesta
            </h2>
            <p className="mt-4 text-[var(--muted)]">
              Sin planillas sueltas ni bases que viajan por mail entre el operativo y la dirección.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map(({ icon: Icon, title, text, image, alt }, i) => (
              <article
                key={title}
                className="group overflow-hidden rounded-[22px] border border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_90%,transparent)] shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-1 hover:border-[color-mix(in_oklab,var(--primary)_40%,var(--border))]"
              >
                <div className="relative h-40 overflow-hidden">
                  <Photo
                    src={image}
                    alt={alt}
                    className="transition-transform duration-500 group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, 33vw"
                  />
                  <span className="absolute top-3 left-3 display rounded-full bg-black/45 px-2.5 py-0.5 text-sm text-white backdrop-blur-sm">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <div className="p-6">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-4 text-[17px] font-semibold text-[var(--foreground)]">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="relative overflow-hidden border-y border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_70%,transparent)]">
          <div className="relative mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20">
            <h2 className="display text-4xl text-[var(--foreground)] sm:text-5xl">Cómo se opera</h2>
            <ol className="mt-12 grid gap-6 md:grid-cols-3">
              {STEPS.map((s) => (
                <li
                  key={s.n}
                  className="overflow-hidden rounded-[22px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)]"
                >
                  <div className="relative h-48">
                    <Photo src={s.image} alt={s.alt} sizes="(max-width: 768px) 100vw, 33vw" />
                    <span className="absolute bottom-3 left-3 display rounded-full bg-white/92 px-3 py-1 text-lg text-[var(--foreground)] shadow-sm">
                      {s.word}
                    </span>
                  </div>
                  <div className="p-6">
                    <span className="display text-3xl gradient-text">{s.n}</span>
                    <h3 className="mt-3 font-semibold text-[var(--foreground)]">{s.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-5">
          <div className="overflow-hidden rounded-[22px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)] lg:col-span-3">
            <div className="relative h-56 sm:h-64">
              <Photo
                src={IMG.vinedos}
                alt="Viñedos sanjuaninos con la precordillera de fondo"
                sizes="(max-width: 1024px) 100vw, 60vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[var(--surface)] via-transparent to-transparent" />
            </div>
            <div className="relative -mt-10 p-8 pt-0">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent)]">
                <Sparkles className="size-5" />
              </span>
              <h2 className="display mt-5 text-3xl text-[var(--foreground)]">
                El motor de IA no improvisa
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[var(--muted)]">
                El informe se genera sobre los agregados calculados en la base: porcentajes, bases
                muestrales, evolución y textuales. El modelo recibe ese resumen y nada más, con la
                instrucción explícita de citar la base de cada cifra y advertir cuando un subgrupo es
                demasiado chico para sostener una lectura.
              </p>
              <ul className="mt-6 grid gap-2 text-sm text-[var(--muted)] sm:grid-cols-2">
                {[
                  "Informe ejecutivo",
                  "Informe técnico",
                  "Placas comunicacionales",
                  "Análisis comparativo",
                ].map((t) => (
                  <li
                    key={t}
                    className="flex items-center gap-2 rounded-xl bg-[var(--surface-2)] px-3 py-2"
                  >
                    <span className="size-1.5 rounded-full bg-[var(--accent)]" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="overflow-hidden rounded-[22px] border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-card)] lg:col-span-2">
            <div className="relative h-44">
              <Photo
                src={IMG.plaza}
                alt="Plaza 25 de Mayo, San Juan"
                sizes="40vw"
              />
              <span className="absolute bottom-3 left-3 display rounded-full bg-white/92 px-3 py-1 text-lg text-[var(--foreground)]">
                Cada quien ve lo suyo
              </span>
            </div>
            <div className="p-8">
              <ul className="space-y-5">
                {[
                  [Building2, "Administración central", "Alta de clientes, usuarios y control global de los operativos."],
                  [Users, "Panel del cliente", "Sus encuestas, sus resultados y sus informes. Nada más."],
                  [MapPin, "Encuestadores", "Solo las encuestas asignadas y las respuestas que ellos cargan."],
                ].map(([Icon, title, text]) => {
                  const I = Icon as typeof Building2;
                  return (
                    <li key={title as string} className="flex gap-3">
                      <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-[var(--primary-soft)] text-[var(--primary)]">
                        <I className="size-4" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-[var(--foreground)]">
                          {title as string}
                        </p>
                        <p className="mt-0.5 text-sm text-[var(--muted)]">{text as string}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </section>

        <section className="px-4 pb-16 sm:px-6 sm:pb-24">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[28px] shadow-[var(--shadow-card)]">
            <div className="relative min-h-[360px]">
              <Photo
                src={IMG.ciudad}
                alt="San Juan capital con la precordillera al fondo"
                sizes="(max-width: 1152px) 100vw, 1152px"
              />
              <div className="absolute inset-0 bg-black/55" />
              <div className="relative flex min-h-[360px] flex-col items-center justify-center px-6 py-14 text-center text-white sm:px-12">
                <p className="text-[11px] font-semibold tracking-[0.2em] text-white/70 uppercase">
                  San Juan · Campo · Informe
                </p>
                <h2 className="display mt-3 text-4xl text-balance sm:text-5xl">
                  El operativo, el tablero y el informe. Juntos.
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-white/75">
                  Entrá con un rol de demo y recorré la plataforma como administración, cliente o campo.
                </p>
                <div className="mt-8">
                  <ButtonLink href="/login" size="lg">
                    Empezar ahora
                    <ArrowRight />
                  </ButtonLink>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--border)] bg-[color-mix(in_oklab,var(--surface)_70%,transparent)]">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Logo />
          <p className="text-xs text-[var(--muted)]">
            Plataforma de encuestas · Next.js, Supabase y Gemini
          </p>
          <ThemeToggle />
        </div>
      </footer>
    </div>
  );
}
