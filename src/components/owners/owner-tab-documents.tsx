"use client";

import { useState, useRef } from "react";
import { FileText, Upload, X, Plus, FileImage, File } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface OwnerTabDocumentsProps {
  ownerId: string;
  ownerName: string;
}

interface DocumentoItem {
  id: string;
  nombre: string;
  tipo: string;
  fecha: string;
  size: string;
}

const TIPOS_DOCUMENTO = [
  "Documento de identidad",
  "Constancia AFIP",
  "Contrato de administración",
  "Escritura",
  "Formulario AFIP F.572",
  "Poder notarial",
  "Recibo de sueldo",
  "Otro",
];

const inputCls =
  "w-full bg-surface-mid border border-border rounded-[6px] text-on-surface text-[0.82rem] px-3 py-2 outline-none focus:border-primary transition-all placeholder:text-text-muted";
const labelCls =
  "text-[0.62rem] font-semibold uppercase tracking-[0.08em] text-text-muted mb-0.5 block";

function fileIcon(nombre: string) {
  const ext = nombre.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "webp"].includes(ext)) return <FileImage size={16} className="text-text-muted" />;
  if (ext === "pdf") return <FileText size={16} className="text-text-muted" />;
  return <File size={16} className="text-text-muted" />;
}

export function OwnerTabDocuments({
  ownerName,
}: OwnerTabDocumentsProps) {
  const [showModal, setShowModal] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    nombre: "",
    tipo: "",
    tipoCustom: "",
    vigenciaHasta: "",
    visiblePara: "staff" as "staff" | "propietario" | "ambos",
    notasInternas: "",
  });

  // Lista placeholder — en producción vendrá de la API
  const documentos: DocumentoItem[] = [];

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) acceptFile(file);
  };

  const acceptFile = (file: File) => {
    const maxMB = 20;
    if (file.size > maxMB * 1024 * 1024) {
      toast.error(`El archivo supera el máximo de ${maxMB} MB`);
      return;
    }
    setSelectedFile(file);
    if (!form.nombre) {
      setForm((f) => ({ ...f, nombre: file.name.replace(/\.[^.]+$/, "") }));
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) { toast.error("Seleccioná un archivo"); return; }
    if (!form.nombre.trim()) { toast.error("Completá el nombre del documento"); return; }
    const tipoFinal = form.tipo === "Otro" ? form.tipoCustom : form.tipo;
    if (!tipoFinal.trim()) { toast.error("Seleccioná el tipo de documento"); return; }

    setSaving(true);
    // TODO: implementar POST a /api/owners/:id/documentos con FormData
    await new Promise((r) => setTimeout(r, 800));
    toast.info("La carga de archivos estará disponible próximamente");
    setSaving(false);
    setShowModal(false);
    resetForm();
  };

  const resetForm = () => {
    setSelectedFile(null);
    setForm({ nombre: "", tipo: "", tipoCustom: "", vigenciaHasta: "", visiblePara: "staff", notasInternas: "" });
  };

  return (
    <div className="p-7 flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.1em] text-text-muted">
            Documentos · {ownerName}
          </p>
          <p className="text-[0.75rem] text-text-muted mt-0.5">
            {documentos.length === 0 ? "Sin documentos cargados" : `${documentos.length} archivos`}
          </p>
        </div>
        <Button size="sm" onClick={() => setShowModal(true)} className="gap-1.5 bg-primary text-primary-foreground hover:opacity-90">
          <Plus size={13} /> Subir documento
        </Button>
      </div>

      {/* Drop zone principal (cuando no hay docs) */}
      {documentos.length === 0 && (
        <div
          className={cn(
            "border-2 border-dashed rounded-[12px] py-14 flex flex-col items-center gap-3 cursor-pointer transition-all",
            dragging ? "border-primary bg-primary-dim" : "border-border hover:border-primary/50"
          )}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => { setShowModal(true); fileRef.current?.click(); }}
        >
          <div
            className="size-11 rounded-[10px] flex items-center justify-center"
            style={{ background: "var(--surface-mid)" }}
          >
            <Upload size={20} className="text-text-muted" />
          </div>
          <div className="text-center">
            <p className="text-[0.82rem] font-semibold text-on-surface">
              Arrastrá archivos o hacé clic para subir
            </p>
            <p className="text-[0.72rem] text-text-muted mt-0.5">
              PDF, Word, imágenes — máx. 20 MB
            </p>
          </div>
        </div>
      )}

      {/* Lista de documentos (cuando hay) */}
      {documentos.length > 0 && (
        <div className="bg-surface border border-border rounded-[10px] overflow-hidden">
          {documentos.map((doc, i) => (
            <div
              key={doc.id}
              className={cn("flex items-center gap-3 px-4 py-3 hover:bg-surface-mid transition-colors", i > 0 && "border-t border-border")}
            >
              <div className="size-8 rounded-[7px] bg-surface-mid flex items-center justify-center flex-shrink-0">
                {fileIcon(doc.nombre)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13.5px] font-medium text-on-surface truncate">{doc.nombre}</p>
                <p className="text-[11px] text-text-muted">{doc.tipo} · {doc.fecha}</p>
              </div>
              <span className="text-[11px] text-text-muted font-mono">{doc.size}</span>
              <button className="text-text-muted hover:text-on-surface transition-colors">
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal: Subir documento ── */}
      {showModal && (
        <div className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-[3px] flex items-center justify-center px-4">
          <div className="bg-surface border border-border rounded-[12px] w-full max-w-[540px] overflow-hidden">
            <div className="px-6 py-5 border-b border-border flex items-start justify-between">
              <div>
                <div className="font-semibold text-[15px] text-on-surface">Subir documento</div>
                <div className="text-[12px] text-text-muted mt-0.5">PDF, Word, imágenes · máx. 20 MB</div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => { setShowModal(false); resetForm(); }} className="size-8 text-text-muted">
                <X size={16} />
              </Button>
            </div>

            <div className="px-6 py-5 flex flex-col gap-4">
              {/* Drop zone en modal */}
              <div
                className={cn(
                  "border-2 border-dashed rounded-[10px] py-7 flex flex-col items-center gap-2 cursor-pointer transition-all",
                  dragging ? "border-primary bg-primary-dim" : "border-border hover:border-primary/50"
                )}
                onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={(e) => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) acceptFile(f); }}
                onClick={() => fileRef.current?.click()}
              >
                <input
                  ref={fileRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) acceptFile(f); }}
                />
                {selectedFile ? (
                  <div className="flex items-center gap-2.5">
                    {fileIcon(selectedFile.name)}
                    <div>
                      <p className="text-[13px] font-medium text-on-surface">{selectedFile.name}</p>
                      <p className="text-[11px] text-text-muted">{(selectedFile.size / 1024).toFixed(0)} KB</p>
                    </div>
                    <button
                      className="ml-2 text-text-muted hover:text-error transition-colors"
                      onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload size={18} className="text-text-muted" />
                    <p className="text-[0.78rem] text-text-muted">Arrastrá un archivo o hacé clic</p>
                  </>
                )}
              </div>

              {/* Tipo de documento */}
              <div>
                <label className={labelCls}>Tipo de documento <span className="text-error">*</span></label>
                <select
                  value={form.tipo}
                  onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
                  className={inputCls}
                >
                  <option value="">Seleccioná un tipo…</option>
                  {TIPOS_DOCUMENTO.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
                {form.tipo === "Otro" && (
                  <input
                    type="text"
                    value={form.tipoCustom}
                    onChange={(e) => setForm((f) => ({ ...f, tipoCustom: e.target.value }))}
                    placeholder="Nombre del tipo de documento…"
                    className={cn(inputCls, "mt-2")}
                  />
                )}
              </div>

              {/* Nombre */}
              <div>
                <label className={labelCls}>Nombre del documento <span className="text-error">*</span></label>
                <input
                  type="text"
                  value={form.nombre}
                  onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                  placeholder="Ej: DNI Frente y Dorso"
                  className={inputCls}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Vigencia */}
                <div>
                  <label className={labelCls}>Vigencia hasta (opcional)</label>
                  <input
                    type="date"
                    value={form.vigenciaHasta}
                    onChange={(e) => setForm((f) => ({ ...f, vigenciaHasta: e.target.value }))}
                    className={inputCls}
                  />
                </div>
                {/* Visible para */}
                <div>
                  <label className={labelCls}>Visible para</label>
                  <select
                    value={form.visiblePara}
                    onChange={(e) => setForm((f) => ({ ...f, visiblePara: e.target.value as typeof form.visiblePara }))}
                    className={inputCls}
                  >
                    <option value="staff">Solo staff</option>
                    <option value="propietario">Owner</option>
                    <option value="ambos">Staff y propietario</option>
                  </select>
                </div>
              </div>

              {/* Notas internas */}
              <div>
                <label className={labelCls}>Notas internas (opcional)</label>
                <input
                  type="text"
                  value={form.notasInternas}
                  onChange={(e) => setForm((f) => ({ ...f, notasInternas: e.target.value }))}
                  placeholder="Observaciones para el staff…"
                  className={inputCls}
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-border flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => { setShowModal(false); resetForm(); }} disabled={saving}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleUpload} disabled={saving} className="bg-primary text-primary-foreground hover:opacity-90">
                {saving ? "Subiendo…" : "Subir documento"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
