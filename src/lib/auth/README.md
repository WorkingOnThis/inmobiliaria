# Better Auth Configuration

Este directorio contiene la configuración de Better Auth para el sistema de autenticación.

## Archivos

- `index.ts`: Configuración principal de Better Auth
- `email.ts`: Funciones para envío de emails
- `client.ts`: Cliente Better Auth para uso en componentes React
- `hooks.ts`: Hooks de React para manejar sesiones

## Variables de Entorno Requeridas

Crea un archivo `.env.local` o `.env` con las siguientes variables:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# Better Auth
BETTER_AUTH_SECRET=tu-secret-key-aqui-cambiar-en-produccion
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Email (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM=noreply@tudominio.com

# OAuth Providers (opcional)
GOOGLE_CLIENT_ID=tu-google-client-id
GOOGLE_CLIENT_SECRET=tu-google-client-secret
```

## Configuración de Google OAuth

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Habilita la API de Google+
4. Crea credenciales OAuth 2.0 (OAuth client ID)
5. Configura los redirect URIs:
   - Desarrollo: `http://localhost:3000/api/auth/callback/google`
   - Producción: `https://tudominio.com/api/auth/callback/google`
6. Copia el Client ID y Client Secret a las variables de entorno

## Funcionalidades Implementadas

- ✅ Autenticación con email y contraseña
- ✅ Verificación de email requerida
- ✅ OAuth con Google
- ✅ Rate limiting (5 intentos / 15 minutos para login)
- ✅ Sesiones persistentes (30 días)
- ✅ Sesiones de navegador
- ✅ Invalidación de sesiones
- ✅ Manejo de errores genéricos (no revela existencia de usuarios)

## Integración de Email

El sistema utiliza **Resend** para el envío de emails de verificación y reset de contraseña.

### Configuración de Resend

1. **Obtener API Key**:
   - Ve a [Resend Dashboard](https://resend.com/api-keys)
   - Crea una cuenta o inicia sesión
   - Genera una nueva API key
   - Copia la key (formato: `re_xxxxxxxxxxxxx`)

2. **Configurar Variables de Entorno**:
   ```env
   RESEND_API_KEY=re_xxxxxxxxxxxxx
   EMAIL_FROM=noreply@tudominio.com
   ```

3. **Configurar Dominio (Producción)**:
   - En desarrollo, puedes usar el dominio de prueba: `onboarding@resend.dev`
   - Para producción, verifica tu dominio en [Resend Domains](https://resend.com/domains)
   - Una vez verificado, usa un email de tu dominio: `noreply@tudominio.com`

### Troubleshooting

**Problema**: Los emails no se envían
- Verifica que `RESEND_API_KEY` está configurada correctamente
- Verifica que `EMAIL_FROM` está configurada
- Revisa los logs del servidor para ver errores específicos
- Si falta la API key, los emails se loguearán a la consola en desarrollo

**Problema**: Error "Invalid API key"
- Verifica que la API key es correcta y no ha expirado
- Asegúrate de que la key tiene permisos para enviar emails

**Problema**: Error "Domain not verified"
- En desarrollo, usa `onboarding@resend.dev`
- En producción, verifica tu dominio en Resend Dashboard

**Límites del Plan Gratuito**:
- 3,000 emails por mes
- 100 emails por día
- Para más información, visita [Resend Pricing](https://resend.com/pricing)

### Implementación

La función `sendEmail` en `src/lib/auth/email.ts` maneja automáticamente:
- Validación de variables de entorno
- Fallback a console.log si falta configuración (desarrollo)
- Manejo robusto de errores
- Logging detallado para debugging

### Transacción Atómica (CRÍTICO)

**IMPORTANTE**: En el endpoint de registro (`/api/register`), el envío de email está dentro de una transacción atómica de base de datos. Esto significa:

- Si el envío de email falla, **toda la transacción se revierte** (rollback completo)
- **No se crean entidades** (usuario, inmobiliaria, cuenta) si falla el email
- Esto cumple con los requisitos FR-008 y FR-014 de la especificación
- El usuario debe intentar el registro nuevamente si el email falla

Este comportamiento garantiza que no queden registros huérfanos en la base de datos cuando falla el envío del email de verificación.

## Migraciones de Base de Datos

Las tablas de Better Auth están definidas en `src/db/schema/better-auth.ts`.

Para aplicar las migraciones:

```bash
# Generar migraciones
npm run db:generate

# Aplicar migraciones
npm run db:migrate

# O para desarrollo (directo a la BD)
npm run db:push
```

## Uso en Componentes

### Verificar sesión (Server Component)

```tsx
import { auth } from "@/lib/auth";
import { headers } from "next/headers";

export default async function Page() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  
  if (!session?.user) {
    redirect("/login");
  }
  
  return <div>Hola {session.user.name}</div>;
}
```

### Usar sesión (Client Component)

```tsx
"use client";
import { useSession } from "@/lib/auth/hooks";

export default function ClientComponent() {
  const { session, isLoading } = useSession();
  
  if (isLoading) return <div>Cargando...</div>;
  if (!session) return <div>No autenticado</div>;
  
  return <div>Hola {session.user.name}</div>;
}
```

### Iniciar sesión

```tsx
"use client";
import { authClient } from "@/lib/auth/client";

await authClient.signIn.email({
  email: "user@example.com",
  password: "password",
});
```

## Seguridad

- ✅ Passwords hasheados con scrypt
- ✅ Comparación segura de passwords (timing-safe)
- ✅ Protección CSRF automática
- ✅ Cookies httpOnly, secure, SameSite
- ✅ Rate limiting configurado
- ✅ Errores genéricos (no revelan existencia de usuarios)
- ✅ Validación de inputs
- ✅ Tokens de verificación con expiración (24 horas)

