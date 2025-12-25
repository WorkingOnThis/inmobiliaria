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
    // Con cookieCache deshabilitado, getSession siempre verifica contra la base de datos
    const session = await auth.api.getSession({
      headers: request.headers,
    });

    // Si no hay sesión o el usuario no existe, redirigir a login inmediatamente
    if (!session?.user) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      const response = NextResponse.redirect(loginUrl);
      
      // Agregar headers para prevenir cache del navegador
      response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      response.headers.set("Pragma", "no-cache");
      response.headers.set("Expires", "0");
      response.headers.set("X-Robots-Tag", "noindex, nofollow");
      
      return response;
    }

    // Si el usuario no ha verificado su email, redirigir a verificación
    // Nota: Esta verificación puede ser opcional dependiendo de la configuración
    // if (!session.user.emailVerified) {
    //   const verifyUrl = new URL("/verify-email", request.url);
    //   return NextResponse.redirect(verifyUrl);
    // }

    // Usuario autenticado, permitir acceso
    // Agregar headers para prevenir cache en rutas protegidas
    const response = NextResponse.next();
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    
    return response;
  } catch (error) {
    console.error("Middleware auth error:", error);
    // En caso de error, redirigir a login para estar seguro
    const loginUrl = new URL("/login", request.url);
    const response = NextResponse.redirect(loginUrl);
    
    // Agregar headers para prevenir cache
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
    
    return response;
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

