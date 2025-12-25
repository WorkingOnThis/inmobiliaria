import { type LucideIcon } from "lucide-react";

/**
 * Tipo para roles de usuario válidos en el sistema
 * 
 * Extensible para futuros roles: Propietario, Administrador de Propiedades, Inquilino, etc.
 */
export type UserRole = "visitor" | "account_admin";

/**
 * Tipo para un item de menú individual
 */
export interface MenuItem {
  title: string;
  url: string;
  icon?: LucideIcon;
  isActive?: boolean;
  items?: MenuSubItem[];
}

/**
 * Tipo para un sub-item de menú
 */
export interface MenuSubItem {
  title: string;
  url: string;
}

/**
 * Tipo para la configuración completa de menú
 * Mapea cada rol a su array de items de menú
 */
export type MenuConfig = Record<UserRole, MenuItem[]>;


