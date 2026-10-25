import type { Metadata } from "next";

import "./globals.css";
import { ThemeInit } from "@/features/theme";
import { siteConfig } from "@/shared/config";

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s — ${siteConfig.name}`,
  },
  description: siteConfig.description,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className="min-h-dvh antialiased"><ThemeInit />{children}</body>
    </html>
  );
}
