import type { Metadata } from "next";
import { Archivo, Figtree, IBM_Plex_Mono } from "next/font/google";
import "./tokens.css";
import "./globals.css";

const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo" });
const figtree = Figtree({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-figtree" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: "500", variable: "--font-plex-mono" });

export const metadata: Metadata = {
  title: "Llameo",
  description: "Llameo, por Taller Toca Plena",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className={`${archivo.variable} ${figtree.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
