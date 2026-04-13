"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Search, User, Loader2 } from "lucide-react";
import { PropietarioSlidePanel } from "./propietario-slide-panel";
import { NuevoPropietarioModal } from "./nuevo-propietario-modal";

interface Propietario {
  id: string;
  firstName: string;
  lastName: string | null;
  phone: string | null;
  email: string | null;
  dni: string | null;
  cbu: string | null;
  status: string;
  propiedadesCount: number;
  contratosActivosCount: number;
  matchedProperty: string | null;
}

interface PropietariosResponse {
  propietarios: Propietario[];
  pagination: { total: number; page: number; limit: number; totalPages: number };
}

function getInitials(firstName: string, lastName: string | null) {
  return [firstName, lastName]
    .filter(Boolean)
    .map((p) => p![0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const AVATAR_COLORS = ["#6b1702", "#1a2a4a", "#1a4a2e", "#333537"];

function avatarColor(name: string) {
  const idx = name.charCodeAt(0) % AVATAR_COLORS.length;
  return AVATAR_COLORS[idx];
}

export function PropietariosList() {
  const router = useRouter();

  // Filtros y búsqueda
  const [statusFilter, setStatusFilter] = useState<"activo" | "inactivo" | "todos">("activo");
  const [searchValue, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Panel y modal
  const [selectedProp, setSelectedProp] = useState<Propietario | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [newlyCreatedId, setNewlyCreatedId] = useState<string | null>(null);

  // Paginación
  const [page, setPage] = useState(1);

  // Debounce del input de búsqueda
  useEffect(() => {
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(searchValue);
      setPage(1);
    }, 300);
    return () => clearTimeout(debounceTimer.current);
  }, [searchValue]);

  // Cerrar dropdown al click afuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const queryParams = new URLSearchParams({
    status: statusFilter,
    page: String(page),
    limit: "20",
    ...(debouncedSearch.length >= 2 ? { q: debouncedSearch } : {}),
  });

  const { data, isLoading, error } = useQuery<PropietariosResponse>({
    queryKey: ["propietarios", statusFilter, page, debouncedSearch],
    queryFn: async () => {
      const res = await fetch(`/api/propietarios?${queryParams}`);
      if (!res.ok) throw new Error("Error al obtener propietarios");
      return res.json();
    },
  });

  const handleRowClick = (p: Propietario) => {
    setSelectedProp(p);
    setPanelOpen(true);
  };

  const handleFichaClick = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    router.push(`/propietarios/${id}`);
  };

  const handleCreated = (propietario: Propietario) => {
    setNewlyCreatedId(propietario.id);
    setTimeout(() => setNewlyCreatedId(null), 8000);
  };

  const propietarios = data?.propietarios ?? [];
  const total = data?.pagination.total ?? 0;
  const totalPages = data?.pagination.totalPages ?? 1;

  return (
    <div
      className="flex flex-col gap-5 p-7 transition-[margin-right] duration-[280ms]"
      style={{ marginRight: panelOpen ? 380 : 0 }}
    >
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[1.5rem] font-bold text-[#e1e2e4] font-[Space_Grotesk] tracking-[-0.02em]">
            Propietarios
          </div>
          <div className="text-[0.78rem] text-[#a8a9ac] mt-0.5">
            Hacé click en una fila para ver la cuenta corriente
          </div>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-1.5 bg-[#ffb4a2] text-[#561100] text-[0.72rem] font-semibold px-3.5 py-2 rounded-[12px] hover:brightness-110 transition-all flex-shrink-0"
        >
          ＋ Nuevo propietario
        </button>
      </div>

      {/* Search bar */}
      <div className="bg-[#191c1e] border border-white/[0.07] rounded-[18px] overflow-hidden">
        <div className="flex items-center relative" ref={searchRef}>
          <div className="flex items-center gap-2.5 px-4 py-2.5 flex-1">
            <Search size={14} className="text-[#6b6d70] flex-shrink-0" />
            <input
              type="text"
              value={searchValue}
              onChange={(e) => {
                setSearchValue(e.target.value);
                setShowDropdown(e.target.value.length >= 2);
              }}
              onFocus={() => searchValue.length >= 2 && setShowDropdown(true)}
              placeholder="Buscar por nombre, DNI, teléfono o dirección de propiedad…"
              className="flex-1 bg-transparent border-none outline-none text-[0.85rem] text-[#e1e2e4] placeholder:text-[#6b6d70]"
            />
            {searchValue && (
              <button
                onClick={() => {
                  setSearchValue("");
                  setShowDropdown(false);
                }}
                className="text-[#6b6d70] hover:text-[#a8a9ac] text-xs"
              >
                ✕
              </button>
            )}
          </div>

          {/* Dropdown de búsqueda */}
          {showDropdown && propietarios.length > 0 && (
            <div className="absolute top-full left-0 right-0 bg-[#282a2c] border border-[rgba(255,180,162,0.2)] rounded-[12px] z-20 overflow-hidden shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
              {propietarios.slice(0, 5).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center gap-2.5 px-3.5 py-2.5 cursor-pointer border-b border-white/[0.07] last:border-0 hover:bg-[rgba(255,180,162,0.08)] transition-all"
                  onClick={() => {
                    setShowDropdown(false);
                    handleRowClick(p);
                  }}
                >
                  <div
                    className="w-7 h-7 rounded-[6px] flex items-center justify-center text-[0.62rem] font-extrabold text-white font-[Montserrat] flex-shrink-0"
                    style={{ background: avatarColor(p.firstName) }}
                  >
                    {getInitials(p.firstName, p.lastName)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[0.8rem] font-semibold text-[#e1e2e4]">
                      {p.lastName ? `${p.lastName}, ${p.firstName}` : p.firstName}
                    </div>
                    {p.matchedProperty ? (
                      <div className="text-[0.68rem] text-[#ffb4a2] mt-0.5">
                        <span className="text-[#6b6d70]">Propiedad: </span>
                        {p.matchedProperty}
                      </div>
                    ) : (
                      <div className="text-[0.68rem] text-[#6b6d70] mt-0.5">
                        DNI {p.dni ?? "—"}
                      </div>
                    )}
                  </div>
                  <span className="text-[0.58rem] font-bold px-1.5 py-0.5 rounded-full bg-[#333537] text-[#6b6d70]">
                    {p.matchedProperty ? "Por propiedad" : "Propietario"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Filter pills */}
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-t border-white/[0.07] flex-wrap">
          <span className="text-[0.62rem] font-bold uppercase tracking-[0.1em] text-[#6b6d70] flex-shrink-0 mr-1">
            Estado
          </span>
          {(["activo", "inactivo", "todos"] as const).map((s) => (
            <button
              key={s}
              onClick={() => {
                setStatusFilter(s);
                setPage(1);
              }}
              className={`px-3 py-1 text-[0.65rem] font-semibold rounded-full border transition-all ${
                statusFilter === s
                  ? "bg-[rgba(255,180,162,0.12)] border-[rgba(255,180,162,0.2)] text-[#ffb4a2]"
                  : "border-white/[0.07] text-[#a8a9ac] hover:text-[#e1e2e4]"
              }`}
            >
              {s === "activo" ? "Activos" : s === "inactivo" ? "Inactivos" : "Todos"}
            </button>
          ))}
          <span className="ml-auto text-[0.62rem] text-[#6b6d70]">
            {total} propietario{total !== 1 ? "s" : ""}
          </span>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-[#191c1e] border border-white/[0.07] rounded-[18px] overflow-hidden">
        {/* Toolbar */}
        <div className="px-5 py-3 flex items-center gap-2.5 border-b border-white/[0.07]">
          <span className="text-[0.78rem] font-semibold text-[#e1e2e4]">Propietarios</span>
          <span className="text-[0.72rem] text-[#6b6d70] bg-[#333537] px-2 py-0.5 rounded-full ml-1">
            {total}
          </span>
        </div>

        {error ? (
          <div className="p-8 text-center text-[#ffb4ab] text-sm">
            Error al cargar los propietarios
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 size={24} className="animate-spin text-[#6b6d70]" />
          </div>
        ) : propietarios.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-[#6b6d70]">
            <User size={32} strokeWidth={1.5} />
            <div className="text-sm">No hay propietarios registrados</div>
            <button
              onClick={() => setModalOpen(true)}
              className="mt-2 text-[0.72rem] text-[#ffb4a2] hover:underline"
            >
              Agregar el primero
            </button>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[0.8rem]">
                <thead>
                  <tr>
                    <th className="px-3.5 py-2.5 text-left text-[0.6rem] font-bold uppercase tracking-[0.12em] text-[#6b6d70] bg-[#1d2022] whitespace-nowrap">
                      Propietario
                    </th>
                    <th className="px-3.5 py-2.5 text-left text-[0.6rem] font-bold uppercase tracking-[0.12em] text-[#6b6d70] bg-[#1d2022]">
                      Teléfono
                    </th>
                    <th className="px-3.5 py-2.5 text-center text-[0.6rem] font-bold uppercase tracking-[0.12em] text-[#6b6d70] bg-[#1d2022]">
                      Propiedades
                    </th>
                    <th className="px-3.5 py-2.5 text-center text-[0.6rem] font-bold uppercase tracking-[0.12em] text-[#6b6d70] bg-[#1d2022] whitespace-nowrap">
                      Contratos activos
                    </th>
                    <th className="px-3.5 py-2.5 text-left text-[0.6rem] font-bold uppercase tracking-[0.12em] text-[#6b6d70] bg-[#1d2022]">
                      Estado
                    </th>
                    <th className="px-3.5 py-2.5 text-right text-[0.6rem] font-bold uppercase tracking-[0.12em] text-[#6b6d70] bg-[#1d2022] w-20">
                      &nbsp;
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {propietarios.map((p, i) => {
                    const isNew = p.id === newlyCreatedId;
                    const isSelected = selectedProp?.id === p.id && panelOpen;
                    return (
                      <tr
                        key={p.id}
                        onClick={() => handleRowClick(p)}
                        className={`cursor-pointer transition-all ${
                          i % 2 === 1 ? "bg-[rgba(255,255,255,0.02)]" : ""
                        } ${
                          isSelected
                            ? "!bg-[rgba(255,180,162,0.12)] border-l-2 border-[#ffb4a2]"
                            : isNew
                            ? "bg-[rgba(255,180,162,0.06)]"
                            : ""
                        } hover:bg-[rgba(255,180,162,0.08)]`}
                        style={
                          p.status === "inactivo" || p.status === "baja"
                            ? { opacity: 0.65 }
                            : undefined
                        }
                      >
                        <td className="px-3.5 py-3 align-middle">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-8 h-8 rounded-[6px] flex items-center justify-center text-[0.68rem] font-extrabold text-white font-[Montserrat] flex-shrink-0"
                              style={{ background: avatarColor(p.firstName) }}
                            >
                              {getInitials(p.firstName, p.lastName)}
                            </div>
                            <div>
                              <div className="font-semibold text-[#e1e2e4] whitespace-nowrap flex items-center gap-1.5">
                                {p.lastName
                                  ? `${p.lastName}, ${p.firstName}`
                                  : p.firstName}
                                {isNew && (
                                  <span className="text-[0.55rem] font-bold px-1.5 py-0.5 rounded-full bg-[rgba(255,180,162,0.12)] border border-[rgba(255,180,162,0.2)] text-[#ffb4a2] tracking-[0.06em]">
                                    ✦ Nuevo
                                  </span>
                                )}
                              </div>
                              {p.dni && (
                                <div className="text-[0.68rem] text-[#6b6d70] mt-0.5">
                                  DNI {p.dni}
                                </div>
                              )}
                              {p.matchedProperty && (
                                <div className="text-[0.65rem] text-[#ffb4a2] mt-0.5">
                                  📍 {p.matchedProperty}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-3.5 py-3 align-middle text-[0.8rem] text-[#a8a9ac] whitespace-nowrap">
                          {p.phone ?? "—"}
                        </td>
                        <td className="px-3.5 py-3 align-middle text-center">
                          <span
                            className={`inline-flex items-center justify-center min-w-[24px] h-6 rounded-[6px] text-[0.72rem] font-bold px-1.5 border ${
                              p.propiedadesCount > 0
                                ? "bg-[rgba(255,180,162,0.12)] border-[rgba(255,180,162,0.2)] text-[#ffb4a2]"
                                : "bg-[#222527] border-white/[0.07] text-[#6b6d70]"
                            }`}
                          >
                            {p.propiedadesCount}
                          </span>
                        </td>
                        <td className="px-3.5 py-3 align-middle text-center">
                          <span
                            className={`inline-flex items-center justify-center min-w-[24px] h-6 rounded-[6px] text-[0.72rem] font-bold px-1.5 border ${
                              p.contratosActivosCount > 0
                                ? "bg-[rgba(255,180,162,0.12)] border-[rgba(255,180,162,0.2)] text-[#ffb4a2]"
                                : "bg-[#222527] border-white/[0.07] text-[#6b6d70]"
                            }`}
                          >
                            {p.contratosActivosCount}
                          </span>
                        </td>
                        <td className="px-3.5 py-3 align-middle">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 text-[0.6rem] font-bold rounded-full ${
                              p.status === "activo"
                                ? "bg-[rgba(127,211,160,0.12)] text-[#7fd3a0]"
                                : p.status === "suspendido"
                                ? "bg-[rgba(253,222,168,0.15)] text-[#ffdea8]"
                                : "bg-[#333537] text-[#6b6d70]"
                            }`}
                          >
                            <span className="w-1.5 h-1.5 rounded-full bg-current block" />
                            {p.status === "activo"
                              ? "Activo"
                              : p.status === "suspendido"
                              ? "Suspendido"
                              : "Baja"}
                          </span>
                        </td>
                        <td className="px-3.5 py-3 align-middle">
                          <div
                            className="flex gap-1 justify-end"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              onClick={(e) => handleFichaClick(e, p.id)}
                              title="Ver ficha completa"
                              className="w-7 h-7 bg-transparent border border-white/[0.07] rounded-[6px] flex items-center justify-center text-[#6b6d70] text-[11px] hover:bg-[rgba(255,180,162,0.12)] hover:text-[#ffb4a2] hover:border-[rgba(255,180,162,0.2)] transition-all"
                            >
                              <User size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="bg-[#1d2022] border-t border-white/[0.07] px-5 py-2.5 flex items-center gap-3">
                <span className="text-[0.72rem] text-[#6b6d70]">
                  Página {page} de {totalPages}
                </span>
                <div className="flex gap-1 ml-auto">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="w-7 h-7 border border-white/[0.07] rounded-[6px] flex items-center justify-center text-[#a8a9ac] text-xs hover:bg-[#282a2c] disabled:opacity-40 transition-all"
                  >
                    ‹
                  </button>
                  {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                    const pageNum = i + 1;
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`w-7 h-7 border rounded-[6px] flex items-center justify-center text-xs font-bold transition-all ${
                          page === pageNum
                            ? "bg-[rgba(255,180,162,0.12)] border-[rgba(255,180,162,0.2)] text-[#ffb4a2]"
                            : "border-white/[0.07] text-[#a8a9ac] hover:bg-[#282a2c]"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="w-7 h-7 border border-white/[0.07] rounded-[6px] flex items-center justify-center text-[#a8a9ac] text-xs hover:bg-[#282a2c] disabled:opacity-40 transition-all"
                  >
                    ›
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Slide panel */}
      <PropietarioSlidePanel
        propietario={selectedProp}
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
      />

      {/* Modal nuevo propietario */}
      <NuevoPropietarioModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onCreated={(p) => {
          handleCreated(p as Propietario);
        }}
      />
    </div>
  );
}
