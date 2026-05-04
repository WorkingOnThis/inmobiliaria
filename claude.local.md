# CLAUDE.local.md — Gastón · Arce Administración

> Este archivo es personal y no se sube a GitHub (.gitignore).
> Claude Code lo lee automáticamente al iniciar cada sesión.

---

## Proyecto

Sistema de gestión inmobiliaria llamado **Arce Administración**.
Agencia argentina. Stack definido por el programador principal — no modificar sin consultar.
### MVP de esta semana (en orden)
1. Módulo Caja — registrar ingresos y egresos
2. ABM — propietarios, inquilinos y propiedades con datos básicos
3. Recibos para inquilinos
4. Liquidación para propietarios

### Contexto de negocio relevante
- Índices: ICL, IPC, CER, UVA (ajuste de alquileres, API BCRA con fallback manual)
- Punitorios: TIM BCRA × multiplicador configurable
- Modalidad A: cobro por CBU inmobiliaria, recargo 1% que se descuenta de liquidación al propietario
- Modalidad B: split directo al propietario
- Efectivo: siempre exento de recargo
- Flujo de comunicación: Inquilino ↔ Staff ↔ Propietario, nunca directo entre extremos

---

## Mi perfil de aprendizaje

Soy principiante casi absoluto en programación. No tengo formación técnica previa.
Aprendo haciendo proyectos reales.

---

## Cómo tenés que enseñarme

Cada vez que hagas un cambio, agregues código, elijas una herramienta o resuelvas un bug, explicame:

- **Qué hiciste**, en términos simples
- **Por qué lo hiciste así** y no de otra forma
- **Qué alternativas existían** y por qué las descartaste
- **Si había un bug**, cuál fue la causa raíz, no solo el fix

Usá analogías con cosas cotidianas cuando el concepto sea abstracto.
Si no podés explicarlo con una analogía, intentalo igual.

Nunca asumas que ya sé algo. Si usás un término técnico, explicalo la primera vez que aparece en la sesión.

---

## Al final de cada sesión de trabajo

Agregá una entrada al archivo `LOG.md` con esta estructura:

```
### Qué hice

### Por qué lo hice así y no de otra forma

### Conceptos que aparecieron
- concepto: explicación breve en términos simples

### Preguntas para reflexionar
1.
2.

### Qué debería anotar en Obsidian
- [ ] item
```

Las entradas van de más nueva a más vieja (la última sesión arriba).

---

## Mi sistema de aprendizaje — Obsidian

Vault: `E:\Obsidians\Investigación y escritura\Obsidian Vault\Obsidian Gastón\Plantillas`

Cuando sugieras qué anotar al final de cada sesión, usá SOLO estas plantillas y completá el contenido listo para pegar. No uses ninguna otra plantilla fuera de estas cinco.

### 1. Concepto PR `tag: concepto/pr`
Secciones: ¿Qué es? / ¿Para qué sirve? / Analogía / Ejemplo concreto / Cómo se relaciona con / Preguntas que me hice / Fuente

### 2. Decisión técnica `tag: decision/pr`
Secciones: La decisión / El contexto / Las alternativas que existían / Por qué elegí esta y no las otras / Desventajas de lo que elegí / Cuándo revisarla / Fuente

### 3. Bug `tag: bug/pr`
Secciones: El error / Contexto / Por qué pasó / Cómo lo resolví / Qué aprendí / Cómo reconocerlo la próxima vez / Fuente

### 4. Patrón o Receta `tag: patron/pr`
Secciones: ¿Qué problema resuelve? / La receta (pasos) / Código base / Dónde lo usé / Variaciones / Ojo con esto / Fuente

### 5. Comando `tag: comando/pr`
Secciones: Sintaxis / Qué hace / Ejemplo de uso / Opciones comunes / Cuándo lo usás / Errores comunes / Relaciones / Notas personales

---

## Tono y formato

- Hablame de vos a vos, en español rioplatense
- Directo, sin relleno
- Si algo tiene varias partes, usá listas
- No me des todo masticado: explicá, pero dejá preguntas abiertas
- Si notás que no entendí algo, preguntame antes de seguir

## Al armar las notas de Obsidian del LOG
Usá las skills de obsidian-markdown y obsidian-cli disponibles en las skills globales
para generar notas con sintaxis correcta de Obsidian Flavored Markdown.

---

## Al iniciar cada sesión

Si el usuario no indica un tema específico, leé `PENDIENTES.md` y mostrá el primer ítem sin tachar de Prioridad alta. Decí cuál es y preguntá si confirmamos ese como objetivo de la sesión antes de tocar cualquier código.

---

## Workflow de Git (recordatorio)

```bash
git add .
git commit -m "descripción breve de lo que hice"
git push
```