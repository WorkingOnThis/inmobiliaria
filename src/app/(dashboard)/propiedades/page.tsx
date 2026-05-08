import type { Metadata } from "next";
import { PropertyList } from "@/components/properties/property-list";

export const metadata: Metadata = {
  title: "Propiedades",
};

export default function PropiedadesPage() {
  return (
    <div className="flex flex-1 flex-col">
      <PropertyList />
    </div>
  );
}
