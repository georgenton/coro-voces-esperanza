import type { Metadata } from "next";
import { Newsreader, Public_Sans } from "next/font/google";
import "./globals.css";

const publicSans = Public_Sans({ subsets: ["latin"], display: "swap", variable: "--font-public-sans" });
const newsreader = Newsreader({ subsets: ["latin"], display: "swap", variable: "--font-newsreader" });

export const metadata: Metadata = {
  title: { default: "Voces de Esperanza", template: "%s · Voces de Esperanza" },
  description: "Gestión privada de cuotas, tesorería, incidencias y asistencia.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" data-theme="system" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('vde:theme:v1');if(t==='light'||t==='dark'||t==='system')document.documentElement.dataset.theme=t}catch(e){}})()` }} /></head>
      <body className={`${publicSans.variable} ${newsreader.variable}`}>{children}</body>
    </html>
  );
}
