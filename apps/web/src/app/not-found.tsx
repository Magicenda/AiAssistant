import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { Logo } from "@/shared/ui/logo";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center p-4">
      <section className="pixel-panel w-full max-w-md p-8 text-center">
        <Logo className="text-primary mx-auto size-8" />
        <p className="font-pixel text-primary mt-6 text-5xl">404</p>
        <h1 className="font-pixel text-foreground mt-3 text-lg">Страница не найдена</h1>
        <p className="text-muted-foreground mt-2 font-mono text-xs leading-relaxed">
          Возможно, ссылка устарела или страница была удалена.
        </p>
        <Button asChild className="mt-6">
          <Link href="/">
            <ArrowLeft className="size-4" />
            На главную
          </Link>
        </Button>
      </section>
    </main>
  );
}
