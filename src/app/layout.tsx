import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Voces de Esperanza", template: "%s · Voces de Esperanza" },
  description: "Gestión privada de cuotas, tesorería, incidencias y asistencia.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
