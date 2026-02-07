"use client";

import { Suspense } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { ClientTable } from "@/components/clients/client-table";
import { ClientPagination } from "@/components/clients/client-pagination";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

function ClientsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const page = parseInt(searchParams.get("page") || "1");
  const limit = 10;
  
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["clients", page, limit],
    queryFn: async () => {
      const response = await fetch(`/api/clients?page=${page}&limit=${limit}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Error al obtener los clientes");
      }
      return response.json();
    },
  });

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`/clientes?${params.toString()}`);
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-muted-foreground">
            Gestiona los clientes de tu inmobiliaria.
          </p>
        </div>
        <Button asChild>
          <Link href="/clientes/nuevo">
            <PlusCircle className="mr-2 h-4 w-4" />
            Nuevo Cliente
          </Link>
        </Button>
      </div>

      {error ? (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 text-center">
          <p className="text-destructive mb-4">{(error as Error).message}</p>
          <Button 
            variant="outline" 
            onClick={() => refetch()}
          >
            Reintentar
          </Button>
        </div>
      ) : isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <ClientTable clients={data.clients} />
          <ClientPagination
            currentPage={data.pagination.page}
            totalPages={data.pagination.totalPages}
            onPageChange={handlePageChange}
          />
        </>
      )}
    </div>
  );
}

export default function ClientsPage() {
  return (
    <DashboardLayout>
      <Suspense fallback={
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }>
        <ClientsContent />
      </Suspense>
    </DashboardLayout>
  );
}

