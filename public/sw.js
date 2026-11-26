/*
 * Service worker de Consulta.
 *
 * Qué hace y qué no:
 * - Los archivos estáticos del build (/_next/static, íconos) se sirven desde
 *   el teléfono: tienen hash en el nombre, así que nunca quedan viejos.
 * - Las pantallas de campo (/campo...) se guardan cada vez que se abren con
 *   señal, para que el encuestador pueda volver a abrirlas sin señal. Las
 *   entrevistas ya se guardan aparte en el teléfono (cola local).
 * - Ninguna otra pantalla (paneles, resultados, informes) se guarda: sin red
 *   muestran la página "Sin conexión".
 * - Al cerrar sesión, o si el servidor manda al login, se borran las
 *   pantallas guardadas: en un teléfono compartido no queda nada a la vista.
 */

const VERSION = "2026-11-26b";
const STATIC_CACHE = `consulta-static-${VERSION}`;
const PAGES_CACHE = `consulta-campo-${VERSION}`;
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png", "/icon.svg"];
/** Si la red tarda más que esto en campo, se muestra lo guardado. */
const NETWORK_TIMEOUT_MS = 4500;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE).then(() => cache.match(OFFLINE_URL)))
      // La página "Sin conexión" también necesita sus estilos y scripts guardados.
      .then((offline) => (offline ? cacheAssetsOf(offline) : null))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith("consulta-") && key !== STATIC_CACHE && key !== PAGES_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

function isFieldPath(pathname) {
  return pathname === "/campo" || pathname.startsWith("/campo/");
}

function isStaticAsset(url) {
  return url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/");
}

/** Una respuesta de campo sirve para guardar solo si es la pantalla real (no un redirect al login). */
function isStorablePage(response) {
  return response && response.ok && response.type === "basic" && !response.redirected;
}

/**
 * Una pantalla guardada sin su JavaScript se ve pero no responde: se guardan
 * también los archivos del build que esa pantalla pide (scripts, estilos, fuentes).
 */
async function cacheAssetsOf(response) {
  try {
    const html = await response.text();
    const paths = new Set(html.match(/\/_next\/static\/[^"'\s)\\]+/g) || []);
    if (!paths.size) return;
    const cache = await caches.open(STATIC_CACHE);
    await Promise.all(
      [...paths].map(async (path) => {
        if (await cache.match(path)) return;
        try {
          const asset = await fetch(path);
          if (asset.ok) await cache.put(path, asset);
        } catch {
          /* se completa la próxima vez que haya señal */
        }
      }),
    );
  } catch {
    /* no es HTML legible: no hay nada que completar */
  }
}

function forgetFieldPages() {
  return caches.delete(PAGES_CACHE);
}

function withTimeout(promise, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timeout")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function offlinePage(request) {
  // Servida bajo otra dirección, Next intentaría cargar esa pantalla y caería
  // en el error genérico: se redirige a /offline, que sí corresponde.
  if (request && new URL(request.url).pathname !== OFFLINE_URL) {
    return Response.redirect(OFFLINE_URL, 302);
  }
  const cached = await caches.match(OFFLINE_URL, { ignoreVary: true });
  return (
    cached ||
    new Response("<h1>Sin conexión</h1><p>Volvé a intentar cuando tengas señal.</p>", {
      status: 503,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    })
  );
}

async function fieldNavigation(request) {
  const cache = await caches.open(PAGES_CACHE);
  const network = fetch(request).then(async (response) => {
    if (isStorablePage(response)) {
      await cache.put(request.url, response.clone());
      // Sin esperar: la pantalla se muestra ya y los archivos se completan atrás.
      cacheAssetsOf(response.clone());
    } else if (response.redirected && new URL(response.url).pathname.startsWith("/login")) {
      // La sesión venció: lo guardado ya no le corresponde a nadie.
      await forgetFieldPages();
    }
    return response;
  });

  try {
    return await withTimeout(network, NETWORK_TIMEOUT_MS);
  } catch {
    // Next responde con `Vary: RSC, ...`: la copia guardada vale igual para abrir la pantalla.
    const cached = await cache.match(request.url, { ignoreVary: true });
    if (cached) return cached;
    try {
      // Sin copia guardada: esperamos a la red un rato más antes de rendirnos.
      return await network;
    } catch {
      return offlinePage(request);
    }
  }
}

async function otherNavigation(request) {
  try {
    const response = await fetch(request);
    if (response.redirected && new URL(response.url).pathname.startsWith("/login")) {
      await forgetFieldPages();
    }
    return response;
  } catch {
    return offlinePage(request);
  }
}

async function staticAsset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(STATIC_CACHE);
    await cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.method !== "GET") {
    if (request.method === "POST" && url.pathname === "/auth/salir") {
      event.waitUntil(forgetFieldPages());
    }
    return;
  }

  if (isStaticAsset(url)) {
    event.respondWith(staticAsset(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(isFieldPath(url.pathname) ? fieldNavigation(request) : otherNavigation(request));
  }
});

/**
 * La pantalla de campo avisa qué encuestas tiene asignadas el encuestador para
 * dejarlas guardadas aunque todavía no las haya abierto.
 */
self.addEventListener("message", (event) => {
  const data = event.data || {};
  const port = event.ports && event.ports[0];

  if (data.type === "warm-field" && Array.isArray(data.urls)) {
    const urls = data.urls
      .filter((u) => typeof u === "string" && u.startsWith("/campo"))
      .slice(0, 40);
    event.waitUntil(
      caches.open(PAGES_CACHE).then(async (cache) => {
        let saved = 0;
        for (const path of urls) {
          try {
            const response = await fetch(path, { credentials: "include", redirect: "follow" });
            if (isStorablePage(response)) {
              await cache.put(new URL(path, self.location.origin).href, response.clone());
              await cacheAssetsOf(response);
              saved += 1;
            }
          } catch {
            /* sin señal ahora: se guarda la próxima vez */
          }
        }
        if (port) port.postMessage({ type: "warmed", saved, total: urls.length });
      }),
    );
  }

  if (data.type === "forget-field") {
    event.waitUntil(forgetFieldPages());
  }
});
