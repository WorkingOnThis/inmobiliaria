import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Propietarios",
};

export default function PropietarioDetailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
