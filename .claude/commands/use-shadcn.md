# use-shadcn

## Propósito
Asegurar que toda UI nueva reutilice componentes existentes, use shadcn/ui
como base, y extraiga componentes cuando una pieza se repite 3 o más veces.
Nunca hardcodear estilos que ya resuelve shadcn o el design system de Arce.

## Flujo obligatorio antes de implementar cualquier elemento de UI

### Paso 1 — Buscar si ya existe

Antes de crear cualquier elemento nuevo (botón, card, badge, input, modal,
tabla, etc.), buscar en el proyecto si ya hay algo equivalente:

```bash
grep -r "Button\|Dialog\|Badge\|Card\|Input\|Select\|Sheet" src/components --include="*.tsx" -l
```

Si existe un componente que hace lo mismo o algo similar → reutilizarlo o
extenderlo. No crear uno nuevo.

### Paso 2 — Clasificar la intención antes de elegir variante

Usar esta tabla para elegir la variante correcta de shadcn según lo que
hace el elemento, no según cómo se ve:

| Intención | Componente shadcn | Variante |
|---|---|---|
| Acción primaria (guardar, confirmar, enviar) | `Button` | `default` |
| Acción destructiva (eliminar, dar de baja, cancelar contrato) | `Button` | `destructive` |
| Acción de navegación (ver ficha, ir a lista) | `Button` | `ghost` o `link` |
| Acción contextual (agregar, filtrar, expandir) | `Button` | `outline` o `secondary` |
| Estado de entidad | `Badge` | según color semántico del design system |
| Confirmación destructiva | `AlertDialog` | — |
| Panel lateral | `Sheet` | — |
| Formulario en overlay | `Dialog` | — |

### Paso 3 — Implementar sin hardcodear

Al escribir el componente:
- Usar siempre componentes de `@/components/ui/` (shadcn)
- Usar siempre variables CSS del design system (`var(--primary)`, etc.)
  nunca valores hex ni rgb directos
- Usar siempre clases de Tailwind mapeadas al tema, nunca valores
  arbitrarios para colores (`text-[#ffb4a2]` está prohibido,
  `text-primary` es correcto)
- Si un valor no tiene clase Tailwind equivalente, usar `style` con
  la variable CSS: `style={{ color: "var(--primary)" }}`

### Paso 4 — Detectar repetición y extraer (Rule of Three)

Durante la implementación, contar cuántas veces aparece el mismo patrón
de UI en el proyecto. Si un patrón aparece 3 o más veces:

1. **Avisar antes de actuar:**
   > "Encontré que [descripción del patrón] aparece en [archivo1], [archivo2]
   > y [archivo3]. Por la Rule of Three, conviene extraerlo a un componente
   > propio en `src/components/[nombre].tsx`. Voy a hacerlo ahora."

2. Crear el componente en `src/components/` con props tipadas en TypeScript
3. Reemplazar las 3 instancias existentes para que importen el nuevo componente
4. Verificar que el build no rompa después del reemplazo

El aviso es obligatorio. No extraer en silencio.

## Qué no hacer

- No crear componentes wrapper que solo envuelven un componente shadcn
  sin agregar nada (ej: `<MyButton>` que solo renderiza `<Button>`)
- No aplicar estilos inline que dupliquen lo que ya hace una clase de Tailwind
- No instalar librerías de UI externas sin consultar — shadcn cubre el 95%
  de los casos
- No extraer un componente si aparece menos de 3 veces — es sobreingeniería