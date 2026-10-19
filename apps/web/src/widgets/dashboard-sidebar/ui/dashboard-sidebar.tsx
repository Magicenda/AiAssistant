"use client";

import { Plus, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/shared/lib/cn";

const NAV_ITEMS = [
  { href: "/profile", label: "Профиль", icon: User },
] as const;

export function DashboardSidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 flex-col border-r">
      <div className="border-b p-4 text-sm font-semibold">AI Assistant</div>
      <div className="flex-1 space-y-1 p-2">
        <Link
          href="/chat"
          className={cn(
            "flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent",
            pathname.startsWith("/chat") && "bg-accent",
          )}
        >
          <Plus className="size-4" />
          Новый чат
        </Link>
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm hover:bg-accent",
              pathname.startsWith(href) && "bg-accent",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        ))}
      </div>
    </aside>
  );
}
