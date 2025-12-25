"use client";

import { AppSidebar } from "@/components/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useSession, useLogoutListener } from "@/lib/auth/hooks";
import { useSyncExternalStore, useCallback, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";

const SIDEBAR_STORAGE_PREFIX = "sidebar-state-";

// Crear un store personalizado para manejar localStorage
function createLocalStorageStore(storageKey: string | null) {
  const listeners = new Set<() => void>();

  const getSnapshot = (): boolean | undefined => {
    if (!storageKey) return undefined;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored !== null) {
        const parsed = JSON.parse(stored);
        if (typeof parsed === "boolean") {
          return parsed;
        }
      }
    } catch (error) {
      console.warn(
        "[DashboardLayout] Error reading sidebar state from localStorage:",
        error
      );
    }
    return undefined;
  };

  const subscribe = (callback: () => void) => {
    listeners.add(callback);

    // Escuchar cambios desde otras pestañas
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === storageKey) {
        listeners.forEach((listener) => listener());
      }
    };

    window.addEventListener("storage", handleStorageChange);

    return () => {
      listeners.delete(callback);
      window.removeEventListener("storage", handleStorageChange);
    };
  };

  const setValue = (value: boolean) => {
    if (!storageKey) return;

    try {
      localStorage.setItem(storageKey, JSON.stringify(value));
      // Notificar a todos los listeners (incluyendo componentes en la misma pestaña)
      listeners.forEach((listener) => listener());
    } catch (error) {
      console.warn(
        "[DashboardLayout] Error saving sidebar state to localStorage:",
        error
      );
    }
  };

  return { getSnapshot, subscribe, setValue };
}

/**
 * DashboardLayout Component
 * 
 * Layout del tablero que incluye el sidebar con persistencia de estado.
 * Maneja la persistencia del estado del sidebar usando localStorage con clave por usuario.
 */
export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { session, isLoading } = useSession();
  const userId = session?.user?.id;
  const router = useRouter();

  // Escuchar eventos de logout desde otras pestañas
  useLogoutListener();

  // Redirigir si no hay sesión después de cargar
  // El middleware del servidor ya protege la ruta, esto es solo una verificación adicional en el cliente
  useEffect(() => {
    if (!isLoading && !session?.user) {
      router.replace("/login");
    }
  }, [session, isLoading, router]);

  // Obtener clave de localStorage para el usuario actual
  const storageKey = useMemo(() => {
    if (!userId) return null;
    return `${SIDEBAR_STORAGE_PREFIX}${userId}`;
  }, [userId]);

  // Crear el store para este storageKey (se recrea cuando cambia storageKey)
  const store = useMemo(
    () => createLocalStorageStore(storageKey),
    [storageKey]
  );

  // Usar useSyncExternalStore para sincronizar con localStorage
  const sidebarOpen = useSyncExternalStore(
    store.subscribe,
    store.getSnapshot,
    // Server snapshot (siempre undefined para SSR)
    () => undefined
  );

  // Guardar estado en localStorage cuando cambia
  const handleOpenChange = useCallback(
    (open: boolean) => {
      store.setValue(open);
    },
    [store]
  );

  // Props para SidebarProvider
  const sidebarProps =
    sidebarOpen === undefined
      ? { defaultOpen: true, onOpenChange: handleOpenChange }
      : { open: sidebarOpen, onOpenChange: handleOpenChange };

  return (
    <SidebarProvider {...sidebarProps}>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
          <div className="flex items-center gap-2 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem className="hidden md:block">
                  <BreadcrumbLink href="#">
                    Building Your Application
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="hidden md:block" />
                <BreadcrumbItem>
                  <BreadcrumbPage>Data Fetching</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
