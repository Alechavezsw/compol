import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { DEMO_COOKIE, isDemoMode } from "@/lib/demo/mode";

// `/e` es la encuesta web y `/widget.js` el script embebible: los usa gente sin cuenta.
const PUBLIC_PATHS = ["/", "/login", "/auth", "/acceso-denegado", "/e", "/widget.js"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Mismas reglas de corte que en modo normal, pero mirando la cookie de demo. */
function guard(request: NextRequest, signedIn: boolean) {
  const { pathname } = request.nextUrl;

  if (!signedIn && !isPublic(pathname)) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    redirect.searchParams.set("next", pathname);
    return NextResponse.redirect(redirect);
  }

  if (signedIn && pathname === "/login") {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/inicio";
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }

  return null;
}

/**
 * Refresca la sesion de Supabase en cada request y corta el paso a las areas
 * privadas. La autorizacion fina por rol la hace cada layout contra la base.
 */
export default async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  // En demo no hay sesion que refrescar: la identidad es una cookie con el id
  // del perfil elegido, pero el corte de rutas privadas sigue siendo el mismo.
  if (isDemoMode()) {
    return guard(request, Boolean(request.cookies.get(DEMO_COOKIE)?.value)) ?? response;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Sin credenciales configuradas no hay sesion que refrescar: dejamos pasar
  // para que la app pueda mostrar su pantalla de configuracion.
  if (!url || !anon) return response;

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return guard(request, Boolean(user)) ?? response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
