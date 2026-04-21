"use client";

import { useRef } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { UploadCloud, Download, Trash2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { ContractDocument } from "./contract-detail";

interface Props {
  contractId: string;
  documents: ContractDocument[];
}

export function ContractTabDocuments({ contractId, documents }: Props) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/contracts/${contractId}/documents`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error al subir el documento");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract", contractId] });
      toast.success("Documento subido");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (documentId: string) => {
      const res = await fetch(
        `/api/contracts/${contractId}/documents/${documentId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error al eliminar el documento");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract", contractId] });
      toast.success("Documento eliminado");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadMutation.mutate(file);
    e.target.value = "";
  };

  return (
    <div className="flex flex-col gap-5 pt-5">
      {/* Upload zone */}
      <div
        className="rounded-[18px] border border-dashed border-border bg-surface px-[18px] py-6 flex flex-col items-center gap-3 cursor-pointer hover:bg-surface-high transition-colors"
        onClick={() => fileInputRef.current?.click()}
      >
        <UploadCloud className="h-8 w-8 text-muted-foreground" />
        <div className="text-center">
          <p className="text-sm font-medium">Subir documento</p>
          <p className="text-xs text-muted-foreground mt-0.5">PDF, JPG o PNG · máx. 10 MB</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={uploadMutation.isPending}
          onClick={(e) => {
            e.stopPropagation();
            fileInputRef.current?.click();
          }}
        >
          {uploadMutation.isPending ? "Subiendo..." : "Seleccionar archivo"}
        </Button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Document list */}
      {documents.length === 0 ? (
        <div className="rounded-[18px] border border-border bg-surface px-[18px] py-10 flex flex-col items-center gap-2 text-muted-foreground">
          <FileText className="h-8 w-8 opacity-40" />
          <p className="text-sm">Sin documentos adjuntos</p>
        </div>
      ) : (
        <div className="rounded-[18px] border border-border bg-surface overflow-hidden divide-y divide-border">
          {documents.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 px-[18px] py-4">
              <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {doc.createdAt
                    ? format(new Date(doc.createdAt), "d 'de' MMMM yyyy", { locale: es })
                    : "—"}
                  {doc.uploaderName && ` · ${doc.uploaderName}`}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <a
                  href={doc.url}
                  download={doc.name}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-md hover:bg-surface-high transition-colors text-muted-foreground hover:text-on-bg"
                  title="Descargar"
                >
                  <Download className="h-4 w-4" />
                </a>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      className="p-1.5 rounded-md hover:bg-destructive/15 transition-colors text-muted-foreground hover:text-destructive"
                      title="Eliminar"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>¿Eliminar documento?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Se eliminará <strong>{doc.name}</strong> permanentemente. Esta acción no se puede deshacer.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate(doc.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
