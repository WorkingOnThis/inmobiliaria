import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-[0.75rem] font-bold uppercase tracking-[0.1em] w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "border-transparent bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        // ── Estado de entidad ──────────────────────────────────────────────
        active: "bg-green-dim text-green border-green/20",
        suspended: "bg-mustard-dim text-mustard border-mustard/20",
        baja: "bg-error-dim text-error border-error/20",
        // ── Estado de propiedad ────────────────────────────────────────────
        rented: "bg-status-rented-dim text-status-rented border-status-rented/20",
        available: "bg-status-available-dim text-status-available border-status-available/20",
        reserved: "bg-status-reserved-dim text-status-reserved border-status-reserved/20",
        maintenance: "bg-status-maintenance-dim text-status-maintenance border-status-maintenance/20",
        // ── Estado genérico ────────────────────────────────────────────────
        expiring: "bg-status-reserved-dim text-status-reserved border-status-reserved/20",
        draft: "bg-muted text-muted-foreground border-transparent",
        // ── Dominio financiero ─────────────────────────────────────────────
        income: "bg-income-dim text-income border-income/20",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "span"

  return (
    <Comp
      data-slot="badge"
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
