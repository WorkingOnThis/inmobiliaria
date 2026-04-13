"use client";

import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PlusCircle, Loader2, Users, UserCheck, AlertCircle } from "lucide-react";
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

export function InquilinosList() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const page = parseInt(searchParams.get("page") || "1");
  const limit = 10;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["clients", "inquilino", page],
    queryFn: async () => {
      const response = await fetch(
        `/api/clients?type=inquilino&page=${page}&limit=${limit}`
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Error al obtener los inquilinos");
      }
      return response.json();
    },
  });

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`/inquilinos?${params.toString()}`);
  };

  const total = data?.pagination?.total ?? 0;

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inquilinos</h1>
          <p className="text-muted-foreground">
            Personas con contrato de alquiler activo o histórico.
          </p>
        </div>
        <Button asChild>
          <Link href="/inquilinos/nuevo">
            <PlusCircle className="mr-2 h-4 w-4" />
            Nuevo Inquilino
          </Link>
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-lg border p-4 flex items-center gap-3">
          <Users className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="text-sm text-muted-foreground">Total registrados</p>
            <p className="text-2xl font-bold">{isLoading ? "—" : total}</p>
          </div>
        </div>
        <div className="rounded-lg border p-4 flex items-center gap-3">
          <UserCheck className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="text-sm text-muted-foreground">Activos</p>
            <p className="text-2xl font-bold text-muted-foreground">—</p>
          </div>
        </div>
        <div className="rounded-lg border p-4 flex items-center gap-3">
          <AlertCircle className="h-8 w-8 text-muted-foreground" />
          <div>
            <p className="text-sm text-muted-foreground">En mora</p>
            <p className="text-2xl font-bold text-muted-foreground">—</p>
          </div>
        </div>
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
                  <TableHead>Email</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Registrado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.clients?.length > 0 ? (
                  data.clients.map(
                    (i: {
                      id: string;
                      firstName: string;
                      lastName: string | null;
                      dni: string | null;
                      email: string | null;
                      phone: string | null;
                      createdAt: string;
                    }) => (
                      <TableRow key={i.id}>
                        <TableCell className="font-medium">
                          {i.firstName} {i.lastName}
                        </TableCell>
                        <TableCell>{i.dni || "-"}</TableCell>
                        <TableCell>{i.email || "-"}</TableCell>
                        <TableCell>{i.phone || "-"}</TableCell>
                        <TableCell>
                          {format(new Date(i.createdAt), "dd/MM/yyyy", {
                            locale: es,
                          })}
                        </TableCell>
                      </TableRow>
                    )
                  )
                ) : (
                  <TableRow>
                    <TableCell colSpan={5} className="h-24 text-center">
                      No hay inquilinos registrados.
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
