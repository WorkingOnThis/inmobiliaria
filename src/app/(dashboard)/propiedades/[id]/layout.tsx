import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Propiedades",
};

export default function PropiedadDetailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
