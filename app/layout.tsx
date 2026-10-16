import type { Metadata, Viewport } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", weight: ["500", "600", "700", "800"], display: "swap" });

export const metadata: Metadata = {
  title: "catalogos · Catálogos para distribuidoras",
  description: "Arrastra tus fotos y tu Excel: el catálogo se arma solo y se comparte con un enlace.",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = { themeColor: "#0B0F19", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${inter.variable} ${jakarta.variable}`}>
      <body>{children}</body>
    </html>
  );
}
