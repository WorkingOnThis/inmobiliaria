"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Info } from "lucide-react";

interface AnnulReceiptModalProps {
  open: boolean;
  onClose: () => void;
  reciboNumero: string;
  fecha: string;
  monto: string;
  inquilinoNombre?: string | null;
  teniaPagosLiquidados?: boolean;
  tieneRecibosPosteriores?: boolean;
  onSuccess?: () => void;
  queryKeysToInvalidate?: unknown[][];
}

export function AnnulReceiptModal({
  open,
  onClose,
  reciboNumero,
  fecha,
  monto,
  inquilinoNombre,
  teniaPagosLiquidados = false,
  tieneRecibosPosteriores = false,
  onSuccess,
  queryKeysToInvalidate = [],
}: AnnulReceiptModalProps) {
  const [motivo, setMotivo] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/receipts/${encodeURIComponent(reciboNumero)}/annul`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: motivo.trim() || undefined }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Error al anular el recibo");
      }
      return res.json();
    },
    onSuccess: () => {
      for (const key of queryKeysToInvalidate) {
        queryClient.invalidateQueries({ queryKey: key });
      }
      onClose();
      onSuccess?.();
    },
  });

  function handleClose() {
    if (mutation.isPending) return;
    setMotivo("");
    setConfirmed(false);
    mutation.reset();
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Anular recibo {reciboNumero}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 text-sm">
          <div className="rounded-md border border-border p-3 space-y-1 text-muted-foreground">
            <div><span className="text-foreground font-medium">Fecha:</span> {fecha}</div>
            <div><span className="text-foreground font-medium">Monto:</span> ${Number(monto).toLocaleString("es-AR")}</div>
            {inquilinoNombre && (
              <div><span className="text-foreground font-medium">Inquilino:</span> {inquilinoNombre}</div>
            )}
          </div>

          {teniaPagosLiquidados && (
            <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-amber-400">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <p>Este recibo incluye pagos ya liquidados al propietario. Deberás corregir el descuadre manualmente con un movimiento en caja.</p>
            </div>
          )}

          {tieneRecibosPosteriores && (
            <div className="flex gap-2 rounded-md border border-blue-500/40 bg-blue-500/10 p-3 text-blue-400">
              <Info className="size-4 shrink-0 mt-0.5" />
              <p>Hay otros pagos aplicados a este ítem. El saldo del inquilino se recalculará automáticamente.</p>
            </div>
          )}

          {mutation.error && (
            <p className="text-destructive text-xs">{mutation.error.message}</p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="motivo">Motivo de anulación (opcional)</Label>
            <Textarea
              id="motivo"
              placeholder="Ej: recibo emitido por error, monto incorrecto..."
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
              disabled={mutation.isPending}
            />
          </div>

          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              disabled={mutation.isPending}
            />
            <span className="text-muted-foreground text-xs">
              Entiendo que esta acción es irreversible. El recibo quedará marcado como anulado.
            </span>
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={() => mutation.mutate()}
            disabled={!confirmed || mutation.isPending}
          >
            {mutation.isPending ? "Anulando..." : `Anular ${reciboNumero}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
