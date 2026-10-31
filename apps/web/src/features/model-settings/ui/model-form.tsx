"use client";

import {
  CircleAlert,
  CircleCheck,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  RotateCcw,
  Save,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";
import { useState, useSyncExternalStore, type FormEvent } from "react";

import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/lib/cn";
import {
  DEFAULT_MODEL_SETTINGS,
  PROVIDER_PRESETS,
  isLocalAddress,
  providerFor,
  readModelSettings,
  resetModelSettings,
  subscribeModelSettings,
  writeModelSettings,
  type ProviderId,
} from "@/entities/model-settings";

const selectClass =
  "h-10 w-full border-2 border-border bg-input px-3 font-mono text-sm text-foreground " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

const labelClass =
  "block space-y-2 font-mono text-xs uppercase tracking-wider text-muted-foreground";

/** Итог сохранения или сброса — одна строка для блока со статусом. */
interface Feedback {
  tone: "ok" | "error";
  text: string;
}

/** Значения полей формы до сохранения. */
interface Draft {
  provider: ProviderId;
  baseUrl: string;
  apiKey: string;
  model: string;
  temperature: number;
}

/**
 * Форма настроек модели ('use client': черновик в состоянии, пресеты
 * провайдеров, запись в localStorage).
 *
 * @returns Разметку формы с секциями «Модель», «Доступ», «Сервер» и параметрами локальной модели.
 */
export function ModelForm() {
  const saved = useSyncExternalStore(
    subscribeModelSettings,
    readModelSettings,
    () => DEFAULT_MODEL_SETTINGS,
  );
  const [draft, setDraft] = useState<Draft | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const settings: Draft = draft ?? {
    provider: saved.provider,
    baseUrl: saved.baseUrl,
    apiKey: saved.apiKey,
    model: saved.model,
    temperature: saved.temperature,
  };
  const changed =
    Boolean(draft) &&
    (draft?.provider !== saved.provider ||
      draft?.baseUrl !== saved.baseUrl ||
      draft?.apiKey !== saved.apiKey ||
      draft?.model !== saved.model ||
      draft?.temperature !== saved.temperature);

  function patch(value: Partial<Draft>) {
    setDraft({ ...settings, ...value });
    setFeedback(null);
  }

  function applyProvider(id: ProviderId) {
    const preset = PROVIDER_PRESETS.find(item => item.id === id);
    if (!preset) return;
    patch({
      provider: id,
      baseUrl: preset.baseUrl,
      model: preset.model,
      apiKey: id === "gigachat" ? "" : settings.apiKey,
    });
  }

  function handleBaseUrl(value: string) {
    patch({ baseUrl: value, provider: providerFor(value.trim()) });
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      writeModelSettings(settings);
      setDraft(null);
      setFeedback({ tone: "ok", text: "Настройки модели сохранены." });
    } catch (cause) {
      setFeedback({
        tone: "error",
        text: cause instanceof Error ? cause.message : "Не удалось сохранить настройки.",
      });
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    resetModelSettings();
    setDraft(null);
    setFeedback({ tone: "ok", text: "Возвращены настройки по умолчанию." });
  }

  const keyOptional = isLocalAddress(settings.baseUrl);

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      {feedback && (
        <div
          role={feedback.tone === "error" ? "alert" : "status"}
          className={cn(
            "flex items-start gap-2 border-2 px-3 py-2 font-mono text-xs",
            feedback.tone === "error"
              ? "border-destructive/60 bg-destructive/10 text-destructive"
              : "border-primary/60 bg-primary/10 text-foreground",
          )}
        >
          {feedback.tone === "error" ? (
            <CircleAlert className="mt-0.5 size-4 shrink-0" />
          ) : (
            <CircleCheck className="text-primary mt-0.5 size-4 shrink-0" />
          )}
          <span className="leading-relaxed">{feedback.text}</span>
        </div>
      )}

      <section className="pixel-panel space-y-4 p-5">
        <h2 className="font-pixel text-foreground flex items-center gap-2 text-sm">
          <Sparkles className="text-primary size-4" />
          Модель
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>
            Сервис
            <select
              className={selectClass}
              value={settings.provider}
              onChange={event => applyProvider(event.target.value as ProviderId)}
            >
              {PROVIDER_PRESETS.map(preset => (
                <option key={preset.id} value={preset.id}>
                  {preset.label}
                </option>
              ))}
            </select>
          </label>

          {settings.provider === "local" && (
            <label className={labelClass}>
              Модель
              <Input
                required
                value={settings.model}
                placeholder="например, qwen2.5:7b"
                onChange={event => patch({ model: event.target.value })}
                spellCheck={false}
              />
            </label>
          )}
        </div>

        {settings.provider === "local" && (
          <>
            <label className={labelClass}>
              Адрес API модели
              <Input
                required
                value={settings.baseUrl}
                placeholder="http://localhost:11434/v1"
                onChange={event => handleBaseUrl(event.target.value)}
                spellCheck={false}
                inputMode="url"
              />
            </label>
            <p className="text-muted-foreground font-mono text-[0.7rem] leading-relaxed">
              {PROVIDER_PRESETS.find(item => item.id === settings.provider)?.note} Укажите адрес без
              /chat/completions — backend добавит путь сам. Если backend запущен в Docker, Ollama на
              хосте доступна по адресу <code>http://host.docker.internal:11434/v1</code>.
            </p>
          </>
        )}

        {settings.provider === "gigachat" && (
          <p className="text-muted-foreground font-mono text-[0.7rem] leading-relaxed">
            {PROVIDER_PRESETS.find(item => item.id === settings.provider)?.note}
          </p>
        )}
      </section>

      {settings.provider === "local" && (
        <section className="pixel-panel space-y-4 p-5">
          <h2 className="font-pixel text-foreground flex items-center gap-2 text-sm">
            <KeyRound className="text-primary size-4" />
            Доступ
          </h2>
          <label className={labelClass}>
            API-ключ
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                value={settings.apiKey}
                autoComplete="off"
                spellCheck={false}
                placeholder={keyOptional ? "Не требуется для локального адреса" : "sk-…"}
                onChange={event => patch({ apiKey: event.target.value })}
                className="pr-11"
              />
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="absolute top-0 right-0 size-10"
                aria-label={showKey ? "Скрыть ключ" : "Показать ключ"}
                onClick={() => setShowKey(value => !value)}
              >
                {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </Button>
            </div>
          </label>
          <p className="text-muted-foreground font-mono text-[0.7rem] leading-relaxed">
            Ключ хранится только в этом браузере и передаётся backend вместе с запросом. Для Ollama
            и LM Studio он обычно не нужен.
          </p>
        </section>
      )}

      {settings.provider === "local" && (
        <section className="pixel-panel space-y-4 p-5">
          <h2 className="font-pixel text-foreground flex items-center gap-2 text-sm">
            <SlidersHorizontal className="text-primary size-4" />
            Параметры ответа
          </h2>
          <label className={labelClass}>
            <span className="flex items-center justify-between gap-3">
              Температура
              <span className="text-foreground">{settings.temperature.toFixed(2)}</span>
            </span>
            <input
              type="range"
              min={0}
              max={1.5}
              step={0.05}
              value={settings.temperature}
              onChange={event => patch({ temperature: Number(event.target.value) })}
              className="accent-primary w-full"
            />
          </label>
          <p className="text-muted-foreground font-mono text-[0.7rem] leading-relaxed">
            Настройка применяется только к локальной модели. Меньше — точнее и стабильнее, больше —
            свободнее и креативнее. Рекомендуется 0.6–0.8.
          </p>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="submit"
          disabled={
            saving ||
            (settings.provider === "local" && (!settings.baseUrl.trim() || !settings.model.trim()))
          }
        >
          {saving ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}
          Сохранить
        </Button>
        <Button type="button" variant="ghost" onClick={handleReset}>
          <RotateCcw className="size-4" />
          По умолчанию
        </Button>
        {changed && (
          <span className="text-secondary font-mono text-[0.7rem] tracking-wider uppercase">
            Есть несохранённые изменения
          </span>
        )}
      </div>
    </form>
  );
}
