import {
  ArrowRight,
  BarChart3,
  Building2,
  ClipboardList,
  FolderKanban,
  Lock,
  MapPin,
  Smartphone,
  Sparkles,
  Users,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/logo";
import { HeroPreview } from "@/components/hero-preview";
import { Photo, Polaroid } from "@/components/photo";
import { ModulesRail } from "@/components/modules-rail";

const IMG = {
  plaza: "/landing/plaza.jpg",
  peatonal: "/landing/peatonal2.jpg",
  civico: "/landing/civico.jpg",
  ullum: "/landing/ullum2.jpg",
  vinedos: "/landing/vinedos.jpg",
  ciudad: "/landing/ciudad.jpg",
  parque: "/landing/parque.jpg",
  plan: "/landing/tablero.jpg",
  laptop: "/landing/celular.jpg",
  catedral: "/landing/catedral.jpg",
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
    icon: FolderKanban,
    title: "Proyectos y líneas de servicio",
    text: "Agrupá encuestas por proyecto: tracking, monitor de gestión, estudios temáticos o flash. Cada ola queda comparable con la anterior.",
    image: IMG.ullum,
    alt: "Quebrada y dique de Ullum, San Juan",
  },
  {
    icon: Sparkles,
    title: "Informes con IA",
    text: "La IA redacta el informe ejecutivo, técnico o comunicacional sobre los agregados reales, citando la base de cada cifra.",
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

const ZONES = [
  "Capital",
  "Rawson",
  "Santa Lucía",
  "Rivadavia",
  "Chimbas",
  "Pocito",
  "Ullum",
  "Caucete",
  "Albardón",
];

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-[#07060f] text-[#f3effc]">
      <header className="sticky top-0 z-30 border-b border-white/8 bg-[#07060f]/72 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center px-4 py-3.5 sm:px-6">
          <Logo invert />
        </div>
      </header>

      <main className="flex-1">
        <section className="relative isolate min-h-dvh overflow-hidden">
          <Photo
            src={IMG.ciudad}
            alt="San Juan capital y la precordillera al atardecer"
            priority
            quality={100}
            sizes="100vw"
            className="landing-ken object-cover object-[center_28%]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(105deg,rgba(7,6,15,0.93)_0%,rgba(7,6,15,0.72)_42%,rgba(7,6,15,0.32)_70%,rgba(7,6,15,0.55)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,6,15,0.5)_0%,transparent_30%,rgba(7,6,15,0.88)_100%)]" />

          <div className="relative mx-auto grid min-h-[calc(100dvh-65px)] w-full max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.08fr_.92fr] md:gap-10 lg:gap-14 lg:py-16">
            <div className="animate-rise">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/40 px-3 py-1.5 text-[11px] font-semibold tracking-[0.22em] text-white uppercase backdrop-blur-md">
                <span className="size-1.5 rounded-full bg-[#f2e6c4] animate-pulse-soft" />
                San Juan · Campo · Informe
              </p>
              <h1 className="display mt-7 text-[52px] leading-[0.88] text-balance text-white drop-shadow-[0_8px_32px_rgba(0,0,0,0.6)] sm:text-[76px] lg:text-[92px]">
                La ciudad
                <span className="block italic">se mide</span>
                <span className="block">en la calle.</span>
              </h1>
              <p className="mt-6 max-w-lg text-[17px] leading-relaxed text-white drop-shadow-[0_2px_18px_rgba(0,0,0,0.6)] sm:text-xl">
                Del trabajo de campo al informe, en la misma plataforma. El cuestionario, el
                celular y el tablero viven juntos.
              </p>
              <div className="mt-8 flex flex-wrap gap-2">
                {["Cuestionarios", "Campo en vivo", "Tableros", "Informes con IA"].map((w) => (
                  <span
                    key={w}
                    className="rounded-full border border-white/25 bg-black/40 px-3.5 py-1.5 text-[12px] font-medium tracking-wide text-white backdrop-blur-md"
                  >
                    {w}
                  </span>
                ))}
              </div>
              <div className="mt-9">
                <ButtonLink
                  href="#modulos"
                  size="lg"
                  className="h-12 border-0 bg-[#f2e6c4] text-[#14111f] shadow-none hover:bg-white hover:text-[#14111f]"
                >
                  Ver los módulos
                  <ArrowRight />
                </ButtonLink>
              </div>
            </div>

            <div className="force-light animate-rise md:translate-y-4" style={{ animationDelay: "90ms" }}>
              <HeroPreview />
            </div>
          </div>

          <div className="relative overflow-hidden border-t border-white/10 bg-black/35 backdrop-blur-md">
            <div className="landing-marquee flex gap-10 py-3 whitespace-nowrap text-[12px] font-semibold tracking-[0.22em] text-white/70 uppercase">
              {[...ZONES, ...ZONES].map((z, i) => (
                <span key={`${z}-${i}`} className="inline-flex items-center gap-10">
                  {z}
                  <span className="size-1 rounded-full bg-[#f2e6c4]/70" />
                </span>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              [ClipboardList, "01", "Cuestionarios flexibles", "Armá, filtrá y salí a campo"],
              [Smartphone, "02", "Carga desde el celular", "Cara a cara, sin planilla"],
              [BarChart3, "03", "Resultados en vivo", "El tablero se mueve solo"],
              [Lock, "04", "Datos aislados", "Cada organismo ve lo suyo"],
            ].map(([Icon, n, label, hint], i) => {
              const I = Icon as typeof ClipboardList;
              return (
                <div
                  key={label as string}
                  className="landing-rise group relative overflow-hidden rounded-[22px] border border-white/10 bg-white/[0.04] px-5 py-5 transition-all duration-300 hover:-translate-y-1.5 hover:border-white/25 hover:bg-white/[0.08]"
                  style={{ animationDelay: `${i * 80}ms` }}
                >
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#f2e6c4]/50 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                  <div className="flex items-center justify-between">
                    <span className="flex size-10 items-center justify-center rounded-xl bg-white/8 text-white transition-transform duration-300 group-hover:scale-110">
                      <I className="size-4" />
                    </span>
                    <span className="display text-2xl text-white/25 transition-colors group-hover:text-[#f2e6c4]/70">
                      {n as string}
                    </span>
                  </div>
                  <p className="mt-5 text-[15px] font-semibold text-white">{label as string}</p>
                  <p className="mt-1 text-[13px] text-white/50">{hint as string}</p>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
          <div className="grid items-end gap-10 lg:grid-cols-[0.9fr_1.1fr]">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.22em] text-[#f2e6c4] uppercase">El operativo</p>
              <h2 className="display mt-3 text-4xl leading-[0.95] text-white sm:text-6xl">
                Pasa en la calle,
                <span className="block italic text-white/70">no en una planilla.</span>
              </h2>
              <p className="mt-5 max-w-md text-white/65">
                Los encuestadores relevan cara a cara con el teléfono. Cada respuesta queda
                cargada al instante.
              </p>
            </div>
            <div className="grid grid-cols-2 items-end gap-3 sm:grid-cols-4">
              <div className="landing-rise">
                <Polaroid src={IMG.plaza} alt="Plaza 25 de Mayo" caption="Trabajo de campo" className="-rotate-3" />
              </div>
              <div className="landing-rise sm:mb-10" style={{ animationDelay: "90ms" }}>
                <Polaroid src={IMG.peatonal} alt="Peatonal de San Juan" caption="Carga desde el celular" className="rotate-2" />
              </div>
              <div className="landing-rise" style={{ animationDelay: "160ms" }}>
                <Polaroid src={IMG.civico} alt="Centro Cívico" caption="Panel del organismo" className="-rotate-2" />
              </div>
              <div className="landing-rise sm:mb-8" style={{ animationDelay: "230ms" }}>
                <Polaroid src={IMG.ullum} alt="Ullum" caption="Cobertura total" className="rotate-3" />
              </div>
            </div>
          </div>
        </section>

        <section id="modulos" className="scroll-mt-24 pb-20">
          <div className="mx-auto flex w-full max-w-6xl flex-col justify-between gap-6 px-4 sm:flex-row sm:items-end sm:px-6">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold tracking-[0.22em] text-[#f2e6c4] uppercase">El portfolio</p>
              <h2 className="display mt-3 text-4xl leading-[0.95] text-white sm:text-6xl">
                De la encuesta puntual
                <span className="block italic text-white/70">a la inteligencia continua</span>
              </h2>
            </div>
            <p className="max-w-xs text-sm text-white/45">
              Deslizá. Ocho piezas, un solo operativo.
            </p>
          </div>
          <div className="mt-8">
            <ModulesRail count={MODULES.length}>
              {MODULES.map(({ icon: Icon, title, text, image, alt }, i) => (
                <article
                  key={title}
                  className="group relative h-[420px] w-[min(86vw,520px)] shrink-0 snap-start overflow-hidden rounded-[28px] sm:h-[480px]"
                >
                  <Photo
                    src={image}
                    alt={alt}
                    quality={100}
                    sizes="(max-width: 640px) 86vw, 520px"
                    className="transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/35 to-black/10" />
                  <div className="absolute inset-0 flex flex-col justify-between p-6">
                    <div className="flex items-center justify-between">
                      <span className="display rounded-full bg-white px-2.5 py-0.5 text-sm text-[#14111f]">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span className="flex size-9 items-center justify-center rounded-full bg-white/12 text-white backdrop-blur-sm">
                        <Icon className="size-4" />
                      </span>
                    </div>
                    <div>
                      <h3 className="display text-[28px] leading-[1.05] text-white sm:text-[34px]">{title}</h3>
                      <p className="mt-2 max-w-md text-sm leading-relaxed text-white/75">{text}</p>
                    </div>
                  </div>
                </article>
              ))}
            </ModulesRail>
          </div>
        </section>

        <section className="relative overflow-hidden border-y border-white/8">
          <div className="absolute inset-0">
            <Photo src={IMG.vinedos} alt="" quality={100} sizes="100vw" className="opacity-20 landing-ken" />
            <div className="absolute inset-0 bg-[#07060f]/80" />
          </div>
          <div className="relative mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
            <p className="text-[11px] font-semibold tracking-[0.22em] text-[#f2e6c4] uppercase">Paso a paso</p>
            <h2 className="display mt-3 text-4xl text-white sm:text-6xl">Cómo se opera</h2>
            <ol className="mt-12 grid gap-4 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <li
                  key={s.n}
                  className="landing-rise group overflow-hidden rounded-[28px] border border-white/10 bg-black/30 backdrop-blur-sm transition-all duration-500 hover:-translate-y-2 hover:border-white/25"
                  style={{ animationDelay: `${i * 90}ms` }}
                >
                  <div className="relative h-56 overflow-hidden">
                    <Photo src={s.image} alt={s.alt} quality={100} sizes="(max-width: 768px) 100vw, 33vw" className="transition-transform duration-700 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent" />
                    <span className="absolute bottom-3 left-3 display rounded-full bg-white px-3 py-1 text-lg text-[#14111f]">
                      {s.word}
                    </span>
                    <span className="absolute top-3 right-3 display flex size-12 items-center justify-center rounded-full bg-[#f2e6c4] text-xl text-[#14111f]">
                      {s.n}
                    </span>
                  </div>
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-white">{s.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-white/60">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-20 sm:px-6 lg:grid-cols-5">
          <div className="group relative overflow-hidden rounded-[28px] lg:col-span-3 min-h-[420px]">
            <Photo src={IMG.vinedos} alt="Viñedos sanjuaninos con la precordillera de fondo" quality={100} sizes="(max-width: 1024px) 100vw, 60vw" className="transition-transform duration-700 group-hover:scale-110" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/15" />
            <div className="absolute inset-0 flex flex-col justify-end p-8">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-white/12 text-[#f2e6c4] backdrop-blur-sm">
                <Sparkles className="size-5" />
              </span>
              <h2 className="display mt-5 text-3xl text-white sm:text-5xl">El motor de IA no improvisa</h2>
              <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/75">
                El informe se genera sobre los agregados de la base: porcentajes, bases muestrales,
                evolución y textuales. Cita la base de cada cifra.
              </p>
              <ul className="mt-6 grid gap-2 text-sm text-white/80 sm:grid-cols-2">
                {["Informe ejecutivo", "Informe técnico", "Placas comunicacionales", "Análisis comparativo"].map((t) => (
                  <li key={t} className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 py-2 backdrop-blur-sm">
                    <span className="size-1.5 rounded-full bg-[#f2e6c4]" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="overflow-hidden rounded-[28px] border border-white/10 bg-white/[0.04] lg:col-span-2">
            <div className="relative h-40 overflow-hidden">
              <Photo src={IMG.plaza} alt="Plaza 25 de Mayo, San Juan" quality={100} sizes="40vw" className="transition-transform duration-700 hover:scale-110" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <span className="absolute bottom-3 left-3 display rounded-full bg-white px-3 py-1 text-lg text-[#14111f]">
                Cada quien ve lo suyo
              </span>
            </div>
            <div className="p-7">
              <ul className="space-y-4">
                {[
                  [Building2, "Administración central", "Altas, planes y control global."],
                  [Users, "Panel del cliente", "Sus encuestas, resultados e informes."],
                  [MapPin, "Encuestadores", "Solo las encuestas asignadas."],
                  [Lock, "Aislamiento por fila", "Las reglas viven en la base."],
                ].map(([Icon, title, text]) => {
                  const I = Icon as typeof Building2;
                  return (
                    <li key={title as string} className="flex gap-3 rounded-2xl p-2 transition-colors duration-300 hover:bg-white/6">
                      <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/8 text-[#f2e6c4]">
                        <I className="size-4" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-white">{title as string}</p>
                        <p className="mt-0.5 text-sm text-white/50">{text as string}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </section>

        <section className="px-4 pb-16 sm:px-6 sm:pb-20">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[36px]">
            <div className="relative min-h-[480px]">
              <Photo src={IMG.catedral} alt="Catedral de San Juan" quality={100} sizes="(max-width: 1152px) 100vw, 1152px" className="landing-ken" />
              <div className="absolute inset-0 bg-black/62" />
              <div className="relative flex min-h-[480px] flex-col items-center justify-center px-6 py-16 text-center">
                <p className="text-[11px] font-semibold tracking-[0.24em] text-[#f2e6c4] uppercase">
                  San Juan · Campo · Informe
                </p>
                <h2 className="display mt-4 text-4xl text-balance text-white sm:text-7xl">
                  El operativo, el tablero
                  <span className="block italic">y el informe. Juntos.</span>
                </h2>
                <p className="mx-auto mt-5 max-w-xl text-lg text-white/75">
                  Cada organismo ve solo sus propios datos.
                </p>
                <div className="mt-9 flex flex-wrap items-center justify-center gap-2">
                  {["Sin instalación", "Roles por organismo", "Datos aislados por cliente"].map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-[12px] font-medium text-white backdrop-blur"
                    >
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <Logo invert />
          <p className="text-xs text-white/45">
            © {new Date().getFullYear()} Consulta · Plataforma de encuestas para gobiernos e instituciones
          </p>
        </div>
      </footer>
    </div>
  );
}
