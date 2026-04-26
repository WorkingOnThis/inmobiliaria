"use client";

import { useRouter } from "next/navigation";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useQuery } from "@tanstack/react-query";

type Role = "inquilino" | "propietario";

const LABELS: Record<Role, string> = {
  inquilino: "Inquilino",
  propietario: "Propietario",
};

const URLS: Record<Role, (id: string) => string> = {
  inquilino: (id) => `/inquilinos/${id}`,
  propietario: (id) => `/propietarios/${id}`,
};

type Props = {
  clientId: string;
  currentRole: Role;
};

export function RoleToggle({ clientId, currentRole }: Props) {
  const router = useRouter();

  const { data } = useQuery<{ roles: string[] }>({
    queryKey: ["client-roles", clientId],
    queryFn: async () => {
      const res = await fetch(`/api/clients/${clientId}/roles`);
      if (!res.ok) throw new Error();
      return res.json();
    },
    staleTime: 60_000,
  });

  const roles = data?.roles ?? [];
  const hasOtherRole = roles.some(
    (r) =>
      r !== (currentRole === "inquilino" ? "tenant" : "owner") &&
      (r === "tenant" || r === "owner")
  );

  if (!hasOtherRole) return null;

  const availableRoles: Role[] = ["inquilino"];
  if (roles.includes("owner")) availableRoles.push("propietario");

  if (availableRoles.length <= 1) return null;

  return (
    <ToggleGroup
      type="single"
      value={currentRole}
      onValueChange={(v) => {
        if (!v || v === currentRole) return;
        router.push(URLS[v as Role](clientId));
      }}
    >
      {availableRoles.map((role) => (
        <ToggleGroupItem key={role} value={role} className="text-xs h-8 px-3">
          {LABELS[role]}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}
