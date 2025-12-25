import {
  LayoutDashboard,
  User,
  Settings,
  Building2,
  FileText,
  CreditCard,
  Wrench,
  BarChart3,
  Shield,
  type LucideIcon,
} from "lucide-react";
import type { MenuItem, MenuConfig, UserRole } from "./types";

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
    title: "Propiedades",
    url: "/tablero/properties",
    icon: Building2,
    items: [
      {
        title: "Todas las propiedades",
        url: "/tablero/properties",
      },
      {
        title: "Agregar propiedad",
        url: "/tablero/properties/new",
      },
    ],
  },
  {
    title: "Contratos",
    url: "/tablero/contratos",
    icon: FileText,
    items: [
      {
        title: "Todos los contratos",
        url: "/tablero/contratos",
      },
      {
        title: "Nuevo contrato",
        url: "/tablero/contratos/nuevo",
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
};

/**
 * Obtiene los items de menú para un rol específico
 *
 * @param role - El rol del usuario
 * @returns Array de MenuItem para el rol especificado
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
    console.warn(`[MenuConfig] Unknown role: ${role}, using default menu`);
    // TODO: En producción, considerar enviar evento de monitoreo aquí
    return defaultMenuItems;
  }

  return menuItems;
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
