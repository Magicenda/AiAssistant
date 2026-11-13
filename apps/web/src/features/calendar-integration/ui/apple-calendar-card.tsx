"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarDays,
  CircleAlert,
  CircleCheck,
  ExternalLink,
  Link2,
  LoaderCircle,
  RefreshCw,
  Unplug,
} from "lucide-react";

import type { AppleCalendarStatusDto } from "@/entities/calendar";
import { ApiError } from "@/shared/api";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  connectAppleCalendar,
  disconnectAppleCalendar,
  getAppleCalendarStatus,
  syncAppleCalendar,
} from "../api";

const APPLE_ID_MANAGE_URL = "https://appleid.apple.com/account/manage";

const connectedAtFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

interface Feedback {
  tone: "ok" | "error";
  text: string;
}

function errorText(cause: unknown, fallback: string): string {
  return cause instanceof ApiError ? cause.message : fallback;
}

/**
 * Карточка Apple Календаря: мастер «код доступа» из 3 шагов + статус.
 */
export function AppleCalendarCard() {
  const [status, setStatus] = useState<AppleCalendarStatusDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(1);
  const [appleId, setAppleId] = useState("");
  const [appPassword, setAppPassword] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setStatus(await getAppleCalendarStatus());
      setLoadError("");
    } catch (cause) {
      setLoadError(errorText(cause, "Не удалось загрузить статус Apple Календаря."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void fetchStatus(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchStatus]);

  function retry() {
    setLoading(true);
    setLoadError("");
    void fetchStatus();
  }

  function openWizard() {
    setWizardOpen(true);
    setWizardStep(1);
    setAppleId("");
    setAppPassword("");
    setFeedback(null);
  }

  function closeWizard() {
    setWizardOpen(false);
    setWizardStep(1);
    setAppleId("");
    setAppPassword("");
  }

  async function handleConnect() {
    setBusy(true);
    setFeedback(null);
    try {
      const next = await connectAppleCalendar(appleId.trim(), appPassword.trim());
      setStatus(next);
      closeWizard();
      setFeedback({
        tone: "ok",
        text: "Apple Календарь подключён: встречи и напоминания синхронизируются.",
      });
    } catch (cause) {
      setFeedback({
        tone: "error",
        text: errorText(cause, "Не удалось подключить Apple Календарь."),
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setFeedback(null);
    try {
      const result = await syncAppleCalendar();
      const text = [`Добавлено встреч: ${result.meetings}.`, `Напоминаний: ${result.reminders}.`];
      if (result.failed > 0) text.push(`Не удалось добавить: ${result.failed}.`);
      setFeedback({ tone: result.failed > 0 ? "error" : "ok", text: text.join(" ") });
    } catch (cause) {
      setFeedback({
        tone: "error",
        text: errorText(cause, "Не удалось синхронизировать записи."),
      });
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    setBusy(true);
    setFeedback(null);
    try {
      setStatus(await disconnectAppleCalendar());
      setConfirming(false);
      setFeedback({ tone: "ok", text: "Apple Календарь отключён." });
    } catch (cause) {
      setFeedback({
        tone: "error",
        text: errorText(cause, "Не удалось отключить календарь."),
      });
    } finally {
      setBusy(false);
    }
  }

  const connected = status?.connected ?? false;
  const connectedAt = status?.connected_at ? new Date(status.connected_at) : null;
  const canSubmit =
    appleId.trim().length >= 3 && appPassword.replace(/\s/g, "").length >= 8 && !busy;

  return (
    <section className="pixel-panel space-y-4 p-5">
      <h2 className="font-pixel text-foreground flex items-center gap-2 text-sm">
        <CalendarDays className="text-primary size-4" />
        Apple Календарь
      </h2>

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

      {loading ? (
        <p className="text-muted-foreground flex items-center gap-2 font-mono text-xs">
          <LoaderCircle className="size-4 animate-spin" />
          Проверяем подключение…
        </p>
      ) : loadError ? (
        <div className="space-y-3">
          <p role="alert" className="text-destructive font-mono text-xs">
            {loadError}
          </p>
          <Button type="button" variant="outline" size="sm" onClick={retry}>
            Повторить
          </Button>
        </div>
      ) : connected ? (
        <div className="space-y-4">
          <div className="border-primary/40 bg-primary/10 flex items-start gap-3 border-2 p-3">
            <Link2 className="text-primary mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 space-y-1">
              <p className="text-foreground font-mono text-sm break-words">{status?.login}</p>
              <p className="text-muted-foreground font-mono text-[0.7rem] leading-relaxed">
                {connectedAt
                  ? `Подключён ${connectedAtFormat.format(connectedAt)}.`
                  : "Календарь подключён."}{" "}
                Новые и изменённые встречи и напоминания попадают в iCloud автоматически.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void handleSync()}
              disabled={busy || syncing}
            >
              {syncing ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              {syncing ? "Синхронизируем…" : "Синхронизировать существующие"}
            </Button>

            {confirming ? (
              <>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => void handleDisconnect()}
                  disabled={busy || syncing}
                >
                  {busy ? "Отключаем…" : "Да, отключить"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirming(false)}
                  disabled={busy || syncing}
                >
                  Отмена
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirming(true)}
                disabled={busy || syncing}
              >
                <Unplug className="size-4" />
                Отключить
              </Button>
            )}
          </div>

          <p className="text-muted-foreground font-mono text-[0.7rem] leading-relaxed">
            Синхронизация добавит встречи и напоминания, созданные до подключения. Отключение не
            удаляет события из Apple Календаря.
          </p>
        </div>
      ) : wizardOpen ? (
        <div className="space-y-4">
          <p className="text-muted-foreground font-mono text-[0.7rem]">
            Шаг {wizardStep} из 3 · код доступа календаря
          </p>

          {wizardStep === 1 && (
            <div className="space-y-4">
              <p className="text-muted-foreground font-mono text-[0.7rem] leading-relaxed">
                Откройте Apple ID и создайте пароль приложения. Основной пароль Apple ID не нужен и
                не подойдёт — только отдельный код из раздела «Пароли приложений».
              </p>
              <a
                href={APPLE_ID_MANAGE_URL}
                target="_blank"
                rel="noreferrer"
                className="text-primary inline-flex items-center gap-2 font-mono text-xs underline-offset-2 hover:underline"
              >
                Открыть appleid.apple.com
                <ExternalLink className="size-3.5" />
              </a>
              <div className="flex flex-wrap gap-2">
                <Button type="button" onClick={() => setWizardStep(2)}>
                  Далее
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={closeWizard}>
                  Отмена
                </Button>
              </div>
            </div>
          )}

          {wizardStep === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="apple-id" className="font-pixel text-foreground text-xs">
                  Apple ID (email)
                </label>
                <Input
                  id="apple-id"
                  type="email"
                  autoComplete="username"
                  placeholder="name@icloud.com"
                  value={appleId}
                  onChange={event => setAppleId(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label htmlFor="apple-app-password" className="font-pixel text-foreground text-xs">
                  Код доступа календаря
                </label>
                <Input
                  id="apple-app-password"
                  type="password"
                  autoComplete="off"
                  placeholder="xxxx-xxxx-xxxx-xxxx"
                  value={appPassword}
                  onChange={event => setAppPassword(event.target.value)}
                />
                <p className="text-muted-foreground font-mono text-[0.65rem] leading-relaxed">
                  Это не пароль от Apple ID, а пароль приложения из настроек аккаунта.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setWizardStep(1)}>
                  Назад
                </Button>
                <Button
                  type="button"
                  onClick={() => setWizardStep(3)}
                  disabled={appleId.trim().length < 3 || appPassword.replace(/\s/g, "").length < 8}
                >
                  Далее
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={closeWizard}>
                  Отмена
                </Button>
              </div>
            </div>
          )}

          {wizardStep === 3 && (
            <div className="space-y-4">
              <p className="text-muted-foreground font-mono text-[0.7rem] leading-relaxed">
                Проверим доступ к iCloud Календарю для{" "}
                <span className="text-foreground">{appleId.trim()}</span> и сохраним подключение.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setWizardStep(2)}>
                  Назад
                </Button>
                <Button type="button" disabled={!canSubmit} onClick={() => void handleConnect()}>
                  {busy ? (
                    <LoaderCircle className="size-4 animate-spin" />
                  ) : (
                    <Link2 className="size-4" />
                  )}
                  {busy ? "Подключаем…" : "Подключить"}
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={closeWizard} disabled={busy}>
                  Отмена
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-muted-foreground font-mono text-[0.7rem] leading-relaxed">
            Встречи и напоминания будут создаваться в iCloud. Для подключения нужен Apple ID и
            пароль приложения — не основной пароль аккаунта.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" onClick={openWizard}>
              <Link2 className="size-4" />
              Подключить
            </Button>
            <span className="text-muted-foreground font-mono text-[0.7rem] leading-relaxed">
              Мастер «код доступа календаря», 3 шага.
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
