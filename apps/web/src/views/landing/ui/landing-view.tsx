import { ArrowRight, CalendarDays, MessageSquare, SlidersHorizontal } from "lucide-react";
import Link from "next/link";

import { Button } from "@/shared/ui/button";

const features = [
  {
    icon: MessageSquare,
    title: "Чат",
    text: "Пишите текстом или говорите голосом — запись превратится в текст.",
  },
  {
    icon: CalendarDays,
    title: "Планировщик",
    text: "Задачи, встречи и напоминания с датами и сроками.",
  },
  {
    icon: SlidersHorizontal,
    title: "Модель",
    text: "GigaChat по умолчанию или своя локальная модель в настройках.",
  },
];

/** Лендинг (Server Component): краткое описание продукта и переходы в приложение. */
export function LandingView() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col justify-center px-4 py-12">
      <section>
        <p className="text-primary font-mono text-xs tracking-[0.2em] uppercase">AI-ассистент</p>
        <h1 className="font-pixel text-foreground mt-4 max-w-2xl text-3xl leading-tight sm:text-4xl">
          Задачи, встречи и напоминания в одном диалоге
        </h1>
        <p className="text-muted-foreground mt-4 max-w-xl font-mono text-sm leading-relaxed">
          Напишите или скажите, что нужно сделать. Ассистент сохранит запись и покажет её в
          планировщике.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/chat">
              Открыть чат
              <ArrowRight className="size-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/settings">
              <SlidersHorizontal className="size-4" />
              Настроить модель
            </Link>
          </Button>
        </div>
      </section>

      <section className="mt-14 grid gap-3 sm:grid-cols-3">
        {features.map(({ icon: Icon, title, text }) => (
          <article key={title} className="pixel-panel p-4">
            <span className="bg-primary/15 text-primary flex size-9 items-center justify-center">
              <Icon className="size-4" />
            </span>
            <h2 className="font-pixel text-foreground mt-3 text-xs">{title}</h2>
            <p className="text-muted-foreground mt-1 font-mono text-xs leading-relaxed">{text}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
