import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth } from "@/lib/auth";

/**
 * Middleware de autenticación
 * 
 * Protege rutas que requieren autenticación.
 * Redirige usuarios no autenticados a /login.
 * Maneja usuarios sin email verificado.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Rutas públicas que no requieren autenticación
  const publicRoutes = ["/login", "/register", "/verify-email", "/api/auth"];
  const isPublicRoute = publicRoutes.some((route) => pathname.startsWith(route));

  // Si es una ruta pública o API de auth, permitir acceso
  if (isPublicRoute) {
    return NextResponse.next();
  }

  try {
    // Obtener sesión del usuario
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    // Si no hay sesión, redirigir a login
    if (!session?.user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Si el usuario no ha verificado su email, redirigir a verificación
    // Nota: Esta verificación puede ser opcional dependiendo de la configuración
    // if (!session.user.emailVerified) {
    //   const verifyUrl = new URL("/verify-email", request.url);
    //   return NextResponse.redirect(verifyUrl);
    // }

    // Usuario autenticado, permitir acceso
    return NextResponse.next();
  } catch (error) {
    console.error("Middleware auth error:", error);
    // En caso de error, redirigir a login para estar seguro
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

