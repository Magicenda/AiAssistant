import { ArrowRight, CalendarDays, MessageSquare, SlidersHorizontal } from "lucide-react";
import Link from "next/link";

import { Button } from "@/shared/ui/button";
import { LandingTerminal } from "./landing-terminal";

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

/**
 * Лендинг (Server Component): статическая витрина продукта.
 * Живость сцене придают CSS-анимации — курсор, сканлайны, эквалайзер
 * и пиксельный ассистент; без клиентского JS и без шапки.
 *
 * @returns Полноэкранный герой с окном диалога и карточками возможностей.
 */
export function LandingView() {
  return (
    <main className="relative isolate flex flex-1 flex-col overflow-hidden">
      {/* Фон: плывущая пиксельная сетка и пульсирующие пятна света. */}
      <div aria-hidden="true" className="landing-grid pointer-events-none absolute inset-0 -z-10" />
      <div
        aria-hidden="true"
        className="landing-aurora pointer-events-none absolute inset-0 -z-10"
      />

      {/* my-auto бережёт вертикальные отступы: на высоком экране блок стоит по центру,
          а на низком страница спокойно прокручивается без обрезки сверху. */}
      <div className="my-auto">
        <section className="mx-auto grid w-full max-w-5xl items-center gap-14 px-4 sm:px-6 xl:grid-cols-[1.05fr_0.95fr] xl:gap-10 xl:py-20">
          <div className="relative">
            {/* Строка-маркер вместо надзаголовка: три квадрата и линия. */}
            <div aria-hidden="true" className="mb-6 flex items-center gap-2">
              <span className="pixel-blink bg-primary size-2.5" />
              <span className="pixel-blink-slow bg-secondary size-2.5" />
              <span className="bg-foreground/30 size-2.5" />
              <span className="bg-border h-0.5 w-24" />
            </div>

            <h1 className="font-pixel text-foreground text-4xl leading-[1.05] sm:text-5xl xl:text-[3.4rem]">
              Задачи, встречи и напоминания{" "}
              <span className="text-primary [text-shadow:3px_3px_0_#05060f]">в одном диалоге</span>
            </h1>

            <p className="border-primary/80 text-muted-foreground mt-6 max-w-lg border-l-4 pl-4 font-mono text-sm leading-relaxed">
              Напишите или скажите, что нужно сделать. Ассистент сохранит запись и покажет её в
              планировщике.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="group shadow-[0_0_1.5rem_rgba(255,184,0,0.25)]">
                <Link href="/chat">
                  Открыть чат
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="group">
                <Link href="/settings">
                  <SlidersHorizontal className="size-4 transition-transform duration-300 group-hover:rotate-90" />
                  Настроить модель
                </Link>
              </Button>
            </div>
          </div>

          <LandingTerminal />
        </section>

        <section className="mx-auto w-full max-w-5xl px-4 pb-16 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-3">
            {features.map(({ icon: Icon, title, text }) => (
              <article
                key={title}
                className="landing-card pixel-panel bg-card group relative overflow-hidden p-5"
              >
                {/* Статичная жёлтая кромка: акцент без движения. */}
                <span aria-hidden="true" className="landing-card__beam" />

                <div className="flex items-start justify-between gap-3">
                  <span className="pixel-bevel bg-primary text-primary-foreground flex size-11 items-center justify-center transition-transform duration-150 group-hover:-translate-y-1">
                    <Icon className="size-5" />
                  </span>
                  <span
                    aria-hidden="true"
                    className="border-border size-4 border-2 border-r-0 border-b-0"
                  />
                </div>

                <h2 className="font-pixel text-foreground mt-5 text-sm">{title}</h2>
                <p className="text-muted-foreground mt-2 font-mono text-xs leading-relaxed">
                  {text}
                </p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
