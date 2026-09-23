/**
 * Se inyecta antes del primer paint para evitar el parpadeo de tema.
 * Vive fuera del componente cliente porque un modulo "use client" no puede
 * exportar un string plano hacia un Server Component.
 */
export const themeScript = `(function(){try{var m=localStorage.getItem('tema')||'system';var d=m==='dark'||(m==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}})();`;
