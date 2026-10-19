import { Sparkles } from "lucide-react";
import Link from "next/link";

import { Button } from "@/shared/ui/button";

export function LandingView() {
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-6 py-24 text-center">
      <div className="bg-primary/10 text-primary flex size-14 items-center justify-center rounded-2xl">
        <Sparkles className="size-7" />
      </div>
      <h1 className="max-w-2xl text-4xl font-bold tracking-tight sm:text-5xl">
        Твой AI-помощник
      </h1>
      <p className="text-muted-foreground max-w-xl text-balance">
        Лендинг-заглушка. Здесь будет описание продукта, фичи, CTA.
      </p>
      <div className="flex gap-3">
        <Button asChild>
          <Link href="/sign-up">Начать бесплатно</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/chat">Открыть чат</Link>
        </Button>
      </div>
    </section>
  );
}
