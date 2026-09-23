import type { SurveyStatus } from "@/lib/types";

/** Transiciones de estado permitidas. La UI solo ofrece estas; el servidor lo vuelve a exigir. */
export const STATUS_FLOW: Record<SurveyStatus, SurveyStatus[]> = {
  borrador: ["activa"],
  activa: ["pausada", "cerrada"],
  pausada: ["activa", "cerrada"],
  cerrada: ["activa"],
};

/** Texto del botón para pasar a cada estado, según desde dónde se viene. */
export function transitionLabel(from: SurveyStatus, to: SurveyStatus) {
  if (to === "activa") return from === "borrador" ? "Salir a campo" : from === "cerrada" ? "Reabrir" : "Reanudar";
  if (to === "pausada") return "Pausar";
  return "Cerrar encuesta";
}

/** Avisos que las acciones dejan en la URL (?aviso=) y el detalle muestra. */
export const NOTICES: Record<string, { tone: "success" | "warning" | "danger" | "primary"; text: string }> = {
  "en-campo": { tone: "success", text: "La encuesta salió a campo. Los encuestadores asignados ya pueden cargar entrevistas." },
  reactivada: { tone: "success", text: "La encuesta volvió a estar en campo." },
  pausada: { tone: "warning", text: "Encuesta pausada: nadie puede cargar entrevistas hasta reanudarla." },
  cerrada: { tone: "primary", text: "Encuesta cerrada. Los resultados quedan disponibles y se pueden generar informes." },
  transicion: { tone: "danger", text: "Ese cambio de estado no está permitido desde el estado actual." },
  "sin-preguntas": { tone: "danger", text: "Cargá al menos una pregunta antes de salir a campo." },
  "sin-opciones": { tone: "danger", text: "Hay preguntas de opción con menos de dos opciones." },
  "logica-rota": { tone: "danger", text: "Hay saltos que apuntan a preguntas inexistentes o posteriores. Revisalos antes de salir a campo." },
  "con-respuestas": {
    tone: "danger",
    text: "Esa pregunta ya tiene respuestas cargadas: borrarla eliminaría datos de campo. Si no va más, cerrá la encuesta y armá una nueva ola.",
  },
  dependencia: { tone: "danger", text: "Otra pregunta depende de esta por un salto. Quitá primero esa condición." },
  "orden-logica": { tone: "warning", text: "No se puede mover: un salto quedaría apuntando a una pregunta posterior." },
  "logica-quitada": { tone: "success", text: "Condición quitada." },
  borrada: { tone: "success", text: "Pregunta eliminada y cuestionario renumerado." },
  copiado: { tone: "success", text: "Cuestionario copiado con sus opciones y saltos." },
  duplicada: { tone: "success", text: "Nueva ola creada en borrador con el mismo cuestionario." },
  "no-vacia": { tone: "warning", text: "Solo se puede copiar un cuestionario sobre una encuesta vacía." },
  "token-nuevo": { tone: "warning", text: "Se generó un link nuevo. Los links y widgets publicados antes dejaron de funcionar." },
  error: { tone: "danger", text: "Algo salió mal. Probá de nuevo." },
};
