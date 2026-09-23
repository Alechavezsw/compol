/**
 * Script embebible. Uso en cualquier sitio:
 *
 *   <script src="https://<plataforma>/widget.js" data-encuesta="TOKEN" async></script>
 *
 * Atributos opcionales:
 *   data-modo="flotante" | "inline" | "emergente"   (por defecto: flotante)
 *   data-contenedor="#id"   dónde insertar el iframe en modo inline
 *   data-texto="…"          texto del botón flotante
 *   data-color="#0d9488"    color del botón
 *   data-posicion="derecha" | "izquierda"
 *   data-demora="8"         segundos antes de abrir la emergente
 *
 * Es JS plano, sin dependencias, y todo lo que agrega queda dentro de un
 * contenedor con prefijo propio para no chocar con los estilos del sitio.
 */
const SCRIPT = String.raw`(function () {
  "use strict";
  var script = document.currentScript;
  if (!script) return;
  var d = script.dataset;
  var token = d.encuesta;
  if (!token) { console.warn("[Consulta] Falta data-encuesta en el script del widget."); return; }

  var base = new URL(script.src).origin;
  var mode = d.modo === "inline" || d.modo === "emergente" ? d.modo : "flotante";
  var color = /^#[0-9a-f]{6}$/i.test(d.color || "") ? d.color : "#3d2de0";
  var label = d.texto || "Responder encuesta";
  var side = d.posicion === "izquierda" ? "left" : "right";
  var delay = Math.max(0, Math.min(120, Number(d.demora || 6))) * 1000;
  var doneKey = "consulta:widget:" + token;

  function src() {
    return base + "/e/" + encodeURIComponent(token) + "?embed=1&modo=" + mode +
      "&ref=" + encodeURIComponent(location.origin + location.pathname);
  }

  function frame(height) {
    var f = document.createElement("iframe");
    f.src = src();
    f.title = "Encuesta";
    f.loading = "lazy";
    f.setAttribute("allow", "clipboard-write");
    f.style.cssText = "border:0;width:100%;display:block;background:transparent;color-scheme:light;height:" + height + "px;transition:height .25s ease";
    return f;
  }

  var css = document.createElement("style");
  css.textContent =
    ".cslt-btn{position:fixed;bottom:20px;" + side + ":20px;z-index:2147483000;display:flex;align-items:center;gap:10px;" +
    "border:0;border-radius:999px;padding:13px 20px 13px 16px;font:600 15px/1.1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;" +
    "color:#fff;background:" + color + ";box-shadow:0 18px 40px -16px " + color + ",0 4px 14px rgba(0,0,0,.18);cursor:pointer;" +
    "transition:transform .2s ease,box-shadow .2s ease}" +
    ".cslt-btn:hover{transform:translateY(-2px)}" +
    ".cslt-btn svg{width:20px;height:20px;flex:none}" +
    ".cslt-dot{position:absolute;top:-3px;" + side + ":-3px;width:12px;height:12px;border-radius:50%;background:#f43f5e;border:2px solid #fff}" +
    ".cslt-panel{position:fixed;bottom:88px;" + side + ":20px;z-index:2147483001;width:400px;max-width:calc(100vw - 24px);" +
    "max-height:calc(100vh - 110px);overflow:auto;border-radius:24px;background:#fff;" +
    "box-shadow:0 40px 90px -30px rgba(20,10,60,.55),0 0 0 1px rgba(0,0,0,.06);opacity:0;transform:translateY(12px) scale(.98);" +
    "pointer-events:none;transition:opacity .22s ease,transform .22s ease}" +
    ".cslt-panel.cslt-open{opacity:1;transform:none;pointer-events:auto}" +
    ".cslt-overlay{position:fixed;inset:0;z-index:2147483000;background:rgba(15,10,30,.45);backdrop-filter:blur(3px);opacity:0;" +
    "pointer-events:none;transition:opacity .22s ease}" +
    ".cslt-overlay.cslt-open{opacity:1;pointer-events:auto}" +
    ".cslt-modal{bottom:auto;top:50%;" + side + ":auto;left:50%;transform:translate(-50%,-46%) scale(.98);width:460px}" +
    ".cslt-modal.cslt-open{transform:translate(-50%,-50%)}" +
    "@media (max-width:520px){.cslt-panel{" + side + ":12px;bottom:80px;width:calc(100vw - 24px)}" +
    ".cslt-modal{left:12px;right:12px;top:auto;bottom:12px;transform:translateY(20px);width:auto}.cslt-modal.cslt-open{transform:none}}";
  document.head.appendChild(css);

  var current = null;
  window.addEventListener("message", function (e) {
    if (e.origin !== base || !e.data || e.data.source !== "consulta" || !current) return;
    if (e.data.type === "resize" && e.data.height) current.style.height = Math.min(e.data.height, 2000) + "px";
    if (e.data.type === "close" && closeFn) closeFn();
    if (e.data.type === "done") {
      try { localStorage.setItem(doneKey, "1"); } catch (_) {}
      if (dot) dot.remove();
    }
  });

  var closeFn = null;
  var dot = null;

  if (mode === "inline") {
    var target = d.contenedor ? document.querySelector(d.contenedor) : null;
    var holder = document.createElement("div");
    holder.className = "cslt-inline";
    current = frame(520);
    holder.appendChild(current);
    if (target) target.appendChild(holder);
    else script.parentNode.insertBefore(holder, script.nextSibling);
    return;
  }

  var panel = document.createElement("div");
  panel.className = "cslt-panel" + (mode === "emergente" ? " cslt-modal" : "");
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-label", label);
  var overlay = mode === "emergente" ? document.createElement("div") : null;
  if (overlay) { overlay.className = "cslt-overlay"; document.body.appendChild(overlay); }
  document.body.appendChild(panel);

  function open() {
    if (!current) { current = frame(560); panel.appendChild(current); }
    panel.classList.add("cslt-open");
    if (overlay) overlay.classList.add("cslt-open");
  }
  closeFn = function () {
    panel.classList.remove("cslt-open");
    if (overlay) overlay.classList.remove("cslt-open");
  };
  if (overlay) overlay.addEventListener("click", closeFn);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeFn(); });

  var btn = document.createElement("button");
  btn.type = "button";
  btn.className = "cslt-btn";
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg><span></span>';
  btn.querySelector("span").textContent = label;
  btn.addEventListener("click", function () {
    if (panel.classList.contains("cslt-open")) closeFn(); else open();
  });

  var answered = false;
  try { answered = Boolean(localStorage.getItem(doneKey)); } catch (_) {}

  if (!answered) { dot = document.createElement("span"); dot.className = "cslt-dot"; btn.appendChild(dot); }
  document.body.appendChild(btn);

  if (mode === "emergente" && !answered) {
    var seenKey = doneKey + ":vista";
    var seen = false;
    try { seen = Boolean(sessionStorage.getItem(seenKey)); } catch (_) {}
    if (!seen) setTimeout(function () {
      open();
      try { sessionStorage.setItem(seenKey, "1"); } catch (_) {}
    }, delay);
  }
})();`;

export function GET() {
  return new Response(SCRIPT, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      // Corto a propósito: si cambia el widget, los sitios lo toman en minutos.
      "Cache-Control": "public, max-age=300, stale-while-revalidate=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
