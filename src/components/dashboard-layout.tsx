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
import React, {
  useSyncExternalStore,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

const SIDEBAR_STORAGE_PREFIX = "sidebar-state-";

// Mapa de rutas a nombres amigables para el breadcrumb
const routeLabels: Record<string, string> = {
  tablero: "Tablero",
  contratos: "Contratos",
  clausulas: "Cláusulas",
  nueva: "Nueva",
  nuevo: "Nuevo",
  propiedades: "Propiedades",
  properties: "Propiedades",
  payments: "Pagos",
  pagos: "Pagos",
  maintenance: "Mantenimiento",
  mantenimiento: "Mantenimiento",
  reports: "Reportes",
  reportes: "Reportes",
  settings: "Configuración",
  configuracion: "Configuración",
  admin: "Administración",
  administracion: "Administración",
  profile: "Perfil",
  perfil: "Perfil",
  users: "Usuarios",
  usuarios: "Usuarios",
  permissions: "Permisos",
  permisos: "Permisos",
  general: "General",
  team: "Equipo",
  equipo: "Equipo",
  preferences: "Preferencias",
  preferencias: "Preferencias",
  pending: "Pendientes",
  pendientes: "Pendientes",
  history: "Historial",
  historial: "Historial",
  income: "Ingresos",
  ingresos: "Ingresos",
};

/**
 * Genera los breadcrumbs basados en la ruta actual
 * @param pathname - La ruta actual
 * @returns Array de objetos con href y label para cada breadcrumb
 */
function generateBreadcrumbs(
  pathname: string
): Array<{ href: string; label: string }> {
  // Si estamos en la raíz del tablero, solo mostrar "Tablero"
  if (pathname === "/tablero") {
    return [{ href: "/tablero", label: "Tablero" }];
  }

  // Dividir el pathname en segmentos y filtrar vacíos
  const segments = pathname.split("/").filter(Boolean);

  const breadcrumbs: Array<{ href: string; label: string }> = [];

  // Construir los breadcrumbs acumulativamente
  segments.forEach((segment, index) => {
    const href = "/" + segments.slice(0, index + 1).join("/");
    const label =
      routeLabels[segment] ||
      segment.charAt(0).toUpperCase() + segment.slice(1);

    breadcrumbs.push({ href, label });
  });

  return breadcrumbs;
}

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
  const pathname = usePathname();

  // Escuchar eventos de logout desde otras pestañas
  useLogoutListener();

  // Generar breadcrumbs basados en la ruta actual
  const breadcrumbs = useMemo(() => generateBreadcrumbs(pathname), [pathname]);

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
                {breadcrumbs.map((crumb, index) => {
                  const isLast = index === breadcrumbs.length - 1;
                  const isFirst = index === 0;
                  const hideFirstOnMobile = breadcrumbs.length > 1;

                  return (
                    <React.Fragment key={crumb.href}>
                      {index > 0 && (
                        <BreadcrumbSeparator
                          className={hideFirstOnMobile ? "hidden md:block" : ""}
                        />
                      )}
                      <BreadcrumbItem
                        className={
                          isFirst && hideFirstOnMobile ? "hidden md:block" : ""
                        }
                      >
                        {isLast ? (
                          <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                        ) : (
                          <BreadcrumbLink asChild>
                            <Link href={crumb.href}>{crumb.label}</Link>
                          </BreadcrumbLink>
                        )}
                      </BreadcrumbItem>
                    </React.Fragment>
                  );
                })}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
