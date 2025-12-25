"use client"

import * as React from "react"
import { useSession } from "@/lib/auth/hooks"
import { getMenuItemsByRole } from "@/lib/navigation/menu-config"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"

/**
 * AppSidebar Component
 * 
 * Sidebar principal del dashboard con menú basado en roles.
 * Obtiene el rol del usuario desde la sesión y muestra items de menú apropiados.
 */
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { session, isLoading } = useSession()
  
  // Obtener rol del usuario desde la sesión
  const userRole = session?.user?.role as string | undefined
  
  // Debug: Log para verificar el rol del usuario
  React.useEffect(() => {
    if (session?.user) {
      console.log("[AppSidebar] User session:", {
        userId: session.user.id,
        email: session.user.email,
        role: session.user.role,
        fullUser: session.user,
      });
    }
  }, [session]);
  
  // Obtener items de menú según el rol
  const menuItems = React.useMemo(() => {
    if (isLoading) {
      // Mientras carga, mostrar menú vacío (se mostrará skeleton o estado de carga)
      return []
    }
    return getMenuItemsByRole(userRole)
  }, [userRole, isLoading])

  // Preparar datos del usuario para NavUser
  const userData = React.useMemo(() => {
    if (!session?.user) {
      return null
    }
    
    // Obtener iniciales del nombre para el avatar fallback
    const getInitials = (name: string) => {
      return name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    }

    return {
      name: session.user.name || session.user.email || "Usuario",
      email: session.user.email || "",
      avatar: session.user.image || "",
      initials: getInitials(session.user.name || session.user.email || "U"),
    }
  }, [session])

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        {/* TeamSwitcher removido por ahora - puede agregarse después si es necesario */}
      </SidebarHeader>
      <SidebarContent>
        {isLoading ? (
          // Estado de carga - mostrar skeleton o mensaje
          <div className="p-4 text-sm text-muted-foreground">
            Cargando...
          </div>
        ) : (
          <NavMain items={menuItems} />
        )}
        {/* NavProjects removido por ahora - puede agregarse después si es necesario */}
      </SidebarContent>
      <SidebarFooter>
        {userData && (
          <NavUser 
            user={{
              name: userData.name,
              email: userData.email,
              avatar: userData.avatar,
            }}
            initials={userData.initials}
          />
        )}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
