import Link from "next/link";
import { ArrowRight, KeyRound, ServerCog } from "lucide-react";

import { Button } from "@/shared/ui/button";
import { ModelForm } from "@/features/model-settings";

/** Экран настроек: форма модели и пояснения, как настройки применяются. */
export function SettingsView() {
  return (
    <section className="mx-auto max-w-3xl space-y-6 p-2 pb-12 md:p-6">
      <header className="space-y-3">
        <p className="text-primary font-mono text-xs tracking-[0.2em] uppercase">Модель</p>
        <h1 className="font-pixel text-foreground text-2xl sm:text-3xl">Настройки ассистента</h1>
        <p className="text-muted-foreground max-w-xl font-mono text-sm leading-relaxed">
          По умолчанию работает GigaChat с ключом на сервере. Можно переключиться на свою локальную
          модель в Ollama или LM Studio.
        </p>
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="pixel-panel flex gap-3 p-4">
          <KeyRound className="text-primary mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-pixel text-foreground text-xs">Настройки в браузере</p>
            <p className="text-muted-foreground mt-1 font-mono text-[0.7rem] leading-relaxed">
              Для локальной модели адрес, модель и ключ хранятся в localStorage.
            </p>
          </div>
        </div>
        <div className="pixel-panel flex gap-3 p-4">
          <ServerCog className="text-primary mt-0.5 size-5 shrink-0" />
          <div>
            <p className="font-pixel text-foreground text-xs">Работа на сервере</p>
            <p className="text-muted-foreground mt-1 font-mono text-[0.7rem] leading-relaxed">
              Ключ GigaChat остаётся на сервере; локальную модель вызывает backend.
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
        <span className="text-muted-foreground font-mono text-xs">
          Настройки применяются к новым сообщениям сразу после сохранения.
        </span>
      </div>
    </section>
  );
}
