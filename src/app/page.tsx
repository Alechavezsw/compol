import {
  ArrowRight,
  BarChart3,
  Building2,
  ClipboardList,
  FolderKanban,
  IdCard,
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
    icon: IdCard,
    title: "Banco de dirigentes",
    text: "Fichas longitudinales de conocimiento e imagen. Quién sube, quién baja y por qué, medición tras medición.",
    image: IMG.plaza,
    alt: "Plaza 25 de Mayo, San Juan",
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

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-[#07060f] text-[#f3effc]">
      <header className="sticky top-0 z-30 border-b border-white/8 bg-[#07060f]/72 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3.5 sm:px-6">
          <Logo invert />
          <ButtonLink
            href="/login"
            size="sm"
            variant="ghost"
            className="border border-white/18 bg-white/10 text-white hover:bg-white/16 hover:text-white"
          >
            Ingresar
          </ButtonLink>
        </div>
      </header>

      <main className="flex-1">
        <section className="relative isolate min-h-dvh overflow-hidden">
          <Photo src={IMG.ciudad} alt="San Juan capital y la precordillera al atardecer" priority sizes="100vw" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,6,15,0.72)_0%,rgba(7,6,15,0.38)_34%,rgba(7,6,15,0.22)_52%,rgba(7,6,15,0.88)_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_18%_40%,rgba(34,211,238,0.16),transparent_46%)]" />

          <div className="relative mx-auto grid min-h-[calc(100dvh-65px)] w-full max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.05fr_.95fr] lg:gap-12 lg:py-16">
            <div className="animate-rise">
              <p className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold tracking-[0.18em] text-cyan-100 uppercase backdrop-blur">
                <span className="size-1.5 rounded-full bg-cyan-300 animate-pulse-soft" />
                Hecho para operar en San Juan
              </p>
              <h1 className="display mt-6 text-[44px] leading-[0.94] text-balance sm:text-[64px] lg:text-[72px]">
                La ciudad se mide
                <span className="block text-cyan-200">en la calle.</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-white/72 sm:text-lg">
                Del trabajo de campo al informe, en la misma plataforma. Diseñá el cuestionario,
                coordiná el operativo desde el celular y entregale a cada organismo un tablero en
                vivo, con informes escritos sobre los datos reales.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {["Cuestionarios", "Campo en vivo", "Tableros", "Informes con IA"].map((w) => (
                  <span
                    key={w}
                    className="rounded-full border border-white/20 bg-white/8 px-3 py-1 text-[12px] font-medium tracking-wide text-white/80"
                  >
                    {w}
                  </span>
                ))}
              </div>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <ButtonLink href="/login" size="lg" className="bg-cyan-300 text-slate-950 hover:bg-cyan-200">
                  Entrar a la plataforma
                  <ArrowRight />
                </ButtonLink>
                <ButtonLink
                  href="#modulos"
                  variant="outline"
                  size="lg"
                  className="border-white/20 bg-white/8 text-white hover:bg-white/14"
                >
                  Ver los módulos
                </ButtonLink>
              </div>
            </div>

            <div className="force-light animate-rise" style={{ animationDelay: "90ms" }}>
              <HeroPreview />
            </div>
          </div>
        </section>

        <section className="border-y border-white/8 bg-white/4">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-2 divide-y divide-white/8 px-4 sm:grid-cols-4 sm:divide-x sm:divide-y-0 sm:px-6">
            {[
              [ClipboardList, "Cuestionarios flexibles"],
              [Smartphone, "Carga desde el celular"],
              [BarChart3, "Resultados en vivo"],
              [Lock, "Datos aislados por cliente"],
            ].map(([Icon, label]) => {
              const I = Icon as typeof ClipboardList;
              return (
                <div key={label as string} className="flex items-center gap-3 px-2 py-6 sm:px-6">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-cyan-300/12 text-cyan-200">
                    <I className="size-4" />
                  </span>
                  <span className="text-sm font-medium text-white/85">{label as string}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className="relative pt-10">
          <div className="mx-auto grid w-full max-w-6xl grid-cols-2 gap-3 px-4 sm:grid-cols-4 sm:px-6">
            {[
              [IMG.plaza, "Plaza 25 de Mayo"],
              [IMG.peatonal, "Peatonal Rivadavia"],
              [IMG.civico, "Centro Cívico"],
              [IMG.ullum, "Ullum"],
            ].map(([src, label], i) => (
              <figure
                key={label}
                className="group relative aspect-[4/5] overflow-hidden rounded-[22px] border border-white/10"
                style={{ transform: i % 2 ? "translateY(18px)" : undefined }}
              >
                <Photo src={src} alt={label} sizes="(max-width: 768px) 50vw, 25vw" className="transition-transform duration-700 group-hover:scale-105" />
                <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-3 text-[12px] font-medium text-white">
                  {label}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6 sm:py-28">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-cyan-300 uppercase">El operativo</p>
            <h2 className="display mt-3 text-4xl text-white sm:text-6xl">
              La encuesta pasa en la calle, no en una planilla.
            </h2>
            <p className="mt-4 text-white/65">
              Los encuestadores relevan cara a cara con el teléfono en mano. El organismo sigue el
              operativo desde su panel y cada respuesta queda cargada al instante.
            </p>
          </div>

          <div className="mt-14 grid grid-cols-2 items-end gap-4 md:grid-cols-4">
            <Polaroid src={IMG.plaza} alt="Plaza 25 de Mayo" caption="Trabajo de campo" className="-rotate-2" />
            <Polaroid src={IMG.peatonal} alt="Peatonal de San Juan" caption="Carga desde el celular" className="rotate-3 md:mb-10" />
            <Polaroid src={IMG.civico} alt="Centro Cívico" caption="Panel del organismo" className="-rotate-1" />
            <Polaroid src={IMG.ullum} alt="Ullum" caption="Cobertura total" className="rotate-2 md:mb-6" />
          </div>
        </section>

        <section id="modulos" className="mx-auto w-full max-w-6xl scroll-mt-24 px-4 pb-24 sm:px-6">
          <div className="max-w-2xl">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-cyan-300 uppercase">El portfolio</p>
            <h2 className="display mt-3 text-4xl text-white sm:text-6xl">
              De la encuesta puntual a la inteligencia continua
            </h2>
          </div>

          <div className="mt-12 grid gap-4 lg:grid-cols-12">
            {MODULES.map(({ icon: Icon, title, text, image, alt }, i) => (
              <article
                key={title}
                className={`group overflow-hidden rounded-[26px] border border-white/10 bg-white/4 ${
                  i === 0 || i === 5 ? "lg:col-span-8" : i >= 6 ? "lg:col-span-6" : "lg:col-span-4"
                }`}
              >
                <div className={`relative overflow-hidden ${i === 0 || i === 5 ? "h-64 sm:h-72" : "h-48"}`}>
                  <Photo src={image} alt={alt} sizes="(max-width: 1024px) 100vw, 50vw" className="transition-transform duration-700 group-hover:scale-105" />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#07060f] via-[#07060f]/20 to-transparent" />
                  <span className="absolute top-4 left-4 display rounded-full bg-black/45 px-2.5 py-0.5 text-sm text-white backdrop-blur-sm">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                </div>
                <div className="p-6">
                  <span className="flex size-10 items-center justify-center rounded-xl bg-cyan-300/12 text-cyan-200">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-4 text-[18px] font-semibold text-white">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-white/60">{text}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-white/8 bg-white/3">
          <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6">
            <p className="text-[11px] font-semibold tracking-[0.18em] text-cyan-300 uppercase">Paso a paso</p>
            <h2 className="display mt-3 text-4xl text-white sm:text-6xl">Cómo se opera</h2>
            <ol className="mt-12 grid gap-5 md:grid-cols-3">
              {STEPS.map((s) => (
                <li key={s.n} className="group overflow-hidden rounded-[26px] border border-white/10 bg-white/4">
                  <div className="relative h-52 overflow-hidden">
                    <Photo src={s.image} alt={s.alt} sizes="(max-width: 768px) 100vw, 33vw" className="transition-transform duration-700 group-hover:scale-105" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent" />
                    <span className="absolute bottom-3 left-3 display rounded-full bg-white px-3 py-1 text-lg text-[#14111f]">
                      {s.word}
                    </span>
                    <span className="absolute top-3 right-3 display flex size-11 items-center justify-center rounded-full bg-cyan-300 text-lg text-slate-950">
                      {s.n}
                    </span>
                  </div>
                  <div className="p-6">
                    <h3 className="font-semibold text-white">{s.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-white/60">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-20 sm:px-6 lg:grid-cols-5">
          <div className="overflow-hidden rounded-[26px] border border-white/10 bg-white/4 lg:col-span-3">
            <div className="relative h-64">
              <Photo src={IMG.vinedos} alt="Viñedos sanjuaninos con la precordillera de fondo" sizes="(max-width: 1024px) 100vw, 60vw" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#07060f] via-[#07060f]/30 to-transparent" />
            </div>
            <div className="relative -mt-10 p-8 pt-0">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-cyan-300/15 text-cyan-200">
                <Sparkles className="size-5" />
              </span>
              <h2 className="display mt-5 text-3xl text-white sm:text-4xl">El motor de IA no improvisa</h2>
              <p className="mt-3 text-sm leading-relaxed text-white/60">
                El informe se genera sobre los agregados de la base: porcentajes, bases muestrales,
                evolución y textuales. El modelo cita la base de cada cifra y advierte cuando un
                subgrupo es demasiado chico.
              </p>
              <ul className="mt-6 grid gap-2 text-sm text-white/70 sm:grid-cols-2">
                {["Informe ejecutivo", "Informe técnico", "Placas comunicacionales", "Análisis comparativo"].map((t) => (
                  <li key={t} className="flex items-center gap-2 rounded-xl bg-white/6 px-3 py-2">
                    <span className="size-1.5 rounded-full bg-cyan-300" />
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="overflow-hidden rounded-[26px] border border-white/10 bg-white/4 lg:col-span-2">
            <div className="relative h-44">
              <Photo src={IMG.plaza} alt="Plaza 25 de Mayo, San Juan" sizes="40vw" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
              <span className="absolute bottom-3 left-3 display rounded-full bg-white px-3 py-1 text-lg text-[#14111f]">
                Cada quien ve lo suyo
              </span>
            </div>
            <div className="p-8">
              <ul className="space-y-5">
                {[
                  [Building2, "Administración central", "Alta de clientes, usuarios y control global de los operativos."],
                  [Users, "Panel del cliente", "Sus encuestas, sus resultados y sus informes. Nada más."],
                  [MapPin, "Encuestadores", "Solo las encuestas asignadas y las respuestas que ellos cargan."],
                  [Lock, "Aislamiento por fila", "Las políticas de acceso viven en la base, no en el frontend."],
                ].map(([Icon, title, text]) => {
                  const I = Icon as typeof Building2;
                  return (
                    <li key={title as string} className="flex gap-3">
                      <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-cyan-300/12 text-cyan-200">
                        <I className="size-4" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-white">{title as string}</p>
                        <p className="mt-0.5 text-sm text-white/55">{text as string}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </section>

        <section className="px-4 pb-20 sm:px-6 sm:pb-24">
          <div className="relative mx-auto max-w-6xl overflow-hidden rounded-[32px]">
            <div className="relative min-h-[420px]">
              <Photo src={IMG.catedral} alt="Catedral de San Juan" sizes="(max-width: 1152px) 100vw, 1152px" />
              <div className="absolute inset-0 bg-black/58" />
              <div className="relative flex min-h-[420px] flex-col items-center justify-center px-6 py-16 text-center">
                <p className="text-[11px] font-semibold tracking-[0.2em] text-white/70 uppercase">
                  San Juan · Campo · Informe
                </p>
                <h2 className="display mt-3 text-4xl text-balance sm:text-6xl">
                  El operativo, el tablero y el informe. Juntos.
                </h2>
                <p className="mx-auto mt-4 max-w-xl text-white/70">
                  Ingresá con tu usuario institucional. Cada organismo ve solo sus propios datos.
                </p>
                <div className="mt-8">
                  <ButtonLink href="/login" size="lg" className="bg-cyan-300 text-slate-950 hover:bg-cyan-200">
                    Empezar ahora
                    <ArrowRight />
                  </ButtonLink>
                </div>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-2">
                  {["Sin instalación", "Roles por organismo", "Datos aislados por cliente"].map((t) => (
                    <span
                      key={t}
                      className="rounded-full border border-white/20 bg-white/10 px-3 py-1 text-[12px] font-medium text-white/80 backdrop-blur"
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
