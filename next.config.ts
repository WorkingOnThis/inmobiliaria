import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,

  // Security headers aplicados a todas las rutas. Defense-in-depth a nivel HTTP.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Fuerza HTTPS por 1 año en cualquier subdominio. NO incluir preload todavía
          // (requiere submit a hstspreload.org y es difícil revertir).
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          // Anti-clickjacking. La app no se embebe en iframes externos.
          { key: "X-Frame-Options", value: "DENY" },
          // Bloquea MIME sniffing del browser.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // No mandar Referer cuando se navega a otro origen.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // Limitar features del browser. Si en el futuro se necesita una, agregar acá.
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
