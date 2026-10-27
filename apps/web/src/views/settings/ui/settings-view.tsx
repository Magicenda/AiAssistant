import Link from "next/link";
import { ArrowRight, KeyRound, ServerCog } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { ModelForm } from "@/features/model-settings";

export function SettingsView() {
  return (
    <section className="mx-auto max-w-3xl space-y-6 p-2 pb-12 md:p-6">
      <header className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-primary">Модель</p>
        <h1 className="font-pixel text-2xl text-foreground sm:text-3xl">Настройки ассистента</h1>
        <p className="max-w-xl font-mono text-sm leading-relaxed text-muted-foreground">
          Выберите провайдера, модель и API-ключ. Стриминг ответов и распознавание
          речи выполняет backend — фронтенд передаёт ему эти настройки.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="pixel-panel flex gap-3 p-4">
          <KeyRound className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <p className="font-pixel text-xs text-foreground">Настройки в браузере</p>
            <p className="mt-1 font-mono text-[0.7rem] leading-relaxed text-muted-foreground">
              Провайдер, модель и ключ хранятся в localStorage и передаются backend.
            </p>
          </div>
        </div>
        <div className="pixel-panel flex gap-3 p-4">
          <ServerCog className="mt-0.5 size-5 shrink-0 text-primary" />
          <div>
            <p className="font-pixel text-xs text-foreground">Работа на сервере</p>
            <p className="mt-1 font-mono text-[0.7rem] leading-relaxed text-muted-foreground">
              Запросы к модели, стриминг ответов и распознавание речи делает backend.
            </p>
          </div>
        </div>
      </div>

      <ModelForm />

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Button asChild>
          <Link href="/chat">
            Перейти в чат
            <ArrowRight className="size-4" />
          </Link>
        </Button>
        <span className="font-mono text-xs text-muted-foreground">
          Настройки применяются к новым сообщениям сразу после сохранения.
        </span>
      </div>
    </section>
  );
}
