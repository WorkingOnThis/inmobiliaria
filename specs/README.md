# Proyecto: Sistema de Administración de Alquileres

**Última actualización**: 2025-01-21

## Descripción del Proyecto

Sistema web completo para la administración de propiedades en alquiler, construido con Next.js. Permite gestionar el ciclo de vida completo de los alquileres, desde la gestión de contratos hasta el seguimiento de pagos, mantenimiento y comunicación entre propietarios, administradores de propiedades e inquilinos.

### Objetivos del Negocio

- **Gestión de Contratos**: Facilitar la creación, renovación y gestión de contratos de alquiler
- **Administración de Pagos**: Automatizar el seguimiento de pagos mensuales, recibos y estados de cuenta
- **Mantenimiento y Reparaciones**: Gestionar solicitudes de mantenimiento, reparaciones y seguimiento de trabajos
- **Inventario de Propiedades**: Mantener un registro completo de propiedades, unidades y sus características
- **Comunicación Centralizada**: Facilitar la comunicación entre propietarios, administradores e inquilinos
- **Reportes y Analytics**: Proporcionar insights sobre ingresos, ocupación y estado de propiedades

### Audiencia

- **Propietarios**: Gestionan sus propiedades en alquiler, supervisan contratos, reciben pagos y aprueban solicitudes de mantenimiento
- **Administradores de Propiedades**: Gestionan múltiples unidades para diferentes propietarios, coordinan mantenimiento, procesan pagos y mantienen relaciones con inquilinos
- **Inquilinos**: Gestionan sus alquileres, realizan pagos, solicitan mantenimiento y acceden a documentos y comunicaciones

## Stack Tecnológico

### Core Framework

- **Next.js 16.0.7** (App Router) - Framework React con SSR/SSG
- **React 19.2.0** - Biblioteca UI
- **TypeScript 5.x** - Lenguaje principal

### Base de Datos

- **PostgreSQL** - Base de datos relacional
- **Drizzle ORM 0.45.1** - ORM type-safe
- **Drizzle Kit 0.31.8** - Migraciones y herramientas

### Autenticación

- **Better Auth 1.4.7** - Sistema de autenticación
  - Email/Password con verificación obligatoria
  - OAuth (Google)
  - Rate limiting
  - Sesiones persistentes (30 días)

### UI/UX

- **Tailwind CSS 4** - Framework CSS utility-first
- **shadcn/ui** - Componentes UI
- **Lucide React** - Iconos
- **class-variance-authority** - Variantes de componentes

### Desarrollo

- **Bun** - Runtime y package manager
- **ESLint** - Linter
- **TypeScript** - Type checking

## Arquitectura

### Estructura del Proyecto

```
src/
├── app/                    # Next.js App Router
│   ├── (auth)/            # Rutas de autenticación (grupo de rutas)
│   │   ├── login/
│   │   └── verify-email/
│   ├── api/               # API Routes
│   │   └── auth/          # Better Auth endpoints
│   └── layout.tsx         # Layout principal
├── components/            # Componentes React reutilizables
│   └── auth/              # Componentes de autenticación
├── db/                    # Base de datos
│   └── schema/            # Esquemas Drizzle
│       ├── better-auth.ts # Esquemas de autenticación
│       └── index.ts       # Exportaciones
└── lib/                   # Utilidades y configuraciones
    ├── auth/              # Configuración Better Auth
    ├── utils.ts           # Utilidades generales
    └── eden.ts            # Cliente Eden (Elysia)
```

### Patrones de Diseño

- **App Router**: Next.js 16 con Server Components por defecto
- **Server Actions**: Para mutaciones de datos
- **API Routes**: Para endpoints REST y Better Auth
- **Route Groups**: `(auth)` para organizar rutas sin afectar URLs
- **Type-Safe Database**: Drizzle ORM con TypeScript

### Flujo de Autenticación

1. Usuario se registra con email/contraseña o OAuth
2. Sistema envía email de verificación (obligatorio)
3. Usuario verifica email mediante link con token (expira en 24h)
4. Usuario puede iniciar sesión
5. Sesión persiste por 30 días con actualización automática
6. Rate limiting protege contra ataques de fuerza bruta

## Features Documentadas

### ✅ En Desarrollo

- **[Login](login/)** - Sistema de autenticación completo

  - Email/Password (P1)
  - OAuth con Google (P2)
  - Verificación de email obligatoria
  - Rate limiting y seguridad

- **[Dashboard Agente Inmobiliario](dashboard-agent/)** - Panel personalizado para administradores de propiedades

  - Visualización de resumen ejecutivo y métricas clave (P1)
  - Navegación rápida y acceso a secciones principales (P2)
  - Alertas y notificaciones de tareas pendientes (P3)

- **[Tablero Navigation](dashboard-navigation/)** - Navegación del tablero con menú basado en roles
  - Redirección post-login al tablero (P1)
  - Menú lateral personalizado según rol de usuario (P1)
  - Persistencia de estado del sidebar (P2)

- **[Logout](logout/)** - Sistema de cierre de sesión
  - Logout básico con invalidación de sesión (P1)
  - Logout desde múltiples dispositivos (P2)
  - Redirección al login después del logout
  - Manejo seguro de cookies y sesiones

- **[Creación de Cláusulas de Contratos](create-contract-clause/)** - Sistema para crear plantillas de cláusulas reutilizables
  - Control de acceso basado en roles (P1)
  - Formulario de creación de plantillas con categorías (P1)
  - Soporte para variables/placeholders en contenido (P1)
  - Selección de categorías predefinidas (P2)

### 📋 Planificadas

- **Dashboard Propietario** - Panel personalizado para propietarios de propiedades
- **Dashboard Inquilino** - Panel personalizado para inquilinos
- **Gestión de Contratos** - Creación, renovación y gestión de contratos de alquiler
- **Sistema de Pagos** - Seguimiento de pagos mensuales, recibos y estados de cuenta
- **Gestión de Mantenimiento** - Solicitudes, seguimiento y aprobación de trabajos de mantenimiento
- **Inventario de Propiedades** - Registro y gestión de propiedades, unidades y características
- **Sistema de Notificaciones** - Alertas y comunicaciones entre usuarios
- **Reportes y Analytics** - Insights sobre ingresos, ocupación y estado de propiedades

## Decisiones Técnicas Clave

### ¿Por qué Better Auth?

- Type-safe con TypeScript
- Integración nativa con Next.js App Router
- Soporte para múltiples proveedores OAuth
- Rate limiting integrado
- Sesiones seguras y configurables

### ¿Por qué Drizzle ORM?

- Type-safety completo
- Migraciones automáticas
- Sintaxis SQL-like
- Mejor rendimiento que otros ORMs
- Compatible con PostgreSQL

### ¿Por qué Next.js App Router?

- Server Components por defecto
- Streaming y Suspense
- Mejor SEO y rendimiento
- API Routes integradas
- Optimizaciones automáticas

## Configuración del Entorno

### Variables de Entorno Requeridas

```env
# Base de datos
DATABASE_URL=postgresql://user:password@localhost:5432/inmobiliaria

# Better Auth
BETTER_AUTH_SECRET=your-secret-key-here
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# OAuth (Google)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Email (para verificación)
# Configurar según proveedor de email
```

### Scripts Disponibles

```bash
# Desarrollo
bun dev              # Servidor de desarrollo con Turbo

# Base de datos
bun db:generate      # Generar migraciones
bun db:migrate       # Ejecutar migraciones
bun db:push          # Push schema a DB (desarrollo)
bun db:studio        # Abrir Drizzle Studio
bun db:seed          # Poblar base de datos

# Producción
bun build            # Build de producción
bun start            # Servidor de producción
bun lint             # Linter
```

## Roadmap General

### Fase 1: Fundación (En curso)

- ✅ Configuración del proyecto
- ✅ Sistema de autenticación
- ⏳ Dashboard básico por rol
  - ✅ Spec Dashboard Agente Inmobiliario
  - ⏳ Implementación Dashboard Agente Inmobiliario

### Fase 2: Core Features - Gestión de Propiedades

- Gestión de propiedades y unidades (CRUD)
- Asignación de roles y permisos
- Sistema de búsqueda y filtros

### Fase 3: Core Features - Contratos y Pagos

- Gestión de contratos de alquiler (creación, renovación, terminación)
- Sistema de pagos recurrentes y seguimiento
- Generación de recibos y estados de cuenta
- Recordatorios de pago y notificaciones

### Fase 4: Core Features - Mantenimiento

- Sistema de solicitudes de mantenimiento
- Aprobación y seguimiento de trabajos
- Gestión de proveedores y contratistas
- Historial de mantenimiento por propiedad

### Fase 5: Features Avanzadas

- Sistema de comunicación y mensajería
- Calendario de eventos y citas
- Reportes y analytics avanzados
- Exportación de datos y documentos

### Fase 6: Optimización

- Performance optimization
- SEO avanzado
- Internacionalización (i18n)
- PWA capabilities
- Integraciones con servicios externos (pagos, documentos)

## Convenciones y Estándares

### Estructura de Specs

Cada feature debe tener:

- `[feature]-spec.md` - Especificación funcional (user stories, requirements)
- `[feature]-plan.md` - Plan de implementación (tasks, fases, dependencias)

### Naming Conventions

- **Archivos**: kebab-case (`login-form.tsx`)
- **Componentes**: PascalCase (`LoginForm`)
- **Funciones**: camelCase (`handleSubmit`)
- **Constantes**: UPPER_SNAKE_CASE (`MAX_RETRIES`)
- **Tipos/Interfaces**: PascalCase (`User`, `Property`, `RentalContract`)

### Prioridades

- **P1**: Crítico - Bloquea otras features
- **P2**: Importante - Agrega valor significativo
- **P3**: Deseable - Mejora UX o funcionalidad

## Recursos

- [Next.js Documentation](https://nextjs.org/docs)
- [Better Auth Documentation](https://www.better-auth.com/docs)
- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview)
- [shadcn/ui Components](https://ui.shadcn.com/)

## Contribución

Al agregar nuevas features:

1. Crear carpeta en `specs/[feature-name]/`
2. Crear `[feature]-spec.md` usando el template
3. Crear `[feature]-plan.md` después de la spec
4. Actualizar este README con la nueva feature
5. Seguir las convenciones establecidas

---

**Nota**: Este documento debe actualizarse cuando se agreguen nuevas features o se tomen decisiones arquitectónicas importantes.
