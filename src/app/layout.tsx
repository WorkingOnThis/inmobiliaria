import type { Metadata } from "next";
import { Geist_Mono, Space_Grotesk, Inter, Montserrat } from "next/font/google";
import "./globals.css";
import { QueryClientProvider } from "@/components/providers/query-client-provider";
import { Toaster } from "@/components/ui/sonner";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
  weight: ["700", "800"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Arce Administración",
  description: "Sistema de gestión inmobiliaria",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark">
      <body
        className={`${spaceGrotesk.variable} ${inter.variable} ${montserrat.variable} ${geistMono.variable} antialiased`}
      >
        <QueryClientProvider>
          {children}
          <Toaster position="bottom-right" />
        </QueryClientProvider>
      </body>
    </html>
  );
}
