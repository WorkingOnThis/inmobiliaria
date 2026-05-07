"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Loader2, FileText, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import {
  AMENDMENT_TYPE_LABELS,
  AMENDMENT_STATUS_LABELS,
  type AmendmentListItem,
} from "@/lib/contracts/amendments";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { AmendmentCreateModal } from "./amendment-create-modal";

function statusBadgeClass(status: string): string {
  switch (status) {
    case "registered":         return "bg-mustard-dim text-mustard border-mustard/20";
    case "document_generated": return "bg-info-dim text-info border-info/20";
    case "signed":             return "bg-green-dim text-green border-green/20";
    default:                   return "bg-surface-highest text-muted-foreground";
  }
}

export function ContractTabAmendments({ contractId }: { contractId: string }) {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const { data, isLoading } = useQuery<{ amendments: AmendmentListItem[] }>({
    queryKey: ["amendments", contractId],
    queryFn: () => fetch(`/api/contracts/${contractId}/amendments`).then((r) => r.json()),
  });

  const patchMutation = useMutation({
    mutationFn: async ({ aid, status }: { aid: string; status: string }) => {
      const res = await fetch(`/api/contracts/${contractId}/amendments/${aid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Error al actualizar");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Estado actualizado");
      queryClient.invalidateQueries({ queryKey: ["amendments", contractId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const generateMutation = useMutation({
    mutationFn: async (aid: string) => {
      const res = await fetch(`/api/contracts/${contractId}/amendments/${aid}/document`, {
        method: "POST",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Error al generar");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Documento generado");
      queryClient.invalidateQueries({ queryKey: ["amendments", contractId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (aid: string) => {
      const res = await fetch(`/api/contracts/${contractId}/amendments/${aid}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? "Error al eliminar");
      }
    },
    onSuccess: () => {
      toast.success("Instrumento eliminado. El contrato fue revertido.");
      queryClient.invalidateQueries({ queryKey: ["amendments", contractId] });
      queryClient.invalidateQueries({ queryKey: ["contract", contractId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const amendments = data?.amendments ?? [];

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.09em] text-muted-foreground">
            Instrumentos post-firma
          </p>
          {amendments.length > 0 && (
            <p className="text-[0.7rem] text-muted-foreground mt-0.5">
              {amendments.length} instrumento{amendments.length !== 1 ? "s" : ""} registrado{amendments.length !== 1 ? "s" : ""}
            </p>
          )}
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          + Nuevo instrumento
        </Button>
      </div>

      {amendments.length === 0 && (
        <div className="rounded-[18px] border border-dashed border-border bg-surface p-10 text-center">
          <p className="text-[0.78rem] text-muted-foreground">
            No hay instrumentos registrados para este contrato.
          </p>
          <p className="text-[0.72rem] text-muted-foreground mt-1">
            Las salvedades, modificaciones, prórrogas y otros acuerdos post-firma aparecen aquí.
          </p>
        </div>
      )}

      {amendments.map((a) => (
        <div key={a.id} className="rounded-[18px] border border-border bg-surface overflow-hidden">
          <div className="flex items-start justify-between px-[18px] py-[14px] border-b border-border">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <span className="text-[0.82rem] font-semibold text-on-surface">
                  {AMENDMENT_TYPE_LABELS[a.type]} N°{a.typeSequenceNumber}
                </span>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.65rem] font-bold border ${statusBadgeClass(a.status)}`}>
                  {AMENDMENT_STATUS_LABELS[a.status] ?? a.status}
                </span>
              </div>
              <p className="text-[0.78rem] text-text-secondary">{a.title}</p>
              <p className="text-[0.68rem] text-muted-foreground">
                Registrado: {format(new Date(a.createdAt), "dd/MM/yyyy", { locale: es })}
                {a.effectiveDate && (
                  <> · Vigente desde: {format(new Date(a.effectiveDate + "T00:00:00"), "dd/MM/yyyy", { locale: es })}</>
                )}
                {a.signedAt && (
                  <> · Firmado: {format(new Date(a.signedAt), "dd/MM/yyyy", { locale: es })}</>
                )}
              </p>
            </div>
          </div>

          {Object.keys(a.fieldsChanged).length > 0 && (
            <div className="px-[18px] py-3 border-b border-border">
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-2">
                Cambios registrados
              </p>
              <div className="space-y-1">
                {Object.entries(a.fieldsChanged).map(([field, { before, after, label }]) => (
                  <div key={field} className="flex items-center gap-2 text-[0.75rem]">
                    <span className="text-muted-foreground w-44 shrink-0">{label}</span>
                    <span className="text-error line-through opacity-60">{String(before)}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="text-income font-medium">{String(after)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {a.description && (
            <div className="px-[18px] py-3 border-b border-border">
              <p className="text-[0.75rem] text-text-secondary">{a.description}</p>
            </div>
          )}

          <div className="flex items-center gap-2 px-[18px] py-3 flex-wrap">
            {a.status === "registered" && !a.hasDocument && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => generateMutation.mutate(a.id)}
                disabled={generateMutation.isPending}
              >
                {generateMutation.isPending && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}
                <FileText className="h-3 w-3 mr-1" />
                Generar documento
              </Button>
            )}

            {a.hasDocument && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => window.open(`/contratos/${contractId}/modificaciones/${a.id}`, "_blank")}
              >
                <FileText className="h-3 w-3 mr-1" />
                Ver documento
              </Button>
            )}

            {(a.status === "registered" || a.status === "document_generated") && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => patchMutation.mutate({ aid: a.id, status: "signed" })}
                disabled={patchMutation.isPending}
              >
                <CheckCircle className="h-3 w-3 mr-1" />
                Marcar como firmado
              </Button>
            )}

            {a.status === "registered" && !a.hasDocument && (
              <Button
                size="sm"
                variant="ghost"
                className="text-error hover:bg-error-dim ml-auto"
                onClick={() => {
                  if (confirm("¿Eliminar este instrumento? El contrato volverá a su estado anterior.")) {
                    deleteMutation.mutate(a.id);
                  }
                }}
                disabled={deleteMutation.isPending}
              >
                Eliminar
              </Button>
            )}
          </div>
        </div>
      ))}

      <AmendmentCreateModal
        contractId={contractId}
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  );
}
