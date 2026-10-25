"use client";

import { Bell, Bot, CalendarDays, CheckSquare, ListTodo, Search, Settings, User, Menu, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/shared/ui/button";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { ThemeToggle } from "@/features/theme";
import { ConversationList } from "@/features/conversations";
import { cn } from "@/shared/lib/cn";

const NAV_ITEMS = [
  { href: "/plans", label: "Мои планы", icon: CalendarDays },
  { href: "/tasks", label: "Задачи", icon: CheckSquare },
  { href: "/meetings", label: "Встречи", icon: ListTodo },
  { href: "/reminders", label: "Напоминания", icon: Bell },
  { href: "/search", label: "Поиск", icon: Search },
  { href: "/profile", label: "Профиль", icon: User },
  { href: "/settings", label: "Настройки", icon: Settings },
] as const;

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

    const content = (<>
      <ConversationList />
      <nav aria-label="Разделы" className="mt-4 flex flex-col gap-1">
        <Link
          href="/chat"
          className={cn(
            "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-colors hover:bg-card/70",
            pathname.startsWith("/chat") && "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/10",
          )}
        >
          <Bot className="size-4" />
          Ассистент
        </Link>
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-medium transition-colors hover:bg-card/70",
              pathname.startsWith(href) && "bg-primary/10 text-primary shadow-sm ring-1 ring-primary/10",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </nav>
      <div className="mt-4 border-t px-2 pt-4"><ThemeToggle /></div>
  </>);


  return (
    <>
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 overflow-y-auto overscroll-contain bg-transparent p-4 lg:block">
        {content}
      </aside>
      <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-2 border-b bg-background/85 px-3 py-2 backdrop-blur-2xl sm:px-6 lg:hidden">
        <Button variant="ghost" aria-label="Открыть меню"
          aria-expanded={open} aria-controls="app-navigation" onClick={() => {
            dialog.current?.showModal(); setOpen(true);
          }}>
          <Menu className="size-5" /><span className="hidden sm:inline">Меню</span>
        </Button>
        <Link href="/chat" className="text-sm font-semibold tracking-tight sm:text-base">Assistant</Link>
        <ThemeToggle />
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
        className="fixed inset-y-0 left-0 right-auto m-0 h-dvh max-h-dvh w-80 max-w-[calc(100vw-2rem)] overflow-y-auto overscroll-contain border-r bg-background/95 p-4 text-foreground shadow-2xl backdrop-blur-2xl backdrop:bg-black/45 backdrop:backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">Навигация</p>
          <Button autoFocus variant="ghost" size="icon" aria-label="Закрыть меню" onClick={close}>
            <X className="size-5" />
          </Button>
        </div>
        {content}
      </dialog>
    </>
  );
}
