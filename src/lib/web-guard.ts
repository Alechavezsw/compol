import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { isDemoMode } from "@/lib/demo/mode";

/**
 * Defensas de la encuesta web, que responde gente sin cuenta. Lo que manda el
 * navegador (el tiempo que dice haber tardado, el id de dispositivo, el campo
 * trampa) no sirve para frenar a un script: lo controla quien lo escribe. Acá
 * van las dos cosas que sí dependen solo del servidor:
 *
 *   - un token de formulario firmado, que fija CUÁNDO se abrió la página según el
 *     reloj del servidor y no se puede inventar sin la clave;
 *   - la huella de la conexión, con sal secreta, para contar envíos por conexión
 *     en la base (la memoria de una instancia serverless no alcanza).
 */

/** Un formulario abierto hace más de este tiempo se considera vencido: hay que recargar. */
export const MAX_FORM_AGE_MS = 24 * 60 * 60 * 1000;
/** Menos que esto entre abrir la página y enviar no lo hace una persona. */
export const MIN_FORM_SECONDS = 3;

function secret() {
  const key = process.env.WEB_FORM_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (key) return key;
  // La demo no tiene service role: no guarda nada real, así que alcanza una clave fija.
  if (isDemoMode()) return "demo-web-form-secret";
  throw new Error("Falta SUPABASE_SERVICE_ROLE_KEY (o WEB_FORM_SECRET) para firmar la encuesta web.");
}

function mac(scope: string, payload: string) {
  return createHmac("sha256", secret()).update(`${scope}|${payload}`).digest("base64url");
}

/** Token que acompaña al formulario: `<ms de emisión>.<firma>`, atado a la encuesta. */
export function issueFormToken(surveyToken: string, now = Date.now()) {
  const issued = String(now);
  return `${issued}.${mac("form", `${surveyToken}|${issued}`)}`;
}

/**
 * Segundos que pasaron desde que el servidor emitió el token, o `null` si el
 * token no es de esta encuesta, fue alterado, es del futuro o venció.
 */
export function formAgeSeconds(surveyToken: string, formToken: unknown, now = Date.now()): number | null {
  if (typeof formToken !== "string") return null;
  const [issued, given] = formToken.split(".");
  if (!issued || !given || !/^\d{10,15}$/.test(issued)) return null;

  const expected = Buffer.from(mac("form", `${surveyToken}|${issued}`));
  const received = Buffer.from(given);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) return null;

  const age = now - Number(issued);
  if (age < 0 || age > MAX_FORM_AGE_MS) return null;
  return age / 1000;
}

/** Huella de la conexión por encuesta: no es la IP ni se puede volver a ella sin la clave. */
export function connectionHash(surveyId: string, ip: string) {
  return mac("ip", `${surveyId}|${ip}`).slice(0, 32);
}
