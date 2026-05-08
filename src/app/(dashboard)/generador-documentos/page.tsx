import type { Metadata } from "next";
import { DocumentTemplatesList } from "./document-templates-list";

export const metadata: Metadata = {
  title: "Generador de documentos",
};

export default function GeneradorDocumentosPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <DocumentTemplatesList />
    </div>
  );
}
