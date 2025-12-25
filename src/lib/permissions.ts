import type { UserRole } from "./navigation/types";

/**
 * Permisos del sistema
 * 
 * Este archivo centraliza la definición de permisos por feature/ruta.
 * Los permisos se definen como arrays de roles que tienen acceso.
 * 
 * Para agregar un nuevo rol o cambiar permisos, modifica este archivo únicamente.
 */

/**
 * Permisos para la creación de cláusulas de contratos
 * 
 * Define qué roles pueden acceder a las rutas de creación de cláusulas:
 * - `/tablero/contratos/clausulas/nueva` (creación)
 * 
 * Nota: Este permiso puede extenderse en el futuro para incluir otras operaciones
 * como listar, editar o eliminar cláusulas.
 */
export const CLAUSE_MANAGEMENT_PERMISSIONS: UserRole[] = ["agent", "account_admin"];

/**
 * Verifica si un rol tiene permisos para crear cláusulas
 * 
 * @param role - El rol del usuario a verificar
 * @returns true si el rol tiene permisos, false en caso contrario
 */
export function canManageClauses(role: string | null | undefined): boolean {
  if (!role) return false;
  return CLAUSE_MANAGEMENT_PERMISSIONS.includes(role as UserRole);
}

/**
 * Verifica si un rol tiene acceso a una ruta específica
 * 
 * @param route - La ruta a verificar (ej: "/tablero/contratos/clausulas")
 * @param role - El rol del usuario
 * @returns true si el rol tiene acceso, false en caso contrario
 */
export function hasRouteAccess(
  route: string,
  role: string | null | undefined
): boolean {
  if (!role) return false;

  // Permisos para rutas de creación de cláusulas
  if (
    route.startsWith("/tablero/contratos/clausulas/nueva") &&
    !canManageClauses(role)
  ) {
    return false;
  }

  // Agregar más verificaciones de rutas aquí según sea necesario
  // Ejemplo:
  // if (route.startsWith("/tablero/admin") && !canAccessAdmin(role)) {
  //   return false;
  // }

  return true;
}

/**
 * Obtiene todos los roles que tienen un permiso específico
 * 
 * @param permission - El nombre del permiso (ej: "CLAUSE_MANAGEMENT")
 * @returns Array de roles con ese permiso
 */
export function getRolesWithPermission(
  permission: "CLAUSE_MANAGEMENT"
): UserRole[] {
  switch (permission) {
    case "CLAUSE_MANAGEMENT":
      return CLAUSE_MANAGEMENT_PERMISSIONS;
    default:
      return [];
  }
}

