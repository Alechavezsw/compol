import type { AnalyticsFilters } from "@/lib/analytics";

type Params = Record<string, string | string[] | undefined> | URLSearchParams;

function read(params: Params, key: string) {
  const value = params instanceof URLSearchParams ? params.get(key) : params[key];
  const first = Array.isArray(value) ? value[0] : value;
  return first?.trim() || null;
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Filtros del tablero a partir de la URL. Vivir en la URL permite compartir
 * un tablero filtrado por link y que la exportación CSV use exactamente el
 * mismo recorte que se está mirando.
 */
export function filtersFromParams(params: Params): AnalyticsFilters {
  const segment = read(params, "segmento");
  const [questionId, value] = segment?.split(":") ?? [];
  const from = read(params, "desde");
  const to = read(params, "hasta");
  const channel = read(params, "canal");
  return {
    channel: channel === "web" || channel === "campo" ? channel : null,
    zone: read(params, "zona"),
    surveyorId: read(params, "encuestador"),
    from: from && DAY.test(from) ? from : null,
    to: to && DAY.test(to) ? to : null,
    segment: questionId && value ? { questionId, value } : null,
  };
}

export function filtersToQuery(filters: AnalyticsFilters) {
  const params = new URLSearchParams();
  if (filters.channel) params.set("canal", filters.channel);
  if (filters.zone) params.set("zona", filters.zone);
  if (filters.surveyorId) params.set("encuestador", filters.surveyorId);
  if (filters.from) params.set("desde", filters.from);
  if (filters.to) params.set("hasta", filters.to);
  if (filters.segment) params.set("segmento", `${filters.segment.questionId}:${filters.segment.value}`);
  return params.toString();
}
