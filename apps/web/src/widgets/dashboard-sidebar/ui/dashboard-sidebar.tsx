"use client";

import type { Route } from "next";
import type { LucideIcon } from "lucide-react";
import { Bell, CalendarDays, CheckSquare, ListTodo, Menu, Search, Settings, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/shared/ui/button";
import { Logo } from "@/shared/ui/logo";
import { cn } from "@/shared/lib/cn";

type NavItem = { href: Route; label: string; icon: LucideIcon };

const NAV_ITEMS: NavItem[] = [
  { href: "/plans", label: "Планы", icon: CalendarDays },
  { href: "/tasks", label: "Задачи", icon: CheckSquare },
  { href: "/meetings", label: "Встречи", icon: ListTodo },
  { href: "/reminders", label: "Напоминания", icon: Bell },
  { href: "/search", label: "Поиск", icon: Search },
];

const FOOTER_ITEMS: NavItem[] = [
  { href: "/settings", label: "Настройки", icon: Settings },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  function close() { dialog.current?.close(); }
  useEffect(() => { dialog.current?.close(); }, [pathname]);
  useEffect(() => {
    const desktop = matchMedia("(min-width: 1024px)");
    const sync = () => { if (desktop.matches) dialog.current?.close(); };
    desktop.addEventListener("change", sync);
    return () => desktop.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, [open]);

  const content = (
    <>
      <Link
        href="/chat"
        className={cn(
          "pixel-bevel flex items-center gap-3 px-3 py-3",
          pathname.startsWith("/chat")
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-secondary-foreground",
        )}
      >
        <Logo className="size-5" />
        <span className="font-pixel text-sm">Ассистент</span>
      </Link>
      <nav aria-label="Разделы" className="mt-5 flex flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 border-2 border-transparent px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-colors",
              pathname.startsWith(href)
                ? "border-[#05060f] bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto flex flex-col gap-1 border-t-2 border-border pt-3">
        {FOOTER_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 border-2 border-transparent px-3 py-2 font-mono text-xs font-bold uppercase tracking-wider transition-colors",
              pathname.startsWith(href)
                ? "border-[#05060f] bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </div>
    </>
  );

  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r-2 border-border p-4 lg:flex">
        {content}
      </aside>

      <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-2 border-b-2 border-border bg-background px-3 py-2 sm:px-6 lg:hidden">
        <Button variant="ghost" aria-label="Открыть меню"
          aria-expanded={open} aria-controls="app-navigation" onClick={() => {
            dialog.current?.showModal(); setOpen(true);
          }}>
          <Menu className="size-5" /><span className="hidden sm:inline">Меню</span>
        </Button>
        <Link href="/chat" className="flex items-center gap-2">
          <Logo className="size-5 text-secondary" />
          <span className="font-pixel text-xs text-foreground">AI Assistant</span>
        </Link>
        <span className="size-9" aria-hidden="true" />
      </header>

      <dialog ref={dialog} id="app-navigation" aria-label="Меню приложения"
        onClose={() => { setOpen(false); }}
        onClick={event => {
          if (event.target === event.currentTarget) {
            const rect = event.currentTarget.getBoundingClientRect();
            if (event.clientX < rect.left || event.clientX > rect.right ||
                event.clientY < rect.top || event.clientY > rect.bottom) close();
          }
          if ((event.target as HTMLElement).closest("a")) close();
        }}
        className="fixed inset-y-0 left-0 right-auto m-0 h-dvh max-h-dvh w-80 max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain border-r-2 border-border bg-background p-4 text-foreground backdrop:bg-black/60">
        <div className="mb-5 flex items-center justify-between">
          <p className="font-mono text-xs font-bold uppercase tracking-widest text-muted-foreground">Навигация</p>
          <Button autoFocus variant="ghost" size="icon" aria-label="Закрыть меню" onClick={close}>
            <X className="size-5" />
          </Button>
        </div>
        <div className="flex min-h-[calc(100dvh-6rem)] flex-col">{content}</div>
      </dialog>
    </>
  );
}
