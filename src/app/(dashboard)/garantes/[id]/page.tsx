"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GuarantorTabData } from "@/components/guarantors/guarantor-tab-data";
import { GuarantorTabGuarantees } from "@/components/guarantors/guarantor-tab-guarantees";

type Tab = "datos" | "garantias";

function getInitials(firstName: string, lastName: string | null) {
  return [firstName, lastName]
    .filter(Boolean)
    .map((p) => p![0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function GuarantorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const activeTab = (searchParams.get("tab") as Tab) ?? "datos";

  const setTab = (tab: Tab) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    router.replace(`/garantes/${id}?${params.toString()}`, { scroll: false });
  };

  const { data, isLoading, error } = useQuery<{
    guarantor: {
      id: string;
      firstName: string;
      lastName: string | null;
      dni: string | null;
      cuit: string | null;
      phone: string | null;
      email: string | null;
      address: string | null;
      birthDate: string | null;
      nationality: string | null;
      occupation: string | null;
      internalNotes: string | null;
    };
    guarantees: unknown[];
  } | null>({
    queryKey: ["guarantor", id],
    queryFn: async () => {
      const res = await fetch(`/api/guarantors/${id}`);
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Error al cargar el garante");
      }
      return res.json();
    },
  });

  const guarantor = data?.guarantor;

  return (
    <>
      {isLoading ? (
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : error || !guarantor ? (
        <div className="flex h-screen flex-col items-center justify-center gap-4 text-muted-foreground">
          <div className="text-sm">{(error as Error)?.message ?? "Garante no encontrado"}</div>
          <button
            onClick={() => router.back()}
            className="text-[0.72rem] text-primary hover:underline flex items-center gap-1"
          >
            <ArrowLeft size={12} /> Volver
          </button>
        </div>
      ) : (
        <div className="flex flex-col min-h-full">
          <div className="px-6 pt-5 pb-0 bg-bg border-b border-border">
            {/* Back */}
            <button
              onClick={() => router.back()}
              className="flex items-center gap-1.5 text-[0.72rem] text-muted-foreground hover:text-primary transition-colors mb-4"
            >
              <ArrowLeft size={12} /> Volver
            </button>

            {/* Header */}
            <div className="flex items-start justify-between gap-6 mb-4">
              <div className="flex items-center gap-4">
                <Avatar
                  className="size-14 rounded-[12px] flex-shrink-0"
                  style={{ boxShadow: "inset 0 0 0 1px var(--inset-highlight)" }}
                >
                  <AvatarFallback
                    className="text-[1.375rem] font-bold text-white rounded-[12px]"
                    style={{ background: "var(--gradient-owner)" }}
                  >
                    {getInitials(guarantor.firstName, guarantor.lastName)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h1
                    className="text-[1.375rem] font-bold text-on-bg font-headline"
                    style={{ letterSpacing: "-0.015em" }}
                  >
                    {guarantor.lastName
                      ? `${guarantor.firstName} ${guarantor.lastName}`
                      : guarantor.firstName}
                  </h1>
                  <div className="flex items-center flex-wrap gap-2.5 mt-1">
                    <Badge
                      variant="secondary"
                      className="normal-case font-medium text-[0.75rem] tracking-normal"
                    >
                      Garante
                    </Badge>
                    {guarantor.dni && (
                      <span className="text-[0.72rem] text-muted-foreground font-mono">
                        DNI {guarantor.dni}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setTab(v as Tab)}>
              <TabsList
                variant="line"
                className="w-full justify-start h-auto rounded-none bg-transparent p-0 gap-0"
              >
                {([
                  { key: "datos" as Tab,     label: "Datos" },
                  { key: "garantias" as Tab, label: "Garantías", count: (data?.guarantees ?? []).length },
                ] as { key: Tab; label: string; count?: number }[]).map(({ key, label, count }) => (
                  <TabsTrigger
                    key={key}
                    value={key}
                    className="px-4 py-3 text-[0.8rem] gap-2 rounded-none flex-none after:bg-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                  >
                    {label}
                    {count !== undefined && count > 0 && (
                      <Badge className="font-mono text-[11px] px-[7px] py-[2px] h-auto rounded-[4px] bg-surface-mid border-border normal-case tracking-normal font-normal leading-none">
                        {count}
                      </Badge>
                    )}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>

          <div className="flex-1 overflow-y-auto bg-bg">
            {activeTab === "datos" && (
              <GuarantorTabData guarantor={guarantor} />
            )}
            {activeTab === "garantias" && (
              <GuarantorTabGuarantees
                guaranteeRows={(data?.guarantees ?? []) as Parameters<typeof GuarantorTabGuarantees>[0]["guaranteeRows"]}
                guarantorId={guarantor.id}
                onSalaryInfoSaved={() => queryClient.invalidateQueries({ queryKey: ["guarantor", id] })}
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
