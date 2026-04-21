"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ChevronRight } from "lucide-react";

interface ClientRolesBadgesProps {
  clientId: string;
  currentRole: "tenant" | "owner";
}

const ROLE_LABELS: Record<string, string> = {
  tenant: "Inquilino",
  owner: "Propietario",
  guarantor: "Garante",
};

const ROLE_LINKS: Record<string, (id: string) => string> = {
  tenant: (id) => `/inquilinos/${id}`,
  owner: (id) => `/propietarios/${id}`,
};

export function ClientRolesBadges({ clientId, currentRole }: ClientRolesBadgesProps) {
  const { data } = useQuery<{ roles: string[] }>({
    queryKey: ["client-roles", clientId],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${clientId}/roles`);
      if (!res.ok) throw new Error("Error al obtener roles");
      return res.json();
    },
    staleTime: 60_000,
  });

  const otherRoles = (data?.roles ?? []).filter((r) => r !== currentRole && ROLE_LINKS[r]);

  if (otherRoles.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {otherRoles.map((role) => (
        <Link key={role} href={ROLE_LINKS[role](clientId)}>
          <Badge
            variant="secondary"
            className="gap-1 text-xs cursor-pointer hover:bg-muted transition-colors"
          >
            También {ROLE_LABELS[role] ?? role}
            <ChevronRight className="size-3" />
          </Badge>
        </Link>
      ))}
    </div>
  );
}
