import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// next/font/google scarica e self-hosta il font in fase di build (nessuna
// richiesta a Google Fonts a runtime). La CSS variable `--font-sans` è quella
// referenziata da tailwind.config.ts (theme.fontFamily.sans).
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "BeeClip",
  description: "Trasforma i tuoi video lunghi in clip social pronte a diventare virali.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="it" className={inter.variable}>
      <body className="bg-surface font-sans text-slate-100 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
