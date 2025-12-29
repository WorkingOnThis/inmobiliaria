"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface Client {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  dni: string | null;
  role: string | null;
  createdAt: string;
}

interface ClientTableProps {
  clients: Client[];
}

export function ClientTable({ clients }: ClientTableProps) {
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nombre</TableHead>
            <TableHead>Rol / Tipo</TableHead>
            <TableHead>DNI</TableHead>
            <TableHead>Teléfono</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Creado</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {clients.length > 0 ? (
            clients.map((client) => (
              <TableRow key={client.id}>
                <TableCell className="font-medium">
                  {client.firstName} {client.lastName}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {client.role || "visitor"}
                  </Badge>
                </TableCell>
                <TableCell>{client.dni || "-"}</TableCell>
                <TableCell>{client.phone || "-"}</TableCell>
                <TableCell>{client.email || "-"}</TableCell>
                <TableCell>
                  {format(new Date(client.createdAt), "dd/MM/yyyy", { locale: es })}
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="h-24 text-center">
                No se encontraron clientes.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
