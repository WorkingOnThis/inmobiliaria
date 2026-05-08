import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Clientes",
};

export default function ClientsLayout({
  children,
  modal,
}: {
  children: React.ReactNode;
  modal: React.ReactNode;
}) {
  return (
    <>
      {children}
      {modal}
    </>
  );
}





