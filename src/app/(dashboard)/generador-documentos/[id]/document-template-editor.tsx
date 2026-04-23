"use client";

import { useState, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Printer,
} from "lucide-react";
import { toast } from "sonner";
import { VARIABLES_CATALOG } from "@/lib/document-templates/variables-catalog";

// ─── Types ────────────────────────────────────────────────────────────────────

type DocumentTemplate = {
  id: string;
  name: string;
  body: string;
  createdAt: string;
  updatedAt: string;
};

type ContractListItem = {
  id: string;
  contractNumber: string;
  propertyAddress: string;
  tenantName?: string;
};

// ─── Variable path regex ──────────────────────────────────────────────────────

const VAR_RE = /\[\[([^\]]+)\]\]/g;

// ─── Preview renderer ─────────────────────────────────────────────────────────

function renderPreview(
  body: string,
  resolved: Record<string, string | null>
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  VAR_RE.lastIndex = 0;

  while ((match = VAR_RE.exec(body)) !== null) {
    if (match.index > last) {
      parts.push(
        <span key={`t-${last}`}>{body.slice(last, match.index)}</span>
      );
    }
    const path = match[1].trim();
    const value = resolved[path];
    if (value !== null && value !== undefined) {
      parts.push(<span key={`v-${match.index}`}>{value}</span>);
    } else {
      parts.push(
        <span
          key={`m-${match.index}`}
          className="text-destructive font-bold"
        >
          {match[0]}
        </span>
      );
    }
    last = match.index + match[0].length;
  }

  if (last < body.length) {
    parts.push(<span key={`t-end`}>{body.slice(last)}</span>);
  }

  return parts;
}

// ─── Main component ───────────────────────────────────────────────────────────

export function DocumentTemplateEditor({
  templateId,
}: {
  templateId: string;
}) {
  // localEdits stores only what the user has changed; falls back to server data
  const [localEdits, setLocalEdits] = useState<{
    name?: string;
    body?: string;
  }>({});
  const [saveStatus, setSaveStatus] = useState<"saved" | "saving" | "idle">(
    "idle"
  );
  const [selectedContractId, setSelectedContractId] = useState<string>("");
  const [varListOpen, setVarListOpen] = useState(false);
  const [copiedPath, setCopiedPath] = useState<string | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Fetch template ────────────────────────────────────────────────────────

  const { data: templateData, isLoading: templateLoading } = useQuery<{
    template: DocumentTemplate;
  }>({
    queryKey: ["document-template", templateId],
    queryFn: () =>
      fetch(`/api/document-templates/${templateId}`).then((r) => r.json()),
  });

  // Derive display values: local edits take precedence over server data
  const name = localEdits.name ?? templateData?.template.name ?? "";
  const body = localEdits.body ?? templateData?.template.body ?? "";

  // ── Fetch contracts list ──────────────────────────────────────────────────

  const { data: contractsData } = useQuery<{ contracts: ContractListItem[] }>({
    queryKey: ["contracts-for-preview"],
    queryFn: () =>
      fetch("/api/contracts?limit=50").then(async (r) => {
        const json = await r.json();
        // Map to our simpler shape
        const contracts: ContractListItem[] = (json.contracts ?? []).map(
          (c: {
            id: string;
            contractNumber: string;
            propertyAddress?: string;
            tenants?: { name: string }[];
          }) => ({
            id: c.id,
            contractNumber: c.contractNumber,
            propertyAddress: c.propertyAddress ?? "",
            tenantName: c.tenants?.[0]?.name ?? "",
          })
        );
        return { contracts };
      }),
  });

  // ── Fetch resolved variables ──────────────────────────────────────────────

  const { data: resolvedData } = useQuery<{
    resolved: Record<string, string | null>;
  }>({
    queryKey: ["document-template-resolve", selectedContractId],
    queryFn: () =>
      fetch(
        `/api/document-templates/resolve?contractId=${selectedContractId}`
      ).then((r) => r.json()),
    enabled: !!selectedContractId,
  });

  const resolved = resolvedData?.resolved ?? {};
  const contracts = contractsData?.contracts ?? [];

  // ── Autosave ──────────────────────────────────────────────────────────────

  const save = useCallback(
    async (newName: string, newBody: string) => {
      setSaveStatus("saving");
      try {
        await fetch(`/api/document-templates/${templateId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: newName, body: newBody }),
        });
        setSaveStatus("saved");
      } catch {
        setSaveStatus("idle");
        toast.error("Error al guardar");
      }
    },
    [templateId]
  );

  function scheduleSave(newName: string, newBody: string) {
    setSaveStatus("saving");
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => save(newName, newBody), 1000);
  }

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setLocalEdits((prev) => ({ ...prev, name: val }));
    scheduleSave(val, body);
  }

  function handleBodyChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setLocalEdits((prev) => ({ ...prev, body: val }));
    scheduleSave(name, val);
  }

  // ── Copy variable path ────────────────────────────────────────────────────

  async function copyPath(path: string) {
    await navigator.clipboard.writeText(`[[${path}]]`);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 1500);
  }

  // ── Print ─────────────────────────────────────────────────────────────────

  function handlePrint() {
    window.print();
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (templateLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-96 w-full" />
      </div>
    );
  }

  return (
    <>
      {/* Print styles — ocultan todo salvo #print-preview */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #print-preview { display: block !important; }
          #print-preview {
            position: fixed;
            top: 0; left: 0;
            width: 100%;
            font-family: serif;
            font-size: 12pt;
            color: #000;
            background: #fff;
            padding: 2cm;
          }
        }
      `}</style>

      <div className="flex flex-col gap-3">
        {/* Header row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {saveStatus === "saving" && <span>Guardando...</span>}
            {saveStatus === "saved" && <span>Guardado</span>}
          </div>
        </div>

        {/* Two-column grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* ── Columna izquierda — editor ─────────────────────────────── */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="template-name">Nombre</Label>
              <Input
                id="template-name"
                value={name}
                onChange={handleNameChange}
                maxLength={200}
                placeholder="Nombre de la plantilla"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="template-body">Contenido</Label>
              <Textarea
                id="template-body"
                value={body}
                onChange={handleBodyChange}
                placeholder={`Escribí el texto de la plantilla. Usá [[variable.path]] para insertar datos del contrato.\n\nEj: En la ciudad de [[propiedad.barrio]], a [[contrato.fecha_inicio]], entre [[propietario.nombre_completo]] (propietario) y [[inquilino.nombre_completo]] (inquilino)...`}
                className="min-h-[400px] resize-y font-mono text-sm"
              />
            </div>

            {/* Variables collapsible */}
            <Collapsible open={varListOpen} onOpenChange={setVarListOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1 px-2 -ml-2">
                  {varListOpen ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                  Variables disponibles ({VARIABLES_CATALOG.length})
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-2 rounded-md border divide-y text-sm">
                  {VARIABLES_CATALOG.map((v) => (
                    <button
                      key={v.path}
                      type="button"
                      onClick={() => copyPath(v.path)}
                      className="flex items-center justify-between w-full px-3 py-2 hover:bg-muted/50 text-left gap-3"
                    >
                      <div>
                        <code className="text-xs text-primary">
                          [[{v.path}]]
                        </code>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {v.label}
                        </p>
                      </div>
                      {copiedPath === v.path ? (
                        <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
                      ) : (
                        <Copy className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          {/* ── Columna derecha — preview ──────────────────────────────── */}
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Label className="mb-1.5 block">Previsualizar con contrato</Label>
                <Select
                  value={selectedContractId}
                  onValueChange={setSelectedContractId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccioná un contrato..." />
                  </SelectTrigger>
                  <SelectContent>
                    {contracts.length === 0 && (
                      <SelectItem value="__none__" disabled>
                        No hay contratos
                      </SelectItem>
                    )}
                    {contracts.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.contractNumber} — {c.propertyAddress}
                        {c.tenantName ? ` · ${c.tenantName}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="mt-5 shrink-0"
                disabled={!selectedContractId}
              >
                <Printer className="h-4 w-4 mr-1.5" />
                Imprimir
              </Button>
            </div>

            <Separator />

            {/* Preview area */}
            <div
              id="print-preview"
              className="rounded-md border bg-card p-6 min-h-[400px] text-sm leading-relaxed whitespace-pre-wrap font-serif"
            >
              {!selectedContractId ? (
                <p className="text-muted-foreground text-center py-12 text-sm font-sans">
                  Seleccioná un contrato para previsualizar
                </p>
              ) : body.trim() === "" ? (
                <p className="text-muted-foreground text-center py-12 text-sm font-sans">
                  El cuerpo de la plantilla está vacío
                </p>
              ) : (
                renderPreview(body, resolved)
              )}
            </div>

            {selectedContractId && (
              <p className="text-xs text-muted-foreground">
                Las variables en{" "}
                <span className="text-destructive font-bold">rojo</span> no
                tienen datos en el contrato seleccionado.
              </p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
