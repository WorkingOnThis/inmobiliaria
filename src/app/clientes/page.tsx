"use client";

import { useEffect, useState, Suspense } from "react";
import { DashboardLayout } from "@/components/dashboard-layout";
import { ClientTable } from "@/components/clients/client-table";
import { ClientPagination } from "@/components/clients/client-pagination";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";

function ClientsContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const success = searchParams.get("success");
  let successMessage = null;
  if (success === "client_created") {
    successMessage = "Cliente creado exitosamente";
  }
  
  const page = parseInt(searchParams.get("page") || "1");
  const limit = 10;
  
  const [clients, setClients] = useState([]);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchClients = async (pageNumber: number) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/clients?page=${pageNumber}&limit=${limit}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Error al obtener los clientes");
      }
      const data = await response.json();
      setClients(data.clients);
      setPagination(data.pagination);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "No se pudieron cargar los clientes. Por favor intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchClients(page);
  }, [page]);

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`/clientes?${params.toString()}`);
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      {successMessage && (
        <div className="rounded-md bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-3">
          <p className="text-sm text-green-800 dark:text-green-200">{successMessage}</p>
        </div>
      )}
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
          <p className="text-destructive mb-4">{error}</p>
          <Button 
            variant="outline" 
            onClick={() => fetchClients(page)}
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
          <ClientTable clients={clients} />
          <ClientPagination
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
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

