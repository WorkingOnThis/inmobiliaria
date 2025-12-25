"use client"

import { AppSidebar } from "@/components/app-sidebar"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { useSession } from "@/lib/auth/hooks"
import { useEffect, useState, useCallback } from "react"

const SIDEBAR_STORAGE_PREFIX = "sidebar-state-"

/**
 * DashboardLayout Component
 * 
 * Layout del dashboard que incluye el sidebar con persistencia de estado.
 * Maneja la persistencia del estado del sidebar usando localStorage con clave por usuario.
 */
export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { session } = useSession()
  const userId = session?.user?.id
  const [sidebarOpen, setSidebarOpen] = useState<boolean | undefined>(undefined)

  // Obtener clave de localStorage para el usuario actual
  const getStorageKey = useCallback(() => {
    if (!userId) return null
    return `${SIDEBAR_STORAGE_PREFIX}${userId}`
  }, [userId])

  // Leer estado inicial desde localStorage
  useEffect(() => {
    if (!userId) {
      // Si no hay usuario, usar estado por defecto (expandido)
      setSidebarOpen(undefined)
      return
    }

    const storageKey = getStorageKey()
    if (!storageKey) return

    try {
      const stored = localStorage.getItem(storageKey)
      if (stored !== null) {
        const parsed = JSON.parse(stored)
        // Validar que sea un boolean
        if (typeof parsed === "boolean") {
          setSidebarOpen(parsed)
        } else {
          // Si los datos son inválidos, usar estado por defecto
          setSidebarOpen(undefined)
        }
      } else {
        // Si no hay estado guardado, usar estado por defecto (expandido)
        setSidebarOpen(undefined)
      }
    } catch (error) {
      // Si hay error leyendo localStorage, usar estado por defecto
      console.warn("[DashboardLayout] Error reading sidebar state from localStorage:", error)
      setSidebarOpen(undefined)
    }
  }, [userId, getStorageKey])

  // Guardar estado en localStorage cuando cambia
  const handleOpenChange = useCallback(
    (open: boolean) => {
      setSidebarOpen(open)

      if (!userId) return

      const storageKey = getStorageKey()
      if (!storageKey) return

      try {
        localStorage.setItem(storageKey, JSON.stringify(open))
      } catch (error) {
        console.warn("[DashboardLayout] Error saving sidebar state to localStorage:", error)
        // Continuar sin guardar si hay error (localStorage puede estar deshabilitado)
      }
    },
    [userId, getStorageKey]
  )

  // Props para SidebarProvider
  const sidebarProps =
    sidebarOpen === undefined
      ? { defaultOpen: true, onOpenChange: handleOpenChange }
      : { open: sidebarOpen, onOpenChange: handleOpenChange }

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
                  <BreadcrumbLink href="#">Building Your Application</BreadcrumbLink>
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
  )
}

