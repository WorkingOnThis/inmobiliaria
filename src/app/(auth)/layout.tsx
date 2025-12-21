import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Autenticación | Inmobiliaria",
  description: "Inicia sesión o regístrate en tu cuenta",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-foreground">
            Bienvenido
          </h2>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Ingresa a tu cuenta para continuar
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}

