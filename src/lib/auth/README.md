# Better Auth Configuration

Este directorio contiene la configuración de Better Auth para el sistema de autenticación.

## Archivos

- `index.ts`: Configuración principal de Better Auth
- `email.ts`: Funciones para envío de emails
- `client.ts`: Cliente Better Auth para uso en componentes React
- `hooks.ts`: Hooks de React para manejar sesiones

## Variables de Entorno Requeridas

Crea un archivo `.env.local` con las siguientes variables:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dbname

# Better Auth
BETTER_AUTH_SECRET=tu-secret-key-aqui-cambiar-en-produccion
BETTER_AUTH_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000

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

Por defecto, los emails se loguean a la consola. Para producción, integra un servicio de email:

### Opción 1: Resend

```bash
npm install resend
```

```ts
import { Resend } from "resend";
const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendEmail(options: EmailOptions) {
  await resend.emails.send({
    from: process.env.EMAIL_FROM!,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  });
}
```

### Opción 2: SendGrid

```bash
npm install @sendgrid/mail
```

```ts
import sgMail from "@sendgrid/mail";
sgMail.setApiKey(process.env.SENDGRID_API_KEY!);

export async function sendEmail(options: EmailOptions) {
  await sgMail.send({
    from: process.env.EMAIL_FROM!,
    to: options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
  });
}
```

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

