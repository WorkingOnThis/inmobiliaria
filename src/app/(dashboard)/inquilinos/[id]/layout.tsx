import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Inquilinos",
};

export default function InquilinoDetailLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
