# Implementation Plan: Registro con Integración de Resend

**Date**: 2025-01-21

**Spec**: [specs/register/register-spec.md](specs/register/register-spec.md)

## Summary

Integrar Resend como servicio de envío de emails para cumplir con los requisitos FR-008 (transacción atómica incluyendo envío de email), FR-014 (envío de emails de verificación) y SC-005 (emails entregados en 30 segundos). La implementación reemplazará la función `sendEmail` actual que solo hace `console.log` con una integración real usando Resend, manteniendo la misma interfaz para no romper el código existente. **CRÍTICO**: El envío del email debe ser parte de la transacción atómica de registro - si falla el envío, toda la transacción debe revertirse y no se debe persistir ninguna entidad en la base de datos.

## Technical Context

**Language/Version**: TypeScript 5, Next.js 16.0.7

**Primary Dependencies**: Resend, Better Auth, Drizzle ORM, PostgreSQL

**Storage**: PostgreSQL (Drizzle ORM)

**Testing**: Manual testing y verificación de entrega de emails

**Target Platform**: Node.js (Next.js API routes)

**Project Type**: Web application (Next.js)

**Performance Goals**: Emails entregados en <30 segundos (SC-005)

**Constraints**: Mantener compatibilidad con código existente, manejo robusto de errores, envío de email debe ser parte de transacción atómica (si falla, rollback completo)

**Scale/Scope**: Sistema de registro con verificación de email

## Project Structure

### Documentation (this feature)

```text
specs/register/
├── register-plan.md     # This file
└── register-spec.md     # Feature specification
```

### Source Code (repository root)

```text
src/
├── lib/
│   └── auth/
│       ├── email.ts          # Email sending functions (TO UPDATE)
│       ├── index.ts          # Better Auth config (uses sendEmail)
│       └── register.ts       # Registration utilities
├── app/
│   ├── api/
│   │   ├── register/
│   │   │   └── route.ts      # Registration endpoint (uses sendEmail)
│   │   └── auth/
│   │       └── [...all]/
│   │           └── route.ts  # Better Auth routes (uses sendEmail via config)
│   └── (auth)/
│       └── verify-email/
│           └── page.tsx      # Email verification page
└── components/
    └── auth/
        └── verify-email-form.tsx  # Resend verification form
```

**Structure Decision**: La estructura existente se mantiene. Solo se actualiza `src/lib/auth/email.ts` para integrar Resend, manteniendo la misma interfaz `EmailOptions` y función `sendEmail`.

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Verificar configuración existente

**Nota**: Resend ya está instalado (v6.6.0) y las variables de entorno están en `.env`

- [ ] T001 Verificar que Resend está instalado correctamente (ya instalado: v6.6.0)

- [ ] T002 Verificar que las variables de entorno `RESEND_API_KEY` y `EMAIL_FROM` están en `.env`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Validar configuración antes de implementar envío de emails

**⚠️ CRITICAL**: Esta fase debe completarse antes de que los emails funcionen en producción

- [ ] T003 Validar que las variables de entorno `RESEND_API_KEY` y `EMAIL_FROM` están disponibles en runtime y tienen valores válidos

**Checkpoint**: Variables de entorno validadas - implementación de Resend puede comenzar

---

## Phase 3: User Story 1 - Integración de Resend (Priority: P1)

**Goal**: Reemplazar la implementación mock de `sendEmail` con integración real de Resend, manteniendo compatibilidad con código existente

**Independent Test**: Verificar que los emails se envían correctamente ejecutando un registro de prueba y verificando que el email llega al destinatario dentro de 30 segundos

### Tests para User Story 1

- [ ] T004 [P] [US1] Test manual: Registrar usuario nuevo y verificar recepción de email de verificación

- [ ] T005 [P] [US1] Test manual: Solicitar reenvío de email de verificación y verificar recepción

- [ ] T005b [P] [US1] Test manual: Verificar rollback completo cuando falla envío de email (simular fallo de Resend y verificar que no se crean entidades en BD)

### Implementation para User Story 1

- [ ] T006 [P] [US1] Actualizar `src/lib/auth/email.ts`:

- Importar Resend

- Inicializar cliente Resend con `RESEND_API_KEY`

- Implementar `sendEmail` usando `resend.emails.send()`

- Usar `EMAIL_FROM` como remitente

- Mantener la misma interfaz `EmailOptions`

- Agregar manejo de errores robusto (try/catch, logging)

- Mantener fallback a console.log en desarrollo si falta API key

- [ ] T007 [US1] Agregar validación de variables de entorno en `sendEmail`:

- Verificar que `RESEND_API_KEY` existe (warning si no, fallback a console.log)

- Verificar que `EMAIL_FROM` existe (warning si no, fallback a console.log)

- Proporcionar mensajes de error claros si faltan

- [ ] T008 [US1] Mejorar manejo de errores en `sendEmail`:

- Capturar errores de Resend

- Loggear errores con contexto (destinatario, tipo de email)

- Lanzar errores apropiados para que el código llamador pueda manejarlos (estos errores deben causar rollback de transacción)

- Considerar retry logic para errores transitorios (opcional, pero debe estar dentro de la transacción)

- [ ] T009 [US1] Verificar que `src/lib/auth/index.ts` sigue funcionando:

- `sendVerificationEmail` callback debe seguir funcionando

- `sendResetPassword` callback debe seguir funcionando

- [ ] T010 [US1] Actualizar `src/app/api/register/route.ts` para incluir envío de email en transacción atómica:

- El envío de email debe ejecutarse DENTRO de la transacción de base de datos

- Si el envío de email falla, la transacción completa debe revertirse (rollback)

- No se deben crear entidades (inmobiliaria, usuario, cuenta Better Auth) si falla el email

- Verificar que el código maneja correctamente el rollback cuando falla el email

- [ ] T010b [US1] Actualizar `src/lib/auth/register.ts` (si existe) o lógica de registro para incluir envío de email en transacción:

- Asegurar que el envío de email es parte de la transacción atómica

- Implementar rollback completo si falla el envío

- Verificar que Better Auth también maneja esto correctamente si usa callbacks

**Checkpoint**: En este punto, los emails deben enviarse correctamente usando Resend dentro de la transacción atómica. El registro con email/password debe funcionar end-to-end con verificación de email real. Si falla el envío del email, toda la transacción debe revertirse y no se deben crear entidades en la base de datos.

---

## Phase 4: User Story 2 - Mejoras y Optimizaciones (Priority: P2)

**Goal**: Mejorar templates de email y agregar funcionalidades adicionales para mejor experiencia de usuario

**Independent Test**: Verificar que los emails tienen formato profesional y contienen toda la información necesaria

### Tests para User Story 2

- [ ] T011 [P] [US2] Verificar que emails de verificación tienen formato HTML correcto

- [ ] T012 [P] [US2] Verificar que emails de reset de contraseña tienen formato HTML correcto

- [ ] T013 [P] [US2] Test de renderizado: Verificar que emails se ven bien en diferentes clientes (Gmail, Outlook, etc.)

### Implementation para User Story 2

- [ ] T014 [P] [US2] Mejorar templates HTML de emails en `src/lib/auth/email.ts`:

- Crear template profesional para email de verificación

- Crear template profesional para email de reset de contraseña

- Incluir branding básico (nombre de la app, colores)
- Asegurar que emails son responsive

- Incluir versión texto plano mejorada

- [ ] T015 [US2] Agregar información adicional a emails:

- Incluir tiempo de expiración del token claramente
- Agregar instrucciones de seguridad

- Incluir link de soporte o ayuda si es necesario

- [ ] T016 [US2] Optimizar contenido de emails:

- Asegurar que el texto es claro y accionable
- Verificar que los links funcionan correctamente

- Asegurar que el asunto del email es descriptivo

**Checkpoint**: Los emails deben tener formato profesional y proporcionar buena experiencia de usuario

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Mejoras finales, documentación y validación

- [ ] T017 Documentar configuración de Resend en `src/lib/auth/README.md`:
- Instrucciones para obtener API key de Resend

- Cómo configurar dominio verificado

- Variables de entorno requeridas (ya configuradas en `.env`)

- Troubleshooting común

- [ ] T018 Agregar validación de configuración en desarrollo:
- Warning claro si `RESEND_API_KEY` no está configurado

- Instrucciones sobre cómo obtener la key

- Fallback graceful en desarrollo (console.log)

- [ ] T019 Verificar que todos los flujos de email funcionan:

- Registro con email/password → email de verificación (debe estar en transacción atómica)
- Verificar rollback cuando falla envío durante registro (no se crean entidades)
- Reenvío de email de verificación (no requiere rollback, solo mostrar error)

- Reset de contraseña (cuando se implemente)

- OAuth registration (no requiere email, pero verificar que no rompe)

- [ ] T020 Revisar y mejorar logging:

- Logs informativos cuando emails se envían exitosamente

- Logs de error detallados cuando fallan

- No loggear información sensible (tokens, passwords)

- [ ] T021 Verificar cumplimiento de SC-005:

- Medir tiempo de entrega de emails

- Asegurar que 99% de emails se entregan en <30 segundos

- Documentar métricas si es posible

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - puede comenzar inmediatamente (solo verificación)

- **Foundational (Phase 2)**: Depende de Setup - debe completarse antes de implementar Resend

- **User Story 1 (Phase 3)**: Depende de Foundational - BLOQUEA funcionalidad de emails en producción

- **User Story 2 (Phase 4)**: Depende de User Story 1 - mejoras opcionales

- **Polish (Phase 5)**: Depende de User Story 1 - mejoras finales

### User Story Dependencies

- **User Story 1 (P1)**: Puede comenzar después de Foundational - No depende de otras historias

- **User Story 2 (P2)**: Depende de User Story 1 - mejoras sobre la implementación base

### Within Each User Story

- Verificación de configuración antes de implementación (Resend ya instalado, variables en .env)

- Implementación core antes de mejoras

- Tests después de implementación

- Documentación al final

## Notes

- La función `sendEmail` en `src/lib/auth/email.ts` es usada en múltiples lugares:

- `src/lib/auth/index.ts` (callbacks de Better Auth)

- `src/app/api/register/route.ts` (registro manual)

- Mantener la misma interfaz es crítico para no romper código existente

- Resend requiere:

- API Key: Obtener de https://resend.com/api-keys

- Dominio verificado: Para producción, verificar dominio en Resend

- Email FROM: Debe ser de dominio verificado o usar dominio de prueba de Resend

- Manejo de errores:

- **CRÍTICO**: Si el email falla durante registro, la transacción completa DEBE revertirse (rollback) - no se deben crear entidades en la base de datos (FR-008, FR-014)

- El envío de email debe ejecutarse DENTRO de la transacción atómica de registro

- Si el email falla durante reenvío de verificación, el usuario debe ver error claro (el reenvío no está dentro de una transacción de registro, así que no requiere rollback)

- Loggear todos los errores para debugging

- Los errores de envío de email durante registro deben propagarse para causar rollback de la transacción

- Variables de entorno requeridas (ya configuradas en `.env`):

- `RESEND_API_KEY`: API key de Resend (requerido para producción)

- `EMAIL_FROM`: Email remitente (ej: `noreply@tudominio.com` o `onboarding@resend.dev` para pruebas)
- Testing:

- Usar dominio de prueba de Resend (`onboarding@resend.dev`) para desarrollo

- Verificar dominio propio para producción

- Resend tiene límite de 3,000 emails/mes en plan gratuito

- Consideraciones de seguridad:

- Nunca loggear API keys

- Validar formato de emails antes de enviar

