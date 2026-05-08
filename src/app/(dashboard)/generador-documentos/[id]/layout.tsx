import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Generador de documentos",
};

export default function DocumentoDetailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
