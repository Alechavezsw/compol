import "server-only";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Salidas a internet pedidas por usuarios (feeds RSS, links pegados en el
 * radar). Sin estas barreras, esas direcciones servirían para que el servidor
 * consulte su propia red: metadatos de la nube, servicios internos, localhost.
 */

export class UnsafeUrlError extends Error {}

function isPrivateIPv4(ip: string) {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    (a === 169 && b === 254) || // link-local y metadatos de la nube
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) || // benchmarking
    a >= 224 // multicast y reservadas
  );
}

function isPrivateIPv6(raw: string) {
  const ip = raw.toLowerCase();
  if (ip === "::" || ip === "::1") return true;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(ip);
  if (mapped) return isPrivateIPv4(mapped[1]);
  if (ip.startsWith("::ffff:")) return true; // IPv4 mapeada en hexadecimal: no se interpreta, se rechaza
  return /^f[cd]/.test(ip) || /^fe[89ab]/.test(ip) || ip.startsWith("ff");
}

function isPrivateAddress(ip: string) {
  const family = isIP(ip);
  if (family === 4) return isPrivateIPv4(ip);
  if (family === 6) return isPrivateIPv6(ip);
  return true;
}

/** Rechaza hosts que sean o resuelvan a una dirección interna. */
async function assertPublicHost(hostname: string) {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) {
    throw new UnsafeUrlError("No se permiten direcciones internas.");
  }
  if (isIP(host)) {
    if (isPrivateAddress(host)) throw new UnsafeUrlError("No se permiten direcciones internas.");
    return;
  }
  let addresses: { address: string }[];
  try {
    addresses = await lookup(host, { all: true });
  } catch {
    throw new UnsafeUrlError("No se pudo resolver la dirección.");
  }
  if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new UnsafeUrlError("No se permiten direcciones internas.");
  }
}

function parsePublicUrl(raw: string) {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new UnsafeUrlError("La dirección no es válida.");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new UnsafeUrlError("La dirección no es válida.");
  if (url.username || url.password) throw new UnsafeUrlError("La dirección no es válida.");
  if (url.port && url.port !== "80" && url.port !== "443") throw new UnsafeUrlError("La dirección no es válida.");
  return url;
}

/**
 * `fetch` que solo sale a internet pública. Cada redirección se vuelve a
 * validar (una URL pública puede redirigir a una interna) y el cuerpo se corta
 * en `maxBytes` en vez de leerse entero.
 *
 * No cubre un DNS que cambie de respuesta entre la validación y la conexión;
 * para ese caso hace falta salir por un proxy de egreso.
 */
export async function fetchPublic(
  rawUrl: string,
  options: { headers?: Record<string, string>; timeoutMs?: number; maxBytes?: number; maxRedirects?: number } = {},
): Promise<{ response: Response; text: string }> {
  const { headers, timeoutMs = 8000, maxBytes = 2_000_000, maxRedirects = 3 } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let url = parsePublicUrl(rawUrl);
    for (let hop = 0; hop <= maxRedirects; hop += 1) {
      await assertPublicHost(url.hostname);
      const response = await fetch(url, { signal: controller.signal, headers, redirect: "manual" });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        await response.body?.cancel();
        if (!location) throw new UnsafeUrlError("La dirección redirige a un lugar no válido.");
        url = parsePublicUrl(new URL(location, url).toString());
        continue;
      }
      return { response, text: await readLimited(response, maxBytes) };
    }
    throw new UnsafeUrlError("La dirección redirige demasiadas veces.");
  } finally {
    clearTimeout(timer);
  }
}

async function readLimited(response: Response, maxBytes: number) {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let text = "";
  while (received < maxBytes) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    text += decoder.decode(value, { stream: true });
  }
  await reader.cancel().catch(() => undefined);
  return text;
}
