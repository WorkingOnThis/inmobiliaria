# CLAUDE.local.md — Gastón · Arce Administración

> Este archivo es personal y no se sube a GitHub (.gitignore).
> Claude Code lo lee automáticamente al iniciar cada sesión.

---

## Proyecto

Sistema de gestión inmobiliaria llamado **Arce Administración**.
Agencia argentina. Stack definido por el programador principal — no modificar sin consultar.
Rama de trabajo: `gaston/mvp-semana`

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

## Mi sistema de aprendizaje externo

Uso Obsidian para documentar lo que aprendo.
Tengo 4 tipos de notas con plantillas:

- **Concepto** — qué es algo y para qué sirve
- **Bug resuelto** — qué falló, por qué, cómo se resolvió
- **Decisión técnica** — por qué elegimos X sobre Y
- **Patrón/Receta** — cómo se hace algo que se repite

Cuando sugieras qué anotar, indicá qué tipo de nota corresponde.

---

## Tono y formato

- Hablame de vos a vos, en español rioplatense
- Directo, sin relleno
- Si algo tiene varias partes, usá listas
- No me des todo masticado: explicá, pero dejá preguntas abiertas
- Si notás que no entendí algo, preguntame antes de seguir

---

## Workflow de Git (recordatorio)

```bash
git add .
git commit -m "descripción breve de lo que hice"
git push
```

Siempre trabajar en `gaston/mvp-semana`. Nunca commitear directo a `main`.