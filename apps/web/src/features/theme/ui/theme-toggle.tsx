"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/shared/ui/button";

type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
  window.dispatchEvent(new Event("theme-change"));
}

export function ThemeInit() {
  useEffect(() => {
    const system = matchMedia("(prefers-color-scheme: dark)");
    const sync = () => {
      let theme: Theme = system.matches ? "dark" : "light";
      try {
        const saved = localStorage.getItem("assistant-theme");
        if (saved === "light" || saved === "dark") theme = saved;
      } catch { /* Fall back to the system theme. */ }
      applyTheme(theme);
    };
    sync();
    window.addEventListener("storage", sync);
    system.addEventListener("change", sync);
    return () => {
      window.removeEventListener("storage", sync);
      system.removeEventListener("change", sync);
    };
  }, []);
  return null;
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);
  useEffect(() => {
    const sync = () => setTheme(document.documentElement.classList.contains("dark")
      ? "dark" : "light");
    sync();
    window.addEventListener("theme-change", sync);
    return () => window.removeEventListener("theme-change", sync);
  }, []);
  return <div role="group" aria-label="Тема всего приложения"
    className="inline-flex items-center gap-1 rounded-2xl border bg-card/70 p-1 backdrop-blur-xl">
    {(["light", "dark"] as const).map(value => <Button key={value} size="sm"
      variant={theme === value ? "secondary" : "ghost"}
      aria-label={value === "light" ? "Светлая тема" : "Тёмная тема"}
      aria-pressed={theme === value} onClick={() => {
        applyTheme(value);
        try { localStorage.setItem("assistant-theme", value); } catch {}
      }}>
      {value === "light" ? <Sun className="size-4" /> : <Moon className="size-4" />}
      <span className="hidden sm:inline">{value === "light" ? "Светлая" : "Тёмная"}</span>
    </Button>)}
  </div>;
}
