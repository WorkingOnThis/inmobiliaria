import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contratos",
};

export default function ContratoDetailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
