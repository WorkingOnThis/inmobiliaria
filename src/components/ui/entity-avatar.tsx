/**
 * EntityAvatar — avatar con iniciales para entidades del sistema.
 * Basado en el componente Avatar de shadcn/ui.
 *
 * Props:
 *   initials   – 1 o 2 caracteres a mostrar (ej: "GR", "A")
 *   size       – "sm" | "md" | "lg"  (por defecto "md")
 *   colorSeed  – string opcional para derivar el color de fondo.
 *                Sin colorSeed → --primary-dark (color marca).
 *                Con colorSeed → cicla entre [primary-dark, avatar-a, avatar-b]
 *                basado en el charCode del primer carácter.
 *
 * Tamaños:
 *   sm  → 28×28 px · text-[0.62rem] · radius-sm (6px)  — dropdown / lista compacta
 *   md  → 36×36 px · text-xs        · radius-md (10px) — fila de tabla estándar
 *   lg  → 48×48 px · text-sm        · radius-lg (18px) — cabecera de ficha
 */

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const AVATAR_BG_VARS = [
  "var(--primary-dark)",
  "var(--avatar-a)",
  "var(--avatar-b)",
] as const;

const AVATAR_TEXT_COLOR = "var(--on-bg)";

function deriveColor(seed: string | undefined): string {
  if (!seed) return AVATAR_BG_VARS[0];
  const idx = seed.charCodeAt(0) % AVATAR_BG_VARS.length;
  return AVATAR_BG_VARS[idx];
}

const SIZE_CLASSES = {
  sm: "size-7 text-[0.62rem]",
  md: "size-9 text-xs",
  lg: "size-12 text-sm",
} as const;

const SIZE_RADIUS = {
  sm: "var(--radius-sm)",
  md: "var(--radius-md)",
  lg: "var(--radius-lg)",
} as const;

interface EntityAvatarProps {
  initials: string;
  size?: keyof typeof SIZE_CLASSES;
  colorSeed?: string;
}

export function EntityAvatar({
  initials,
  size = "md",
  colorSeed,
}: EntityAvatarProps) {
  const bg = deriveColor(colorSeed);
  return (
    <Avatar
      className={cn(SIZE_CLASSES[size], "flex-shrink-0")}
      style={{ borderRadius: SIZE_RADIUS[size] }}
    >
      <AvatarFallback
        style={{
          background: bg,
          color: AVATAR_TEXT_COLOR,
          borderRadius: SIZE_RADIUS[size],
        }}
        className="font-brand font-extrabold"
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  );
}
