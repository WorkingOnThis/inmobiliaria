"use client";

import { FileText, Upload, Scroll, FolderOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface PropietarioTabDocumentosProps {
  propietarioId: string;
  propietarioName: string;
}

interface DocumentCategoryProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function DocumentCategory({ icon, title, description }: DocumentCategoryProps) {
  return (
    <div className="bg-[#191c1e] border border-white/[0.07] rounded-[18px] p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="size-8 rounded-[8px] bg-[#222527] flex items-center justify-center text-[#6b6d70]">
            {icon}
          </div>
          <div>
            <p className="text-[0.8rem] font-semibold text-[#e1e2e4]">{title}</p>
            <p className="text-[0.68rem] text-[#6b6d70]">{description}</p>
          </div>
        </div>
        <Button variant="secondary" size="sm" disabled>
          <Upload size={11} />
          Subir
        </Button>
      </div>

      {/* Drop zone */}
      <div className="opacity-60 cursor-not-allowed">
        <div className="border-2 border-dashed border-white/[0.07] rounded-[12px] py-8 flex flex-col items-center gap-3">
          <Upload size={22} className="text-[#333537]" />
          <div className="text-center">
            <p className="text-[0.75rem] text-[#6b6d70]">
              Arrastrá archivos o hacé clic para subir
            </p>
            <p className="text-[0.65rem] text-[#6b6d70] mt-0.5">
              PDF, JPG, PNG — máx. 10 MB
            </p>
          </div>
        </div>
      </div>

      {/* Próximamente badge */}
      <div className="mt-3 flex justify-center">
        <Badge variant="secondary">Próximamente</Badge>
      </div>
    </div>
  );
}

export function PropietarioTabDocumentos({
  propietarioName,
}: PropietarioTabDocumentosProps) {
  return (
    <div className="p-7 flex flex-col gap-5">
      {/* Header */}
      <div>
        <p className="text-[0.72rem] font-bold uppercase tracking-[0.1em] text-[#6b6d70]">
          Documentos de {propietarioName}
        </p>
        <p className="text-[0.75rem] text-[#6b6d70] mt-1">
          La gestión de archivos estará disponible próximamente.
        </p>
      </div>

      {/* Category cards */}
      <DocumentCategory
        icon={<FileText size={15} />}
        title="Documentación personal"
        description="DNI, CUIT, constancia AFIP"
      />
      <DocumentCategory
        icon={<Scroll size={15} />}
        title="Contratos de administración"
        description="Contratos firmados con el propietario"
      />
      <DocumentCategory
        icon={<FolderOpen size={15} />}
        title="Otros documentos"
        description="Poderes, escrituras, documentación adicional"
      />
    </div>
  );
}
