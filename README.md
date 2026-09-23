# Consulta — plataforma de encuestas para gobiernos e instituciones

Aplicación web para una encuestadora: administración central, panel por cliente,
carga de entrevistas en campo desde el celular, encuestas web embebibles con
widget, tablero de resultados con margen de error y cruces, escucha social
("humor en redes") e informes redactados por IA (Google Gemini) sobre los
datos agregados reales.

**Stack:** Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Supabase
(Postgres + Auth + RLS) · Recharts · `@google/genai` · zod.

---

## Roles y áreas

| Rol | Área | Qué puede hacer |
| --- | --- | --- |
| `super_admin` | `/admin` | Alta de organizaciones y usuarios. **Único rol que gestiona encuestadores**: alta, bloqueo, asignaciones, cuotas y zonas. |
| `org_admin` | `/cliente` | Crear encuestas, armar el cuestionario con saltos y filtros, publicar el canal web, importar redes, generar informes. Ve el avance del equipo de campo pero no lo modifica. |
| `org_analyst` | `/cliente` | Lectura del panel, resultados, redes e informes de su organización. |
| `surveyor` | `/campo` | Solo las encuestas asignadas; carga entrevistas y ve su propia cuota. |

El aislamiento entre clientes se aplica con **Row Level Security en Postgres**, no
en el frontend. La restricción de que solo la administración central toque el
equipo de campo también está en RLS (migración 05).

---

## Qué hace cada módulo

### Cuestionario (`/cliente/encuestas/[id]`)
- Tipos: opción única y múltiple (con tope de marcas y opciones excluyentes como
  "No sabe" o "Ninguno"), escala, número con rango, sí/no, texto y fecha.
- **Saltos**: "mostrar solo si P4 = Mala o Muy mala".
- **Filtros**: "terminar la entrevista si responde No". La entrevista se guarda
  como `descartada`: cuenta para la incidencia, no para los resultados.
- Checklist antes de salir a campo, transiciones de estado validadas en el
  servidor, bloqueo de borrado de preguntas que ya tienen respuestas, copia de
  cuestionario con saltos remapeados y "Nueva ola" (duplicar encuesta).

### Campo (`/campo`)
- Motor de entrevista compartido con la web (`components/interview`): recorrido
  con saltos, validación paso a paso, avance automático en preguntas de un toque,
  atajos de teclado (números, Enter, Esc) y pantalla de revisión.
- **Borrador en el teléfono**: si se recarga o se corta la señal, la entrevista se
  retoma donde quedó.
- El servidor revalida todo con las mismas reglas (`lib/survey-logic.ts`).

### Encuestas web y widget
Con el canal web habilitado, la encuesta se responde sin encuestador:

- Link directo: `https://<plataforma>/e/<token>`
- Widget para cualquier sitio:

  ```html
  <script src="https://<plataforma>/widget.js" data-encuesta="TOKEN" data-modo="flotante" async></script>
  ```

  `data-modo`: `flotante` (botón en la esquina), `emergente` (se abre sola a los
  `data-demora` segundos, una vez por visita) o `inline` (dentro de
  `data-contenedor`). También `data-color`, `data-texto` y `data-posicion`.
- Iframe simple sin JavaScript: `<iframe src="https://<plataforma>/e/<token>?embed=1">`.
- Sitio de prueba para mostrarlo: `/e/<token>/prueba`.
- Protección: una respuesta por dispositivo (huella anónima), límite por IP,
  campo trampa para bots, tiempo mínimo y validación completa del cuestionario.
  El público no tiene permisos de RLS: la página y el envío usan la service role
  en el servidor.

### Resultados (`/cliente/encuestas/[id]/resultados`)
- Filtros en la URL (canal, zona, encuestador, fechas y segmento), compartibles
  y respetados por la exportación.
- Margen de error por porcentaje (intervalo al pasar el cursor), saldo neto en
  preguntas de evaluación, valoración alta/baja en escalas, términos frecuentes
  en abiertas, bases de preguntas condicionales.
- **Hallazgos automáticos** y **explorador de cruces** con mapa de calor,
  diferencias significativas por celda y chi-cuadrado con V de Cramér.
- Proyección: ritmo de los últimos 7 días, fecha estimada para la meta y casos
  por día necesarios si viene atrasada.
- Control de calidad: entrevistas exprés (menos del 40% de la mediana),
  NS/NC por encuestador, días sin carga.
- "Preguntale a los datos" (Gemini o lectura local) y exportación CSV
  (`;` + BOM, una columna 1/0 por opción múltiple).

### Humor en redes (`/cliente/redes`)
- Importación por CSV (exportación de la herramienta de monitoreo o Meta
  Business Suite), texto pegado o feeds RSS de portales / Google Alertas.
- Clasificación de sentimiento, emoción y temas con Gemini en lotes; sin clave,
  léxico local en español con negaciones e intensificadores.
- Índice de humor (−100 a +100, ponderado por interacciones), evolución diaria,
  temas con tendencia, redes, emociones, palabras frecuentes y publicaciones con
  más eco.
- Alertas: picos de críticas (fuera de 2,5 desvíos), temas emergentes y caídas
  de humor. Comparación "agenda de la encuesta vs. agenda en redes".
- Temas propios por organización (palabras clave y exclusiones).

### Informes IA (`/cliente/informes`)
`generateReportAction` no le manda filas crudas al modelo:

1. `loadSurveyData()` lee todo paginando (PostgREST corta en 1000 filas).
2. `computeAnalytics()` y `keyFindings()` calculan distribuciones, márgenes,
   saldos, proyección, calidad y cruces significativos.
3. `analyticsToBriefing()` arma el resumen; si la organización mide redes, se
   suma como contexto no representativo.
4. Gemini responde JSON con schema fijo, validado con zod; ante saturación
   reintenta y cae a `GEMINI_FALLBACK_MODEL`.

Cada tipo (ejecutivo, técnico, comunicacional, comparativo) tiene su propia
estructura, también en el redactor local de la demo. Los informes se imprimen o
guardan como PDF con una hoja limpia.

---

## Modo demo (sin Supabase)

```bash
npm install && npm run dev
```

La app arranca con datos simulados, coherentes entre sí:

- Encuesta presencial con **~400 casos completos** y ~30 descartados por filtro:
  la edad por tramo coincide con la edad exacta, el Sur evalúa peor la gestión,
  los jóvenes priorizan empleo y se informan por redes. Un encuestador tiene
  entrevistas exprés y dejó de cargar hace tres días.
- Encuesta **web** del presupuesto participativo con ~200 respuestas llegadas
  desde el sitio municipal, Instagram y Facebook (token `presupuesto-2027`).
- **75 días de publicaciones en redes** con un corte de agua que dispara críticas,
  una inauguración y la consulta vecinal ganando conversación.
- Ola 4 en borrador, vacía, para probar "copiar cuestionario".
- El botón **Reiniciar datos** vuelve todo al estado inicial sin cerrar la sesión.

Límites: los datos viven en memoria del servidor, y sin `GEMINI_API_KEY` los
informes, las respuestas y la clasificación de redes usan redactores y léxicos
locales (lo indican explícitamente).

El modo se controla con `NEXT_PUBLIC_DEMO_MODE`: `true` lo fuerza, `false` lo
apaga, y vacío lo decide solo (demo si Supabase no está configurado).

---

## Puesta en marcha con Supabase

### 1. Migraciones

En el **SQL Editor**, en este orden:

1. `20260829000001_schema.sql` — tablas, tipos y triggers.
2. `20260829000002_rls.sql` — políticas de acceso.
3. `20260913000003_logica_cuestionario.sql` — saltos y filtros.
4. `20260913000004_canal_web.sql` — encuestas web y widget.
5. `20260913000005_encuestadores_central.sql` — equipo de campo solo para la administración central.
6. `20260913000006_humor_en_redes.sql` — escucha social.
7. `supabase/seed.sql` — *opcional*, datos de demostración (usuarios con contraseña `Demo1234!`). **No en producción.**

### 2. Variables de entorno

```bash
cp .env.example .env.local
```

| Variable | Dónde se saca |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | idem |
| `SUPABASE_SERVICE_ROLE_KEY` | idem (solo servidor). Necesaria para altas de usuarios y para el canal web. |
| `GEMINI_API_KEY` | [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `GEMINI_MODEL` | `gemini-2.5-pro` para informes |
| `GEMINI_FALLBACK_MODEL` | `gemini-2.5-flash`: respaldo y consultas rápidas |
| `NEXT_PUBLIC_TIME_ZONE` | Opcional. Por defecto `America/Argentina/Buenos_Aires` (series por día) |

---

## Estructura

```
src/
  app/
    admin/encuestadores/        equipo de campo (solo administración central)
    cliente/encuestas/[id]/     cuestionario, saltos, canal web
      resultados/               tablero, cruces, calidad
      exportar/                 CSV de microdatos
    cliente/redes/              humor en redes
    cliente/informes/           informes IA
    campo/                      trabajo de campo
    e/[token]/                  encuesta pública (link e iframe) y sitio de prueba
    widget.js/                  script embebible
  components/
    interview/                  motor de entrevista compartido campo/web
    results/                    barras con margen, cruces, filtros, preguntas a los datos
  lib/
    survey-logic.ts             reglas del cuestionario (cliente y servidor)
    questions.ts                carga y guardado validado de entrevistas
    analytics.ts                agregación, cruces, proyección, briefing
    stats.ts                    margen de error, chi-cuadrado, tramos, fechas
    social/                     léxico, ingesta y analítica de redes
    web.ts                      token público, límite de frecuencia, huella
    ai/                         Gemini y respuestas locales
    demo/                       dataset, store en memoria y cliente falso
supabase/migrations/            esquema, RLS y extensiones
```

## Qué falta para producción

- Recuperación de contraseña e invitaciones por correo.
- Ponderación muestral y cuotas por variable (hoy son por encuestador).
- Modo offline completo en campo (hoy el borrador sobrevive, el envío necesita señal).
- Límite de frecuencia del canal web compartido entre instancias (hoy es en memoria).
- Conectores directos a APIs de redes (hoy se importa por CSV, texto o RSS).
