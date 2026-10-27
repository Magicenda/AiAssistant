import Link from "next/link";
import { Logo } from "@/shared/ui/logo";

import { Button } from "@/shared/ui/button";

export function SiteHeader() {
  return (
    <header className="sticky top-0 border-b bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <Logo className="size-5" />
          AI Assistant
        </Link>
        <nav className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href="/sign-in">Войти</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/sign-up">Регистрация</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
