import { DocumentTemplateEditor } from "./document-template-editor";

export default async function EditorPlantillaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0 h-full">
      <DocumentTemplateEditor templateId={id} />
    </div>
  );
}
