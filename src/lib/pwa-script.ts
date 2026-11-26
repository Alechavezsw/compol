/**
 * Se inyecta en el <head> antes que React: Chrome dispara `beforeinstallprompt`
 * una sola vez y muy temprano, así que hay que atraparlo antes de hidratar.
 * Queda en `window.__consultaInstall` para el botón "Instalar la app".
 *
 * Vive fuera de un módulo "use client" porque un Server Component no puede
 * importar un string plano desde ahí.
 */
export const pwaInstallScript = `(function(){try{window.__consultaInstall=null;addEventListener('beforeinstallprompt',function(e){e.preventDefault();window.__consultaInstall=e;dispatchEvent(new Event('consulta:instalable'))});addEventListener('appinstalled',function(){window.__consultaInstall=null;try{localStorage.setItem('consulta:instalada','1')}catch(_){}dispatchEvent(new Event('consulta:instalada'))})}catch(_){}})();`;
