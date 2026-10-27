import Link from "next/link";
import { Settings2 } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Logo } from "@/shared/ui/logo";

export function SiteHeader() {
  return (
    <header className="border-border bg-background/95 sticky top-0 z-30 border-b-2 backdrop-blur">
      <div className="mx-auto flex min-h-14 max-w-5xl items-center justify-between gap-3 px-4">
        <Link href="/" className="flex items-center gap-2">
          <Logo className="text-primary size-5" />
          <span className="font-pixel text-foreground text-xs">AI Assistant</span>
        </Link>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/settings">
              <Settings2 className="size-4" />
              <span className="hidden sm:inline">Настройки</span>
            </Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/chat">Открыть чат</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
