import { type LucideIcon } from "lucide-react";

/**
 * Tipo para roles de usuario válidos en el sistema
 * 
 * Extensible para futuros roles: Propietario, Administrador de Propiedades, Inquilino, etc.
 */
export type UserRole = "visitor" | "agent" | "account_admin";

/**
 * Tipo para funciones de permiso disponibles en el sistema
 * Extensible para futuros permisos granulares
 */
export type PermissionFunction = "canManageClauses";

/**
 * Tipo para un item de menú individual
 */
export interface MenuItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  isActive?: boolean;
  items?: MenuSubItem[];
  /**
   * Permiso granular requerido para mostrar este item de menú
   * Si se especifica, el sistema verificará este permiso además del rol básico
   * Si el permiso no se cumple, el item será ocultado del menú
   */
  requiredPermission?: PermissionFunction;
}

/**
 * Tipo para un sub-item de menú
 */
export interface MenuSubItem {
  title: string;
  url: string;
  /**
   * Permiso granular requerido para mostrar este sub-item de menú
   * Si se especifica, el sistema verificará este permiso además del rol básico
   * Si el permiso no se cumple, el sub-item será ocultado del menú
   */
  requiredPermission?: PermissionFunction;
}

/**
 * Tipo para la configuración completa de menú
 * Mapea cada rol a su array de items de menú
 */
export type MenuConfig = Record<UserRole, MenuItem[]>;


