import { NewDocumentTemplateForm } from "./new-document-template-form";

export default function NuevaPlantillaPage() {
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">Nueva plantilla</h1>
        <p className="text-muted-foreground text-sm">
          Asigná un nombre para crear la plantilla. Podrás editar el contenido
          en el editor.
        </p>
      </div>
      <NewDocumentTemplateForm />
    </div>
  );
}
