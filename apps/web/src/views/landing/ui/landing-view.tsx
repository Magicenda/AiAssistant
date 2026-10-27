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
          <span className="border-border bg-card text-muted-foreground inline-flex items-center gap-2 border-2 px-3 py-1 font-mono text-[0.65rem] tracking-widest uppercase">
            <Bot className="text-primary size-3.5" />
            Frontend для AI-сервиса
          </span>
          <h1 className="font-pixel text-foreground mt-5 text-3xl leading-tight sm:text-4xl md:text-5xl">
            Ассистент,
            <br />
            <span className="text-primary">который живёт у вас</span>
          </h1>
          <p className="text-muted-foreground mt-5 max-w-xl font-mono text-sm leading-relaxed">
            Подключите свой backend с моделями — и общайтесь с настоящим AI. Без аккаунтов и
            подписок: настройки модели — в вашем браузере, стриминг и распознавание речи — на
            сервере.
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
          <p className="text-muted-foreground/80 mt-4 font-mono text-[0.7rem] tracking-wider uppercase">
            Bun 1.4+ · Next.js 16 · backend API
          </p>
        </div>

        <div className="pixel-panel overflow-hidden">
          <div className="bg-muted flex items-center gap-1.5 border-b-2 border-black/40 px-3 py-2">
            <span className="bg-destructive size-2.5" />
            <span className="bg-primary size-2.5" />
            <span className="bg-secondary size-2.5" />
            <span className="text-muted-foreground ml-2 font-mono text-[0.65rem] tracking-widest uppercase">
              quick start
            </span>
          </div>
          <div className="space-y-2 p-4 font-mono text-xs leading-relaxed">
            <p className="text-muted-foreground">$ bun install</p>
            <p className="text-muted-foreground">$ bun dev</p>
            <p className="text-primary">→ http://localhost:3000</p>
            <p className="text-muted-foreground pt-2"># backend</p>
            <p className="text-foreground">NEXT_PUBLIC_API_URL=http://localhost:8000</p>
          </div>
        </div>
      </section>

      <section className="mt-14 grid gap-3 sm:grid-cols-2">
        {features.map(({ icon: Icon, title, text }) => (
          <article key={title} className="pixel-panel flex gap-3 p-4">
            <span className="bg-primary/15 text-primary flex size-10 shrink-0 items-center justify-center">
              <Icon className="size-5" />
            </span>
            <div>
              <h2 className="font-pixel text-foreground text-xs">{title}</h2>
              <p className="text-muted-foreground mt-1 font-mono text-xs leading-relaxed">{text}</p>
            </div>
          </article>
        ))}
      </section>

      <section className="mt-14">
        <h2 className="font-pixel text-foreground text-xl">Три шага до первого ответа</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {steps.map((step, index) => (
            <div key={step} className="pixel-panel p-4">
              <span className="bg-secondary font-pixel text-secondary-foreground flex size-8 items-center justify-center text-sm">
                {index + 1}
              </span>
              <p className="text-muted-foreground mt-3 font-mono text-xs leading-relaxed">{step}</p>
              {index === 2 && (
                <p className="text-primary mt-2 flex items-center gap-1 font-mono text-[0.65rem] tracking-wider uppercase">
                  <Check className="size-3.5" />
                  готово
                </p>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="border-border mt-14 flex flex-wrap items-center justify-between gap-4 border-t-2 pt-6">
        <p className="text-muted-foreground flex items-center gap-2 font-mono text-xs">
          <Server className="text-primary size-4" />
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
