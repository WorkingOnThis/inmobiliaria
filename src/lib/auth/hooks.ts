"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "./client";

/**
 * Logging utility para eventos de logout
 * Registra eventos de seguridad para auditoría
 */
function logLogoutEvent(
  type: "logout" | "logout_all_devices",
  userId?: string,
  success: boolean = true,
  error?: Error
) {
  const logData = {
    timestamp: new Date().toISOString(),
    type,
    userId: userId || "unknown",
    success,
    error: error ? error.message : undefined,
  };

  // Log en consola para desarrollo
  if (process.env.NODE_ENV === "development") {
    console.log("[Logout Event]", logData);
  }

  // En producción, aquí se podría enviar a un servicio de logging
  // Por ejemplo: sendToLoggingService(logData);
}

/**
 * Hook para obtener la sesión actual del usuario
 * 
 * @returns Objeto con session, isLoading, y error
 */
export function useSession() {
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let mounted = true;

    authClient
      .getSession()
      .then((result) => {
        if (!mounted) return;
        if (result.data) {
          setSession(result.data);
        } else {
          setSession(null);
        }
        setIsLoading(false);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err as Error);
        setSession(null);
        setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { session, isLoading, error };
}

/**
 * Hook para cerrar sesión del usuario actual
 * 
 * Invalida la sesión en la base de datos, elimina las cookies de autenticación,
 * y redirige al usuario a la página de login.
 * 
 * Es idempotente: puede llamarse múltiples veces sin causar errores.
 * Maneja errores de red/servidor eliminando cookies locales y redirigiendo
 * al login incluso si la solicitud al servidor falla.
 * 
 * @returns Objeto con logout function, isLoading, y error
 */
export function useLogout() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const router = useRouter();
  const isLoggingOut = useRef(false);

  const logout = async () => {
    // Prevenir múltiples llamadas simultáneas (idempotencia)
    if (isLoggingOut.current) {
      return;
    }

    isLoggingOut.current = true;
    setIsLoading(true);
    setError(null);

    try {
      // Obtener información de la sesión para logging
      const session = await authClient.getSession();
      const userId = session.data?.user?.id;

      // Intentar cerrar sesión en el servidor
      await authClient.signOut();
      
      // Logging de evento exitoso
      logLogoutEvent("logout", userId, true);
      
      // Notificar a otras pestañas que se cerró sesión
      if (typeof window !== "undefined") {
        window.localStorage.setItem("auth:logout", Date.now().toString());
        window.localStorage.removeItem("auth:logout");
      }
      
      // Redirigir al login
      router.push("/login");
    } catch (err) {
      // Obtener información de la sesión para logging (incluso si falla)
      let userId: string | undefined;
      try {
        const session = await authClient.getSession();
        userId = session.data?.user?.id;
      } catch {
        // Ignorar error al obtener sesión
      }

      // Logging de evento fallido
      logLogoutEvent("logout", userId, false, err as Error);
      
      // Incluso si falla la solicitud al servidor, redirigir al login
      // Better Auth maneja la eliminación de cookies, pero debemos asegurarnos
      // de que el usuario sea redirigido
      setError(err as Error);
      
      // Notificar a otras pestañas
      if (typeof window !== "undefined") {
        window.localStorage.setItem("auth:logout", Date.now().toString());
        window.localStorage.removeItem("auth:logout");
      }
      
      // Redirigir al login incluso en caso de error
      router.push("/login");
    } finally {
      setIsLoading(false);
      // Permitir nuevo logout después de un breve delay
      setTimeout(() => {
        isLoggingOut.current = false;
      }, 1000);
    }
  };

  return { logout, isLoading, error };
}

/**
 * Hook para cerrar sesión desde todos los dispositivos
 * 
 * Invalida todas las sesiones del usuario (incluyendo la actual),
 * elimina las cookies de autenticación, y redirige al usuario a la página de login.
 * 
 * @returns Objeto con logoutAllDevices function, isLoading, y error
 */
export function useLogoutAllDevices() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const router = useRouter();
  const isLoggingOut = useRef(false);

  const logoutAllDevices = async () => {
    // Prevenir múltiples llamadas simultáneas
    if (isLoggingOut.current) {
      return;
    }

    isLoggingOut.current = true;
    setIsLoading(true);
    setError(null);

    try {
      // Obtener información de la sesión para logging
      const session = await authClient.getSession();
      const userId = session.data?.user?.id;

      // Primero invalidar todas las otras sesiones
      await authClient.revokeOtherSessions();
      
      // Luego cerrar la sesión actual
      await authClient.signOut();
      
      // Logging de evento exitoso
      logLogoutEvent("logout_all_devices", userId, true);
      
      // Notificar a otras pestañas
      if (typeof window !== "undefined") {
        window.localStorage.setItem("auth:logout", Date.now().toString());
        window.localStorage.removeItem("auth:logout");
      }
      
      // Redirigir al login
      router.push("/login");
    } catch (err) {
      // Obtener información de la sesión para logging (incluso si falla)
      let userId: string | undefined;
      try {
        const session = await authClient.getSession();
        userId = session.data?.user?.id;
      } catch {
        // Ignorar error al obtener sesión
      }

      // Logging de evento fallido
      logLogoutEvent("logout_all_devices", userId, false, err as Error);
      
      // Incluso si falla, intentar cerrar sesión localmente
      setError(err as Error);
      
      // Notificar a otras pestañas
      if (typeof window !== "undefined") {
        window.localStorage.setItem("auth:logout", Date.now().toString());
        window.localStorage.removeItem("auth:logout");
      }
      
      // Redirigir al login
      router.push("/login");
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        isLoggingOut.current = false;
      }, 1000);
    }
  };

  return { logoutAllDevices, isLoading, error };
}

/**
 * Hook para invalidar todas las sesiones excepto la actual
 */
export function useRevokeOtherSessions() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const revokeOtherSessions = async () => {
    setIsLoading(true);
    setError(null);
    try {
      await authClient.revokeOtherSessions();
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { revokeOtherSessions, isLoading, error };
}

/**
 * Hook para escuchar eventos de logout desde otras pestañas
 * 
 * Cuando otra pestaña cierra sesión, este hook detecta el evento
 * y redirige automáticamente a la página de login.
 * 
 * Debe usarse en componentes que necesiten detectar logout remoto.
 * 
 * Nota: El middleware del servidor ya protege las rutas, así que no necesitamos
 * verificar periódicamente la sesión. Solo escuchamos eventos de storage.
 */
export function useLogoutListener() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleStorageChange = (e: StorageEvent) => {
      // Detectar cuando otra pestaña cierra sesión
      if (e.key === "auth:logout" || (e.key === null && e.newValue === null)) {
        // Redirigir al login cuando se detecta logout desde otra pestaña
        router.push("/login");
      }
    };

    // Escuchar cambios en localStorage
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [router]);
}

