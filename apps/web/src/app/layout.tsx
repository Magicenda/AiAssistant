import type { Metadata } from "next";
import localFont from "next/font/local";

import "./globals.css";
import { siteConfig } from "@/shared/config";

// Handjet, урезанный до латиницы и кириллицы, лежит в репозитории:
// шрифт грузится со своего домена и не мигает при перезагрузке.
const handjet = localFont({
  src: "./fonts/Handjet.woff2",
  weight: "100 900",
  variable: "--font-pixel",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s — ${siteConfig.name}`,
  },
  description: siteConfig.description,
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icon.png", type: "image/png", sizes: "500x500" }],
    shortcut: "/icon.png",
    apple: [{ url: "/icon.png", type: "image/png", sizes: "500x500" }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" className={handjet.variable}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
