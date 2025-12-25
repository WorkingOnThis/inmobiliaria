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
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
    isActive: true,
  },
  {
    title: "Perfil",
    url: "/dashboard/profile",
    icon: User,
  },
  {
    title: "Configuración",
    url: "/dashboard/settings",
    icon: Settings,
    items: [
      {
        title: "General",
        url: "/dashboard/settings/general",
      },
      {
        title: "Preferencias",
        url: "/dashboard/settings/preferences",
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
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
    isActive: true,
  },
  {
    title: "Propiedades",
    url: "/dashboard/properties",
    icon: Building2,
    items: [
      {
        title: "Todas las propiedades",
        url: "/dashboard/properties",
      },
      {
        title: "Agregar propiedad",
        url: "/dashboard/properties/new",
      },
    ],
  },
  {
    title: "Contratos",
    url: "/dashboard/contracts",
    icon: FileText,
    items: [
      {
        title: "Todos los contratos",
        url: "/dashboard/contracts",
      },
      {
        title: "Nuevo contrato",
        url: "/dashboard/contracts/new",
      },
    ],
  },
  {
    title: "Pagos",
    url: "/dashboard/payments",
    icon: CreditCard,
    items: [
      {
        title: "Historial de pagos",
        url: "/dashboard/payments",
      },
      {
        title: "Pagos pendientes",
        url: "/dashboard/payments/pending",
      },
    ],
  },
  {
    title: "Mantenimiento",
    url: "/dashboard/maintenance",
    icon: Wrench,
    items: [
      {
        title: "Solicitudes",
        url: "/dashboard/maintenance",
      },
      {
        title: "Historial",
        url: "/dashboard/maintenance/history",
      },
    ],
  },
  {
    title: "Reportes",
    url: "/dashboard/reports",
    icon: BarChart3,
    items: [
      {
        title: "Resumen ejecutivo",
        url: "/dashboard/reports",
      },
      {
        title: "Ingresos",
        url: "/dashboard/reports/income",
      },
    ],
  },
  {
    title: "Configuración",
    url: "/dashboard/settings",
    icon: Settings,
    items: [
      {
        title: "General",
        url: "/dashboard/settings/general",
      },
      {
        title: "Equipo",
        url: "/dashboard/settings/team",
      },
    ],
  },
  {
    title: "Administración",
    url: "/dashboard/admin",
    icon: Shield,
    items: [
      {
        title: "Usuarios",
        url: "/dashboard/admin/users",
      },
      {
        title: "Permisos",
        url: "/dashboard/admin/permissions",
      },
    ],
  },
];

/**
 * Menú mínimo por defecto para roles desconocidos o inválidos
 */
const defaultMenuItems: MenuItem[] = [
  {
    title: "Dashboard",
    url: "/dashboard",
    icon: LayoutDashboard,
    isActive: true,
  },
  {
    title: "Perfil",
    url: "/dashboard/profile",
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
export function getMenuItemsByRole(role: string | null | undefined): MenuItem[] {
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

