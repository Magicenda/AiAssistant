import type { Metadata } from "next";

import "./globals.css";
import { siteConfig, themeStorageKey } from "@/shared/config";

export const metadata: Metadata = {
  title: {
    default: siteConfig.name,
    template: `%s — ${siteConfig.name}`,
  },
  description: siteConfig.description,
};

// Тема применяется до первой отрисовки, чтобы не было вспышки светлой темы.
const themeScript = `(function () {
  var key = ${JSON.stringify(themeStorageKey)};
  var media = matchMedia("(prefers-color-scheme: dark)");
  function apply(theme) {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
    window.dispatchEvent(new Event("theme-change"));
  }
  function read() {
    try {
      var saved = localStorage.getItem(key);
      if (saved === "light" || saved === "dark") return saved;
    } catch (e) {}
    return media.matches ? "dark" : "light";
  }
  apply(read());
  media.addEventListener("change", function () { apply(read()); });
  window.addEventListener("storage", function (event) {
    if (event.key === key) apply(read());
  });
})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
