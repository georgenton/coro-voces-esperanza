import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Voces de Esperanza", template: "%s · Voces de Esperanza" },
  description: "Gestión privada de cuotas, tesorería, incidencias y asistencia.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-theme="system" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('vde:theme:v1');if(t==='light'||t==='dark'||t==='system')document.documentElement.dataset.theme=t}catch(e){}})()` }} /></head>
      <body>{children}</body>
    </html>
  );
}
