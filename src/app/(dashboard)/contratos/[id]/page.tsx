import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { ContractDetail } from "@/components/contracts/contract-detail";

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ContractDetail id={id} />
    </Suspense>
  );
}
