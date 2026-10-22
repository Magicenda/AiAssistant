import type { Metadata } from "next";

import "./globals.css";
import { ThemeInit } from "@/features/theme";

export const metadata: Metadata = {
  title: {
    default: "AI Assistant",
    template: "%s — AI Assistant",
  },
  description: "AI-помощник",
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
