import {
  ArrowRight,
  Bot,
  CalendarDays,
  Check,
  KeyRound,
  LockKeyhole,
  Mic,
  Server,
  Settings2,
} from "lucide-react";
import Link from "next/link";

import { Button } from "@/shared/ui/button";

const features = [
  {
    icon: KeyRound,
    title: "Модель на выбор",
    text: "Провайдер, модель и API-ключ настраиваются в интерфейсе: OpenRouter, OpenAI, DeepSeek, Mistral или Ollama.",
  },
  {
    icon: LockKeyhole,
    title: "Данные рядом",
    text: "Настройки и история чатов хранятся в браузере, LLM-контекст — на вашем сервере.",
  },
  {
    icon: Mic,
    title: "Голос",
    text: "Записывайте сообщения: распознавание речи выполняет сервер, фронтенд показывает результат.",
  },
  {
    icon: CalendarDays,
    title: "Планы и задачи",
    text: "Задачи, встречи и напоминания в одном пространстве, без внешних аккаунтов.",
  },
];

const steps = [
  "Запустите backend ассистента.",
  "Укажите адрес API в NEXT_PUBLIC_API_URL.",
  "Настройте модель и начните диалог.",
];

export function LandingView() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 md:py-16">
      <section className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <div>
          <span className="inline-flex items-center gap-2 border-2 border-border bg-card px-3 py-1 font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground">
            <Bot className="size-3.5 text-primary" />
            Frontend для AI-сервиса
          </span>
          <h1 className="mt-5 font-pixel text-3xl leading-tight text-foreground sm:text-4xl md:text-5xl">
            Ассистент,
            <br />
            <span className="text-primary">который живёт у вас</span>
          </h1>
          <p className="mt-5 max-w-xl font-mono text-sm leading-relaxed text-muted-foreground">
            Подключите свой backend с моделями — и общайтесь с настоящим AI.
            Без аккаунтов и подписок: настройки модели — в вашем браузере,
            стриминг и распознавание речи — на сервере.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Button asChild size="lg">
              <Link href="/chat">
                Открыть ассистента
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/settings">
                <Settings2 className="size-4" />
                Настроить модель
              </Link>
            </Button>
          </div>
          <p className="mt-4 font-mono text-[0.7rem] uppercase tracking-wider text-muted-foreground/80">
            Bun 1.4+ · Next.js 16 · backend API
          </p>
        </div>

        <div className="pixel-panel overflow-hidden">
          <div className="flex items-center gap-1.5 border-b-2 border-black/40 bg-muted px-3 py-2">
            <span className="size-2.5 bg-destructive" />
            <span className="size-2.5 bg-primary" />
            <span className="size-2.5 bg-secondary" />
            <span className="ml-2 font-mono text-[0.65rem] uppercase tracking-widest text-muted-foreground">
              quick start
            </span>
          </div>
          <div className="space-y-2 p-4 font-mono text-xs leading-relaxed">
            <p className="text-muted-foreground">$ bun install</p>
            <p className="text-muted-foreground">$ bun dev</p>
            <p className="text-primary">→ http://localhost:3000</p>
            <p className="pt-2 text-muted-foreground"># backend</p>
            <p className="text-foreground">NEXT_PUBLIC_API_URL=http://localhost:8000</p>
          </div>
        </div>
      </section>

      <section className="mt-14 grid gap-3 sm:grid-cols-2">
        {features.map(({ icon: Icon, title, text }) => (
          <article key={title} className="pixel-panel flex gap-3 p-4">
            <span className="flex size-10 shrink-0 items-center justify-center bg-primary/15 text-primary">
              <Icon className="size-5" />
            </span>
            <div>
              <h2 className="font-pixel text-xs text-foreground">{title}</h2>
              <p className="mt-1 font-mono text-xs leading-relaxed text-muted-foreground">{text}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="mt-14">
        <h2 className="font-pixel text-xl text-foreground">Три шага до первого ответа</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {steps.map((step, index) => (
            <div key={step} className="pixel-panel p-4">
              <span className="flex size-8 items-center justify-center bg-secondary font-pixel text-sm text-secondary-foreground">
                {index + 1}
              </span>
              <p className="mt-3 font-mono text-xs leading-relaxed text-muted-foreground">{step}</p>
              {index === 2 && (
                <p className="mt-2 flex items-center gap-1 font-mono text-[0.65rem] uppercase tracking-wider text-primary">
                  <Check className="size-3.5" />
                  готово
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t-2 border-border pt-6">
        <p className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <Server className="size-4 text-primary" />
          Backend разворачивается отдельно от фронтенда
        </p>
        <Button asChild variant="outline" size="sm">
          <Link href="/chat">
            Начать
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </section>
    </main>
  );
}
