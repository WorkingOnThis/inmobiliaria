"use client";

import { useEffect, useState } from "react";
import { authClient } from "./client";

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
        }
        setIsLoading(false);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err);
        setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  return { session, isLoading, error };
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

