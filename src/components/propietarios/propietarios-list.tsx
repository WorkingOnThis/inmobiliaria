"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2 } from "lucide-react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ClientPagination } from "@/components/clients/client-pagination";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export function PropietariosList() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const page = parseInt(searchParams.get("page") || "1");
  const limit = 10;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["clients", "propietario", page],
    queryFn: async () => {
      const response = await fetch(
        `/api/clients?type=propietario&page=${page}&limit=${limit}`
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Error al obtener los propietarios");
      }
      return response.json();
    },
  });

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`/propietarios?${params.toString()}`);
  };

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Propietarios</h1>
          <p className="text-muted-foreground">
            Dueños de las propiedades administradas.
          </p>
        </div>
        <Button asChild>
          <Link href="/propietarios/nuevo">
            <PlusCircle className="mr-2 h-4 w-4" />
            Nuevo Propietario
          </Link>
        </Button>
      </div>

      {error ? (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 text-center">
          <p className="text-destructive mb-4">{(error as Error).message}</p>
          <Button variant="outline" onClick={() => refetch()}>
            Reintentar
          </Button>
        </div>
      ) : isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>DNI</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>CBU</TableHead>
                  <TableHead>Registrado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.clients?.length > 0 ? (
                  data.clients.map(
                    (p: {
                      id: string;
                      firstName: string;
                      lastName: string | null;
                      dni: string | null;
                      phone: string | null;
                      email: string | null;
                      cbu: string | null;
                      createdAt: string;
                    }) => (
                      <TableRow key={p.id}>
                        <TableCell className="font-medium">
                          {p.firstName} {p.lastName}
                        </TableCell>
                        <TableCell>{p.dni || "-"}</TableCell>
                        <TableCell>{p.phone || "-"}</TableCell>
                        <TableCell>{p.email || "-"}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {p.cbu || "-"}
                        </TableCell>
                        <TableCell>
                          {format(new Date(p.createdAt), "dd/MM/yyyy", {
                            locale: es,
                          })}
                        </TableCell>
                      </TableRow>
                    )
                  )
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      No hay propietarios registrados.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {data?.pagination && (
            <ClientPagination
              currentPage={data.pagination.page}
              totalPages={data.pagination.totalPages}
              onPageChange={handlePageChange}
            />
          )}
        </>
      )}
    </div>
  );
}
