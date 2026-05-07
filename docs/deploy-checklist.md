# Deploy Checklist — Arce Administración → Vercel

> Lista paso a paso para el primer deploy a producción. Marcá cada item al completarlo. **No saltees pasos** — el orden importa (algunos depende de otros).

**Target host:** Vercel (decisión registrada en `docs/decisions/usuarios-y-acceso.md` § SEC-7).

---

## Fase 0 — Pre-requisitos (antes de tocar Vercel)

- [ ] **Cuenta de GitHub** con el repo de Arce Administración pusheado (las commits SEC-1…SEC-7 deben estar en `main`).
- [ ] **Cuenta de Vercel** creada y conectada a tu cuenta de GitHub (https://vercel.com).
- [ ] **Cuenta de Neon** con un proyecto y al menos una branch lista para producción (ya tenés `arce-administracion` en `org-spring-waterfall-52443474`).
- [ ] **Cuenta de Gmail** (la misma que ya usás en dev) con 2FA habilitado y app password generada (Settings → Security → App passwords). Si no tenés una, crear ahora: https://myaccount.google.com/apppasswords.
- [ ] **Dominio** elegido (puede ser un subdominio gratis de Vercel inicial — `arce-admin.vercel.app` — y migrás a custom domain después).

---

## Fase 1 — Generar secrets de producción

**Estos son distintos a los de dev.** Nunca reusar entre entornos.

- [ ] Generar `BETTER_AUTH_SECRET` para producción:
  ```bash
  openssl rand -base64 32
  ```
  Guardá el output en un password manager — lo vas a setear en Vercel en Fase 4.

- [ ] Generar `CRON_SECRET` para producción:
  ```bash
  openssl rand -base64 32
  ```
  Guardá también.

- [ ] Verificar que la **app password de Gmail** sigue siendo válida (probarla manualmente con `nodemailer` desde un script local si tenés dudas). Si fue creada hace mucho, considerar rotarla: revoke en Google Settings y generar nueva.

---

## Fase 2 — Preparar la DB de producción en Neon

- [ ] **Decidir branch**: usar la default branch del proyecto Neon (`main` o `production`) en lugar de tu branch de desarrollo. Si querés aislamiento total, crear un proyecto Neon separado (`arce-administracion-prod`).
- [ ] **Aplicar todas las migraciones SEC** a la branch de producción si no fueron aplicadas:
  - `docs/migrations/sec-3-add-agency-id.sql`
  - `docs/migrations/sec-3-add-user-agency-id.sql`
  - Los cambios de schema TS (que reflejan estas migraciones) están en código y `db:push` los aplicaría — pero como usamos SQL hand-written, mejor correr los archivos `.sql` con `psql` o vía Neon SQL editor para mantener el trail.
- [ ] Verificar que **una sola agency** existe (o ninguna): `SELECT id, name FROM agency;`. Si la branch tiene data de dev, considerar reset (`mcp__neon__reset_from_parent` o crear un proyecto fresh).
- [ ] Anotar el connection string (con `sslmode=require` y pooler endpoint).

---

## Fase 3 — Crear y configurar el Vercel Blob store

- [ ] En el dashboard de Vercel → Storage → Create Database → Blob.
- [ ] Conectar el Blob store al proyecto que vas a deployar (Vercel automáticamente setea `BLOB_READ_WRITE_TOKEN` en las env vars del proyecto).
- [ ] Verificar en Project Settings → Environment Variables que `BLOB_READ_WRITE_TOKEN` aparece con value enmascarado.

---

## Fase 4 — Importar el proyecto en Vercel y setear env vars

- [ ] Click "Add New Project" en el dashboard de Vercel, seleccioná el repo de GitHub.
- [ ] Vercel auto-detecta Next.js y configura build correctamente. **No cambiar build command** — el default `next build` ya funciona.
- [ ] En la pantalla de import, expandir "Environment Variables" y agregar (Production):

  | Variable | Value |
  |---|---|
  | `DATABASE_URL` | connection string de la branch Neon prod (Fase 2) |
  | `BETTER_AUTH_SECRET` | el que generaste en Fase 1 |
  | `BETTER_AUTH_URL` | `https://<your-vercel-url>` (sin trailing slash) — usar el subdomain de Vercel inicialmente; cambiar después de Fase 7 si configurás custom domain |
  | `GMAIL_USER` | tu email de Gmail |
  | `GMAIL_APP_PASSWORD` | la app password de Gmail |
  | `CRON_SECRET` | el que generaste en Fase 1 |

  `BLOB_READ_WRITE_TOKEN` ya está auto-seteado por Vercel (Fase 3).

  **Opcionales (dejar vacíos por ahora):**
  - `NEXT_PUBLIC_APP_URL` — fallback para client-side, redundante si `BETTER_AUTH_URL` está bien
  - `NEXT_PUBLIC_API_URL` — solo si activás Eden Treaty (no usado hoy)
  - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — solo si activás OAuth con Google

- [ ] Click "Deploy".

---

## Fase 5 — Primer deploy y verificación básica

- [ ] Esperar a que el primer build termine (~3–5 min). Si falla:
  - Leer los logs del build. Errores TS o de runtime deberían estar atrapados por nuestro `bun run build` local.
  - El error más común es env var faltante. Volver a Fase 4 y completar.

- [ ] Una vez deployado, verificar que la URL responde:
  ```
  https://<your-vercel-url>/login
  ```
  Debe mostrar el formulario de login (no error 500).

- [ ] Verificar que el endpoint del cron está disponible (no debería responder sin secret):
  ```bash
  curl https://<your-vercel-url>/api/cron/cleanup-files
  ```
  Esperado: 401 Unauthorized.

- [ ] En Vercel dashboard → Settings → Crons, verificar que el cron `0 2 * * *` para `/api/cron/cleanup-files` aparece registrado. Vercel lo lee de `vercel.json`.

---

## Fase 6 — Smoke test completo end-to-end

Estos pasos validan que todas las features que tocamos en SEC-1…SEC-6 funcionan en prod.

- [ ] **Registro**: ir a `/register`, crear un user nuevo (`test@example.com`).
  - **Verificar el email llega**: revisar inbox de `test@example.com` (o `arce.guillermo.gaston@gmail.com` si usás un alias). Debe estar el email de "Verificá tu dirección".
  - Si NO llega: revisar Logs en Vercel dashboard → Functions → /api/register. Si el error dice "GMAIL_USER and GMAIL_APP_PASSWORD must be configured" — env var mal seteada; volver a Fase 4.

- [ ] **Verificación de email**: click en el link del email. Debe redirigir a `/verify-email?verified=true`.

- [ ] **Crear inmobiliaria**: login con el user, debe redirigir a `/register-oauth`. Crear "Test Inmobiliaria". Debe redirigir al dashboard.

- [ ] **Crear cliente**: ir a `/propietarios/nuevo`, crear un owner. Verificar que aparece en la lista.

- [ ] **Crear propiedad**: ir a `/propiedades/nueva`, asignar al owner creado. Verificar que aparece.

- [ ] **Subir un archivo a una tarea**:
  - Crear una tarea
  - Subir un PDF de prueba (cualquier PDF chico)
  - Verificar que aparece en la lista de archivos
  - **Click en el archivo**: debe DESCARGARSE (no abrirse inline) — esto valida que `Content-Disposition: attachment` está activo
  - **Verificar en Vercel Blob dashboard** (Storage → tu Blob store): el archivo aparece con pathname `tasks/<task-id>/<filename>`

- [ ] **Subir un comprobante a un movimiento de caja**:
  - Crear un movimiento manual en `/caja`
  - Adjuntar un PDF como comprobante
  - Verificar que la operación devuelve 201

- [ ] **Probar XSS resistance** (uploads):
  - Renombrar un archivo malicioso a `.html`: crear un archivo `evil.html` con contenido `<script>alert('xss')</script>`
  - Intentar subirlo como archivo de tarea
  - Esperado: 400 con mensaje "Tipo de archivo no permitido"
  - Si el upload pasa: hay un bug en `validateUpload`. Detener deploy.

- [ ] **Probar permisos**: crear un segundo user. Sin completar el flow de registro de inmobiliaria, intentar acceder a `/propietarios`. Esperado: redirect a `/register-oauth`.

- [ ] **Probar el cron manualmente** (con el secret):
  ```bash
  curl -H "Authorization: Bearer <CRON_SECRET>" https://<your-vercel-url>/api/cron/cleanup-files
  ```
  Esperado: 200 con `{ ok: true, processed: 0, deleted: 0, ... }`.

---

## Fase 7 — Custom domain (opcional)

Si querés un dominio propio en lugar de `<project>.vercel.app`:

- [ ] Comprar el dominio (Cloudflare Registrar / Namecheap / etc.)
- [ ] En Vercel → Settings → Domains → Add. Seguir las instrucciones de DNS (agregar A record o CNAME).
- [ ] Esperar propagación DNS (~10 min a 24 hs).
- [ ] Vercel emite SSL cert automáticamente (Let's Encrypt). Verificar que `https://<your-domain>` responde.
- [ ] **Actualizar `BETTER_AUTH_URL`** en Vercel env vars al nuevo dominio (sin trailing slash).
- [ ] Re-deploy (Project → Deployments → ⋯ → Redeploy) para que la nueva env var tome efecto.
- [ ] Re-correr Fase 6 con el nuevo dominio para validar.

---

## Fase 8 — Operacional / runbook

### Cómo rotar `BETTER_AUTH_SECRET`

1. Generar nuevo secret: `openssl rand -base64 32`
2. Actualizar el env var en Vercel → Project Settings → Environment Variables.
3. Re-deploy.
4. **Todas las sesiones existentes son invalidadas** (firmas viejas dejan de validar). Los users tendrán que re-loguearse. Anunciar previo.

### Cómo rotar `CRON_SECRET`

1. Generar nuevo secret.
2. Actualizar el env var en Vercel.
3. Re-deploy. Vercel actualiza automáticamente el header que envía al cron — no hay que tocar nada más.

### Cómo invalidar todas las sesiones (panic button)

```sql
DELETE FROM session;
```
Corrido contra la DB de prod. Todos los users deslogueados al instante.

### Cómo correr el cron manualmente (debug)

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" https://<your-vercel-url>/api/cron/cleanup-files
```

### Cómo subir un fix urgente

```bash
git checkout -b hotfix/<nombre>
# editar
git commit
git push
# crear PR en GitHub. Mergear → Vercel auto-deploys main.
```

Vercel hace deploy automático de cada push a `main`. Si el build falla, el deploy anterior sigue activo.

### Cómo hacer rollback de un deploy

Vercel Dashboard → Deployments → seleccionar un deploy anterior → "Promote to Production".

---

## Checklist de "go-live" — última pasada antes de anunciar

- [ ] Fase 1, 2, 3 completas.
- [ ] Fase 4 con todas las env vars seteadas.
- [ ] Fase 5: primer deploy verde.
- [ ] Fase 6: SMOKE TEST completo. Cada item marcado.
- [ ] Fase 7 si aplica.
- [ ] **Backup de prod DB**: tomar un snapshot Neon antes del primer user real (Project → Branches → ⋯ → Create snapshot).
- [ ] **Plan de comunicación de incidentes**: si pasa algo, ¿quién avisa a quién? (vos solo por ahora — anotar email de soporte para que clientes te puedan contactar).
- [ ] **Monitoreo**: configurar Vercel notifications para failed builds (Project → Settings → Git → Build & Development → Email on failure).

---

## Referencias

- Decisión de host: `docs/decisions/usuarios-y-acceso.md` § SEC-7
- Migrations aplicadas: `docs/migrations/sec-3-add-agency-id.sql`, `sec-3-add-user-agency-id.sql`
- Storage adapter: `src/lib/uploads/storage.ts` (selecciona Local o Vercel Blob según `BLOB_READ_WRITE_TOKEN`)
- Cron config: `vercel.json`
- Security headers: `next.config.ts` § `headers()`
- Email fail-fast: `src/lib/auth/email.ts` (throws en `NODE_ENV=production` si faltan creds)
- Cross-agency validation: `scripts/test-cross-agency.ts` (correr en una branch ephemeral si querés re-validar pre-deploy)
