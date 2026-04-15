"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  PlusCircle,
  Loader2,
  FileText,
  AlertCircle,
  Clock,
  XCircle,
  Search,
} from "lucide-react";
import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge, type StatusBadgeVariant } from "@/components/ui/status-badge";
import { ClientPagination } from "@/components/clients/client-pagination";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CONTRACT_STATUS_LABELS, type ContractStatus } from "@/lib/clients/constants";

const STATUS_FILTERS = [
  { value: "", label: "Todos" },
  { value: "active", label: "Vigentes" },
  { value: "expiring_soon", label: "Por vencer" },
  { value: "draft", label: "Borrador" },
  { value: "terminated", label: "Rescindidos" },
];

function statusBadgeVariant(status: string): StatusBadgeVariant {
  switch (status) {
    case "active":
      return "active";
    case "expiring_soon":
      return "expiring";
    case "draft":
      return "draft";
    case "terminated":
    case "expired":
      return "baja";
    default:
      return "draft";
  }
}

export function ContratosList() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const page = parseInt(searchParams.get("page") || "1");
  const limit = 10;
  const [statusFilter, setStatusFilter] = useState(
    searchParams.get("status") || ""
  );
  const [searchInput, setSearchInput] = useState(searchParams.get("q") || "");
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "");

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["contracts", page, statusFilter, searchQuery],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      if (statusFilter) params.set("status", statusFilter);
      if (searchQuery) params.set("q", searchQuery);
      const response = await fetch(`/api/contracts?${params.toString()}`);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Error al obtener los contratos");
      }
      return response.json();
    },
  });

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`/contratos?${params.toString()}`);
  };

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1");
    if (status) {
      params.set("status", status);
    } else {
      params.delete("status");
    }
    router.push(`/contratos?${params.toString()}`);
  };

  const handleSearch = (value: string) => {
    setSearchQuery(value);
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", "1");
    if (value) {
      params.set("q", value);
    } else {
      params.delete("q");
    }
    router.push(`/contratos?${params.toString()}`);
  };

  const counts = data?.counts ?? {};

  return (
    <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Contratos</h1>
          <p className="text-muted-foreground">
            Contratos de alquiler activos e históricos.
          </p>
        </div>
        <Button asChild>
          <Link href="/contratos/nuevo">
            <PlusCircle className="mr-2 h-4 w-4" />
            Nuevo Contrato
          </Link>
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-lg border p-4 flex items-center gap-3">
          <FileText className="h-7 w-7 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Vigentes</p>
            <p className="text-2xl font-bold">
              {isLoading ? "—" : counts.active ?? 0}
            </p>
          </div>
        </div>
        <div className="rounded-lg border p-4 flex items-center gap-3">
          <Clock className="h-7 w-7 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Por vencer</p>
            <p className="text-2xl font-bold">
              {isLoading ? "—" : counts.expiring_soon ?? 0}
            </p>
          </div>
        </div>
        <div className="rounded-lg border p-4 flex items-center gap-3">
          <AlertCircle className="h-7 w-7 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Borrador</p>
            <p className="text-2xl font-bold">
              {isLoading ? "—" : counts.draft ?? 0}
            </p>
          </div>
        </div>
        <div className="rounded-lg border p-4 flex items-center gap-3">
          <XCircle className="h-7 w-7 text-muted-foreground" />
          <div>
            <p className="text-xs text-muted-foreground">Rescindidos</p>
            <p className="text-2xl font-bold">
              {isLoading ? "—" : counts.terminated ?? 0}
            </p>
          </div>
        </div>
      </div>

      {/* Buscador */}
      <div className="flex items-center gap-2 rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm focus-within:ring-1 focus-within:ring-ring">
        <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSearch(searchInput);
            if (e.key === "Escape") {
              setSearchInput("");
              handleSearch("");
            }
          }}
          placeholder="Buscar por N° contrato, propiedad, inquilino, propietario..."
          className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
        />
        {searchInput && (
          <button
            type="button"
            onClick={() => {
              setSearchInput("");
              handleSearch("");
            }}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <XCircle className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => handleStatusFilter(f.value)}
            className={`px-3 py-1 rounded-full text-sm border transition-colors ${
              statusFilter === f.value
                ? "bg-primary text-primary-foreground border-primary/30"
                : "border-border text-text-muted hover:text-text-secondary hover:bg-surface-mid"
            }`}
          >
            {f.label}
          </button>
        ))}
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
                  <TableHead>N° Contrato</TableHead>
                  <TableHead>Propiedad</TableHead>
                  <TableHead>Inquilino</TableHead>
                  <TableHead>Propietario</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.contracts?.length > 0 ? (
                  data.contracts.map(
                    (c: {
                      id: string;
                      contractNumber: string;
                      propertyAddress: string | null;
                      tenantNames: string[];
                      ownerName: string;
                      startDate: string;
                      endDate: string;
                      status: string;
                    }) => (
                      <TableRow
                        key={c.id}
                        className="cursor-pointer"
                        onClick={() => router.push(`/contratos/${c.id}`)}
                      >
                        <TableCell className="font-mono font-medium">
                          {c.contractNumber}
                        </TableCell>
                        <TableCell>
                          {c.propertyAddress || <span className="field-value empty"></span>}
                        </TableCell>
                        <TableCell>
                          {c.tenantNames?.length > 0
                            ? c.tenantNames.join(", ")
                            : <span className="field-value empty"></span>}
                        </TableCell>
                        <TableCell>{c.ownerName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {format(new Date(c.startDate), "dd/MM/yy", {
                            locale: es,
                          })}{" "}
                          →{" "}
                          {format(new Date(c.endDate), "dd/MM/yy", {
                            locale: es,
                          })}
                        </TableCell>
                        <TableCell>
                          <StatusBadge variant={statusBadgeVariant(c.status)}>
                            {CONTRACT_STATUS_LABELS[c.status as ContractStatus] ||
                              c.status}
                          </StatusBadge>
                        </TableCell>
                      </TableRow>
                    )
                  )
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      No hay contratos registrados.
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
