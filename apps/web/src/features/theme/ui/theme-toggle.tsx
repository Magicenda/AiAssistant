"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { themeStorageKey } from "@/shared/config";

type Theme = "light" | "dark";

function applyTheme(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
  window.dispatchEvent(new Event("theme-change"));
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
        try { localStorage.setItem(themeStorageKey, value); } catch {}
      }}>
      {value === "light" ? <Sun className="size-4" /> : <Moon className="size-4" />}
      <span className="hidden sm:inline">{value === "light" ? "Светлая" : "Тёмная"}</span>
    </Button>)}
  </div>;
}
