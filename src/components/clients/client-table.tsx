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
  nombre: string;
  apellido: string;
  tipo: string;
  telefono: string | null;
  dni: string | null;
  email: string | null;
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
            <TableHead>Tipo</TableHead>
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
                  {client.nombre} {client.apellido}
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="capitalize">
                    {client.tipo}
                  </Badge>
                </TableCell>
                <TableCell>{client.dni || "-"}</TableCell>
                <TableCell>{client.telefono || "-"}</TableCell>
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

