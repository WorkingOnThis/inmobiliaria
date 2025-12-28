import {
  LayoutDashboard,
  User,
  Users,
  Settings,
  Building2,
  FileText,
  CreditCard,
  Wrench,
  BarChart3,
  Shield,
  type LucideIcon,
} from "lucide-react";
import type { MenuItem, MenuConfig, UserRole, MenuSubItem } from "./types";
import { canManageClauses, canManageClients, canManageProperties, hasRouteAccess } from "@/lib/permissions";

/**
 * Configuración de menú para rol visitor (menú básico)
 *
 * Incluye solo funcionalidades básicas accesibles para visitantes
 */
const visitorMenuItems: MenuItem[] = [
  {
    title: "Tablero",
    url: "/tablero",
    icon: LayoutDashboard,
    isActive: true,
  },
  {
    title: "Perfil",
    url: "/tablero/profile",
    icon: User,
  },
  {
    title: "Configuración",
    url: "/tablero/settings",
    icon: Settings,
    items: [
      {
        title: "General",
        url: "/tablero/settings/general",
      },
      {
        title: "Preferencias",
        url: "/tablero/settings/preferences",
      },
    ],
  },
];

/**
 * Configuración de menú para rol account_admin (menú completo)
 *
 * Incluye todas las funcionalidades de administración de propiedades
 */
const accountAdminMenuItems: MenuItem[] = [
  {
    title: "Tablero",
    url: "/tablero",
    icon: LayoutDashboard,
    isActive: true,
  },
  {
    title: "Clientes",
    url: "/clientes",
    icon: Users,
    items: [
      {
        title: "Todos los clientes",
        url: "/clientes",
      },
      {
        title: "Agregar cliente",
        url: "/clientes/nuevo",
        requiredPermission: "canManageClients",
      },
    ],
  },
  {
    title: "Propiedades",
    url: "/propiedades",
    icon: Building2,
    items: [
      {
        title: "Todas las propiedades",
        url: "/propiedades",
      },
      {
        title: "Agregar propiedad",
        url: "/propiedades/nueva",
        requiredPermission: "canManageProperties",
      },
    ],
  },
  {
    title: "Contratos",
    url: "/contratos",
    icon: FileText,
    items: [
      {
        title: "Todos los contratos",
        url: "/contratos",
      },
      {
        title: "Nuevo contrato",
        url: "/contratos/nuevo",
      },
      {
        title: "Cláusulas",
        url: "/contratos/clausulas/nueva",
        requiredPermission: "canManageClauses",
      },
    ],
  },
  {
    title: "Pagos",
    url: "/tablero/payments",
    icon: CreditCard,
    items: [
      {
        title: "Historial de pagos",
        url: "/tablero/payments",
      },
      {
        title: "Pagos pendientes",
        url: "/tablero/payments/pending",
      },
    ],
  },
  {
    title: "Mantenimiento",
    url: "/tablero/maintenance",
    icon: Wrench,
    items: [
      {
        title: "Solicitudes",
        url: "/tablero/maintenance",
      },
      {
        title: "Historial",
        url: "/tablero/maintenance/history",
      },
    ],
  },
  {
    title: "Reportes",
    url: "/tablero/reports",
    icon: BarChart3,
    items: [
      {
        title: "Resumen ejecutivo",
        url: "/tablero/reports",
      },
      {
        title: "Ingresos",
        url: "/tablero/reports/income",
      },
    ],
  },
  {
    title: "Configuración",
    url: "/tablero/settings",
    icon: Settings,
    items: [
      {
        title: "General",
        url: "/tablero/settings/general",
      },
      {
        title: "Equipo",
        url: "/tablero/settings/team",
      },
    ],
  },
  {
    title: "Administración",
    url: "/tablero/admin",
    icon: Shield,
    items: [
      {
        title: "Usuarios",
        url: "/tablero/admin/users",
      },
      {
        title: "Permisos",
        url: "/tablero/admin/permissions",
      },
    ],
  },
];

/**
 * Menú mínimo por defecto para roles desconocidos o inválidos
 */
const defaultMenuItems: MenuItem[] = [
  {
    title: "Tablero",
    url: "/tablero",
    icon: LayoutDashboard,
    isActive: true,
  },
  {
    title: "Perfil",
    url: "/tablero/profile",
    icon: User,
  },
];

/**
 * Configuración completa de menú mapeada por rol
 */
const menuConfig: MenuConfig = {
  visitor: visitorMenuItems,
  account_admin: accountAdminMenuItems,
  agent: accountAdminMenuItems,
};

/**
 * Mapa de funciones de permiso a sus implementaciones
 * Permite llamar dinámicamente a funciones de permiso desde strings
 */
const permissionFunctions: Record<string, (role: string | null | undefined) => boolean> = {
  canManageClauses,
  canManageClients,
  canManageProperties,
};

/**
 * Logging de eventos para monitoreo
 * Registra cuando se encuentra un rol desconocido o inválido
 *
 * @param role - El rol desconocido que se encontró
 */
function logUnknownRole(role: string): void {
  const logData = {
    timestamp: new Date().toISOString(),
    event: "unknown_role_detected",
    role,
    userAgent: typeof window !== "undefined" ? window.navigator.userAgent : undefined,
  };

  // En desarrollo: usar console.warn
  if (process.env.NODE_ENV === "development") {
    console.warn(`[MenuConfig] Unknown role detected:`, logData);
  }

  // En producción: preparar estructura para enviar a servicio de logging
  // TODO: Implementar envío a servicio de logging en producción
  // Ejemplo:
  // if (process.env.NODE_ENV === "production") {
  //   sendToLoggingService(logData);
  // }
}

/**
 * Verifica si un item de menú o sub-item debe ser visible según permisos
 *
 * @param item - El item o sub-item a verificar
 * @param role - El rol del usuario
 * @returns true si el item debe ser visible, false en caso contrario
 */
function isMenuItemVisible(
  item: { url: string; requiredPermission?: string },
  role: string | null | undefined
): boolean {
  // Si no hay rol, el item no es visible
  if (!role) {
    return false;
  }

  // Verificar permiso granular si está especificado
  if (item.requiredPermission) {
    const permissionFn = permissionFunctions[item.requiredPermission];
    if (!permissionFn) {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          `[MenuConfig] Unknown permission function: ${item.requiredPermission}, item will be hidden`
        );
      }
      return false;
    }

    if (!permissionFn(role)) {
      if (process.env.NODE_ENV === "development") {
        console.log(
          `[MenuConfig] Item "${item.url}" filtered due to permission: ${item.requiredPermission}`
        );
      }
      return false;
    }
  }

  // Verificar acceso a la ruta como capa adicional de seguridad
  if (!hasRouteAccess(item.url, role)) {
    if (process.env.NODE_ENV === "development") {
      console.log(
        `[MenuConfig] Item "${item.url}" filtered due to route access check`
      );
    }
    return false;
  }

  return true;
}

/**
 * Filtra items de menú y sub-items según permisos granulares del usuario
 *
 * @param items - Array de MenuItem a filtrar
 * @param role - El rol del usuario
 * @returns Array de MenuItem filtrado con solo items visibles
 */
function filterMenuItemsByPermissions(
  items: MenuItem[],
  role: string | null | undefined
): MenuItem[] {
  if (!role) {
    return [];
  }

  try {
    return items
      .map((item) => {
        try {
          // Verificar si el item principal es visible
          if (!isMenuItemVisible(item, role)) {
            return null;
          }

          // Filtrar sub-items si existen
          let filteredSubItems: MenuSubItem[] | undefined;
          if (item.items) {
            try {
              filteredSubItems = item.items.filter((subItem) =>
                isMenuItemVisible(subItem, role)
              );
            } catch (error) {
              // Si hay error al filtrar sub-items, usar array vacío
              if (process.env.NODE_ENV === "development") {
                console.warn(
                  `[MenuConfig] Error filtering sub-items for "${item.title}":`,
                  error
                );
              }
              filteredSubItems = [];
            }
          }

          // Si el item tiene sub-items pero todos fueron filtrados, ocultar el item principal también
          // A menos que el item principal tenga una URL propia que sea accesible
          if (
            item.items &&
            item.items.length > 0 &&
            (!filteredSubItems || filteredSubItems.length === 0)
          ) {
            // Si el item principal tiene una URL válida, mantenerlo aunque no tenga sub-items
            // De lo contrario, ocultarlo
            try {
              if (
                !item.url ||
                item.url === "#" ||
                !hasRouteAccess(item.url, role)
              ) {
                return null;
              }
            } catch (error) {
              // Si hay error al verificar acceso a ruta, ocultar el item por seguridad
              if (process.env.NODE_ENV === "development") {
                console.warn(
                  `[MenuConfig] Error checking route access for "${item.url}":`,
                  error
                );
              }
              return null;
            }
          }

          // Retornar item con sub-items filtrados
          return {
            ...item,
            items: filteredSubItems,
          };
        } catch (error) {
          // Si hay error procesando un item individual, ocultarlo por seguridad
          if (process.env.NODE_ENV === "development") {
            console.warn(
              `[MenuConfig] Error processing menu item "${item.title}":`,
              error
            );
          }
          return null;
        }
      })
      .filter((item): item is MenuItem => item !== null);
  } catch (error) {
    // Si hay error crítico al filtrar, retornar items básicos
    if (process.env.NODE_ENV === "development") {
      console.error(
        "[MenuConfig] Critical error filtering menu items, returning basic menu:",
        error
      );
    }
    // Retornar items básicos que siempre deberían ser accesibles
    return items.filter(
      (item) =>
        item.url === "/tablero" ||
        item.url === "/tablero/profile" ||
        !item.requiredPermission
    );
  }
}

/**
 * Obtiene los items de menú para un rol específico
 *
 * @param role - El rol del usuario
 * @returns Array de MenuItem para el rol especificado, filtrado por permisos granulares
 *
 * @example
 * ```ts
 * const menuItems = getMenuItemsByRole("visitor");
 * ```
 */
export function getMenuItemsByRole(
  role: string | null | undefined
): MenuItem[] {
  // Si no hay rol, retornar menú mínimo
  if (!role) {
    console.warn("[MenuConfig] No role provided, using default menu");
    return defaultMenuItems;
  }

  // Intentar obtener menú para el rol
  const menuItems = menuConfig[role as UserRole];

  // Si el rol no existe en la configuración, usar menú mínimo y loggear
  if (!menuItems) {
    logUnknownRole(role);
    // Filtrar menú mínimo por permisos también (aunque normalmente no tendrá permisos requeridos)
    return filterMenuItemsByPermissions(defaultMenuItems, role);
  }

  // Filtrar items según permisos granulares
  return filterMenuItemsByPermissions(menuItems, role);
}

/**
 * Verifica si un rol es válido
 *
 * @param role - El rol a verificar
 * @returns true si el rol es válido, false en caso contrario
 */
export function isValidRole(role: string | null | undefined): role is UserRole {
  return role !== null && role !== undefined && role in menuConfig;
}

/**
 * Exporta la configuración completa del menú para referencia
 * Útil para extensibilidad y documentación
 */
export { menuConfig, defaultMenuItems };
