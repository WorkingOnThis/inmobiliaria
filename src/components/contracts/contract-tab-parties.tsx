"use client";

import { useState } from "react";
import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserPlus, X, Search, ExternalLink } from "lucide-react";
import Link from "next/link";
import { CreateOwnerPopup } from "@/components/properties/create-owner-popup";
import { AddGuaranteeModal } from "@/components/guarantees/add-guarantee-modal";
import type { ContractParticipant, ContractGuarantee } from "./contract-detail";

const ROLE_LABELS: Record<string, string> = {
  owner: "Propietario",
  tenant: "Inquilino",
  guarantor: "Garante",
};

function getInitials(firstName: string, lastName: string | null): string {
  const parts = [firstName, lastName].filter(Boolean) as string[];
  return parts
    .slice(0, 2)
    .map((n) => n[0]?.toUpperCase() ?? "")
    .join("");
}

function FieldRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[0.67rem] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {label}
      </span>
      {value ? (
        <span className="field-value text-[0.85rem]">{value}</span>
      ) : (
        <span className="field-value empty text-[0.85rem]" />
      )}
    </div>
  );
}

function PersonCard({
  role,
  firstName,
  lastName,
  dni,
  cuit,
  address,
  phone,
  email,
  clientId,
  onRemove,
  removable,
}: {
  role: string;
  firstName: string;
  lastName: string | null;
  dni: string | null;
  cuit: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  clientId: string;
  onRemove?: () => void;
  removable?: boolean;
}) {
  const fullName = `${firstName} ${lastName || ""}`.trim();
  const initials = getInitials(firstName, lastName);
  const profileLink =
    role === "owner"    ? `/propietarios/${clientId}`
    : role === "tenant" ? `/inquilinos/${clientId}`
    : role === "guarantor" ? `/garantes/${clientId}`
    : null;

  return (
    <div className="rounded-[18px] border border-border bg-surface overflow-hidden">
      <div className="flex items-center gap-3 px-[18px] py-4 border-b border-border">
        <div
          className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold flex-shrink-0"
          style={{
            background: "var(--primary-dark)",
            fontFamily: "var(--font-brand)",
            color: "var(--primary-foreground)",
          }}
        >
          {initials}
        </div>
        <div className="flex-1 min-w-0">
          <p
            className="font-bold text-on-bg text-[0.95rem] leading-tight truncate"
            style={{ fontFamily: "var(--font-headline)" }}
          >
            {fullName}
          </p>
          <Badge variant="secondary" className="mt-1 text-[0.65rem] px-2 py-0.5 h-auto rounded-full">
            {ROLE_LABELS[role] ?? role}
          </Badge>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0">
          {profileLink && (
            <Link
              href={profileLink}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[0.72rem] text-primary hover:underline"
            >
              Ver ficha <ExternalLink className="h-3 w-3" />
            </Link>
          )}
          {removable && onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="ml-2 p-1 rounded-md hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
              title="Quitar"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-[18px] py-4">
        <FieldRow label="DNI" value={dni} />
        <FieldRow label="CUIT" value={cuit} />
        <FieldRow label="Domicilio" value={address} />
        <FieldRow label="Teléfono" value={phone} />
        <FieldRow label="Email" value={email} />
      </div>
    </div>
  );
}

interface Props {
  contractId: string;
  owner: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    dni: string | null;
    cuit: string | null;
    address: string | null;
  } | null;
  participants: ContractParticipant[];
  guarantees: ContractGuarantee[];
}

export function ContractTabParties({ contractId, owner, participants, guarantees }: Props) {
  const queryClient = useQueryClient();
  const [clientSearch, setClientSearch] = useState("");
  const [clientSearchOpen, setClientSearchOpen] = useState(false);
  const [addingRole, setAddingRole] = useState<"owner" | "tenant" | null>(null);
  const [showCreatePopup, setShowCreatePopup] = useState(false);
  const [addGuaranteeOpen, setAddGuaranteeOpen] = useState(false);

  const tenantParticipant = participants.find((p) => p.role === "tenant");

  const { data: searchResults } = useQuery({
    queryKey: ["clients", "search", clientSearch],
    queryFn: async () => {
      if (clientSearch.length < 2) return { clients: [] };
      const res = await fetch(
        `/api/clients?search=${encodeURIComponent(clientSearch)}&limit=20`
      );
      if (!res.ok) throw new Error("Error buscando clientes");
      return res.json();
    },
    enabled: clientSearchOpen && clientSearch.length >= 2,
  });
  const clientOptions: Array<{ id: string; firstName: string; lastName: string | null }> =
    searchResults?.clients ?? [];

  const addParticipantMutation = useMutation({
    mutationFn: async ({ clientId, role }: { clientId: string; role: string }) => {
      const res = await fetch(`/api/contracts/${contractId}/participants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId, role }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error al agregar participante");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract", contractId] });
      setClientSearchOpen(false);
      setClientSearch("");
      setAddingRole(null);
      toast.success("Participante agregado");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeParticipantMutation = useMutation({
    mutationFn: async (participantId: string) => {
      const res = await fetch(
        `/api/contracts/${contractId}/participants/${participantId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error al eliminar participante");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract", contractId] });
      toast.success("Participante eliminado");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const removeGuaranteeMutation = useMutation({
    mutationFn: async (guaranteeId: string) => {
      const res = await fetch(
        `/api/contracts/${contractId}/guarantees/${guaranteeId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Error al eliminar garantía");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contract", contractId] });
      toast.success("Garantía eliminada");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openSearch = (role: "owner" | "tenant") => {
    setAddingRole(role);
    setClientSearch("");
    setClientSearchOpen(true);
  };

  const handleSelectClient = (c: { id: string; firstName: string; lastName: string | null }) => {
    if (!addingRole) return;
    addParticipantMutation.mutate({ clientId: c.id, role: addingRole });
  };

  return (
    <>
      {showCreatePopup && (
        <CreateOwnerPopup
          isOpen={showCreatePopup}
          onClose={() => setShowCreatePopup(false)}
          defaultType={addingRole === "owner" ? "owner" : "tenant"}
          onCreated={(created) => {
            if (!addingRole) return;
            addParticipantMutation.mutate({
              clientId: created.id,
              role: addingRole,
            });
            setShowCreatePopup(false);
          }}
        />
      )}

      <div className="flex flex-col gap-6 pt-5">
        {/* Propietario */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[0.72rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Propietario / Locador
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => openSearch("owner")}
              className="flex items-center gap-1.5 h-7 text-[0.72rem]"
            >
              <UserPlus className="h-3 w-3" />
              + Agregar propietario
            </Button>
          </div>

          {participants.filter((p) => p.role === "owner").length === 0 ? (
            <div className="rounded-[18px] border border-dashed border-border bg-surface px-[18px] py-6 text-center text-sm text-muted-foreground">
              Sin propietarios asignados
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {participants
                .filter((p) => p.role === "owner")
                .map((p) => (
                  <PersonCard
                    key={p.id}
                    role="owner"
                    firstName={p.client.firstName}
                    lastName={p.client.lastName}
                    dni={p.client.dni}
                    cuit={p.client.cuit}
                    address={p.client.address}
                    phone={p.client.phone}
                    email={p.client.email}
                    clientId={p.client.id}
                    removable
                    onRemove={() => removeParticipantMutation.mutate(p.id)}
                  />
                ))}
            </div>
          )}
        </section>

        {/* Inquilino */}
        <section>
          <h3 className="text-[0.72rem] font-bold uppercase tracking-[0.1em] text-muted-foreground mb-3">
            Inquilino
          </h3>
          {tenantParticipant ? (
            <PersonCard
              role="tenant"
              firstName={tenantParticipant.client.firstName}
              lastName={tenantParticipant.client.lastName}
              dni={tenantParticipant.client.dni}
              cuit={tenantParticipant.client.cuit}
              address={tenantParticipant.client.address}
              phone={tenantParticipant.client.phone}
              email={tenantParticipant.client.email}
              clientId={tenantParticipant.client.id}
              removable
              onRemove={() => removeParticipantMutation.mutate(tenantParticipant.id)}
            />
          ) : (
            <div className="rounded-[18px] border border-dashed border-border bg-surface px-[18px] py-6 flex flex-col items-center gap-3">
              <p className="text-sm text-muted-foreground">Sin inquilino asignado</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => openSearch("tenant")}
                className="flex items-center gap-1.5"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Asignar inquilino
              </Button>
            </div>
          )}
        </section>

        {/* Garantes */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-[0.72rem] font-bold uppercase tracking-[0.1em] text-muted-foreground">
              Garantes
            </h3>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!tenantParticipant) {
                  toast.error("Asigná un inquilino primero para agregar garantías");
                  return;
                }
                setAddGuaranteeOpen(true);
              }}
              className="flex items-center gap-1.5 h-7 text-[0.72rem]"
            >
              <UserPlus className="h-3 w-3" />
              + Agregar garantía
            </Button>
          </div>

          {guarantees.length === 0 ? (
            <div className="rounded-[18px] border border-dashed border-border bg-surface px-[18px] py-6 text-center text-sm text-muted-foreground">
              Sin garantes registrados
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {guarantees.map((g) => {
                if (g.guarantor) {
                  return (
                    <PersonCard
                      key={g.id}
                      role="guarantor"
                      firstName={g.guarantor.firstName ?? "Garante"}
                      lastName={g.guarantor.lastName}
                      dni={g.guarantor.dni}
                      cuit={g.guarantor.cuit}
                      address={g.guarantor.address}
                      phone={g.guarantor.phone}
                      email={g.guarantor.email}
                      clientId={g.clientId ?? ""}
                      removable
                      onRemove={() => removeGuaranteeMutation.mutate(g.id)}
                    />
                  );
                }
                return (
                  <div key={g.id} className="rounded-[18px] border border-border bg-surface overflow-hidden">
                    <div className="flex items-center gap-3 px-[18px] py-4 border-b border-border">
                      <Badge variant="secondary" className="text-[0.65rem] px-2 py-0.5 h-auto rounded-full">
                        Garantía propietaria
                      </Badge>
                      {g.propertyId && (
                        <Link
                          href={`/propiedades/${g.propertyId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-[0.72rem] text-primary hover:underline"
                        >
                          Ver propiedad <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                      <button
                        type="button"
                        onClick={() => removeGuaranteeMutation.mutate(g.id)}
                        className="ml-auto p-1 rounded-md hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-[18px] py-4">
                      <FieldRow label="Domicilio" value={g.externalAddress} />
                      <FieldRow label="Ref. catastral" value={g.externalCadastralRef} />
                      <FieldRow label="Propietario" value={g.externalOwnerName} />
                      <FieldRow label="DNI propietario" value={g.externalOwnerDni} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {tenantParticipant && (
          <AddGuaranteeModal
            open={addGuaranteeOpen}
            onOpenChange={setAddGuaranteeOpen}
            contractId={contractId}
            tenantClientId={tenantParticipant.client.id}
            onSuccess={() => queryClient.invalidateQueries({ queryKey: ["contract", contractId] })}
          />
        )}

        {/* Combobox de búsqueda inline */}
        {clientSearchOpen && (
          <div className="rounded-[18px] border border-border bg-surface overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <Search className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <input
                autoFocus
                type="text"
                value={clientSearch}
                onChange={(e) => setClientSearch(e.target.value)}
                placeholder={`Buscar ${addingRole === "owner" ? "propietario" : "inquilino"}...`}
                className="flex-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
              />
              <button
                type="button"
                onClick={() => {
                  setClientSearchOpen(false);
                  setClientSearch("");
                  setAddingRole(null);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="divide-y max-h-48 overflow-y-auto">
              {clientSearch.length < 2 ? (
                <p className="p-3 text-sm text-muted-foreground text-center">
                  Escribí al menos 2 caracteres
                </p>
              ) : clientOptions.length === 0 ? (
                <p className="p-3 text-sm text-muted-foreground text-center">Sin resultados</p>
              ) : (
                clientOptions.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleSelectClient(c)}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-accent transition-colors"
                  >
                    {`${c.firstName} ${c.lastName || ""}`.trim()}
                  </button>
                ))
              )}
              <button
                type="button"
                onClick={() => setShowCreatePopup(true)}
                className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-primary hover:bg-accent transition-colors"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Crear nueva persona
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
