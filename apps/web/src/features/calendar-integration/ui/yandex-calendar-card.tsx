"use client";

import { useCallback, useEffect, useState } from "react";
import {
  CalendarDays,
  CircleAlert,
  CircleCheck,
  Link2,
  LoaderCircle,
  RefreshCw,
  Unplug,
} from "lucide-react";

import type { YandexCalendarStatusDto } from "@/entities/calendar";
import { ApiError } from "@/shared/api";
import { cn } from "@/shared/lib/cn";
import { Button } from "@/shared/ui/button";
import {
  authorizeYandexCalendar,
  disconnectYandexCalendar,
  getYandexCalendarStatus,
  syncYandexCalendar,
} from "../api";

const connectedAtFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const OAUTH_POLL_MS = 1500;
const OAUTH_TIMEOUT_MS = 5 * 60 * 1000;

/** Итог действия с календарём — строка для блока со статусом. */
interface Feedback {
  /** Тон сообщения: успех или ошибка. */
  tone: "ok" | "error";
  /** Текст сообщения для пользователя. */
  text: string;
}

/** Достаёт понятный пользователю текст ошибки из ответа API или исключения. */
function errorText(cause: unknown, fallback: string): string {
  return cause instanceof ApiError ? cause.message : fallback;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => window.setTimeout(resolve, ms));
}

/**
 * Ждёт, пока popup OAuth закроется или статус станет «подключено».
 *
 * @param popup - окно Яндекс OAuth.
 * @returns Актуальный статус или `null`, если пользователь закрыл окно без разрешения.
 */
async function waitForOAuthConnection(popup: Window): Promise<YandexCalendarStatusDto | null> {
  const deadline = Date.now() + OAUTH_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const status = await getYandexCalendarStatus();
      if (status.connected) {
        if (!popup.closed) popup.close();
        return status;
      }
    } catch {
      // Пока пользователь на стороне Яндекса, временные сетевые сбои игнорируем.
    }
    if (popup.closed) {
      try {
        const status = await getYandexCalendarStatus();
        return status.connected ? status : null;
      } catch {
        return null;
      }
    }
    await sleep(OAUTH_POLL_MS);
  }
  return null;
}

/**
 * Карточка подключения Яндекс.Календаря через OAuth ('use client': статус
 * с backend, кнопка открывает окно Яндекса).
 *
 * @returns Секцию настроек со статусом подключения и кнопкой OAuth.
 */
export function YandexCalendarCard() {
  const [status, setStatus] = useState<YandexCalendarStatusDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setStatus(await getYandexCalendarStatus());
      setLoadError("");
    } catch (cause) {
      setLoadError(errorText(cause, "Не удалось загрузить статус календаря."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Откладываем запрос на тик: синхронный setState в эффекте вызывает каскадные рендеры.
    const timer = window.setTimeout(() => void fetchStatus(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchStatus]);

  /** Повторяет загрузку статуса: спиннер включаем в обработчике, а не в эффекте. */
  function retry() {
    setLoading(true);
    setLoadError("");
    void fetchStatus();
  }

  async function handleConnect() {
    setBusy(true);
    setFeedback(null);
    try {
      const { authorize_url: authorizeUrl } = await authorizeYandexCalendar();
      const popup = window.open(
        authorizeUrl,
        "yandex-calendar-oauth",
        "popup=yes,width=520,height=720",
      );
      if (!popup) {
        // Блокировщик попапов: уходим в той же вкладке на Яндекс.
        window.location.assign(authorizeUrl);
        return;
      }
      const next = await waitForOAuthConnection(popup);
      if (!next) {
        setFeedback({
          tone: "error",
          text: "Подключение не завершено. Разрешите доступ в окне Яндекса и попробуйте снова.",
        });
        return;
      }
      setStatus(next);
      setFeedback({
        tone: "ok",
        text: "Календарь подключён: встречи и напоминания синхронизируются.",
      });
    } catch (cause) {
      setFeedback({
        tone: "error",
        text: errorText(cause, "Не удалось подключить календарь."),
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleSync() {
    setSyncing(true);
    setFeedback(null);
    try {
      const result = await syncYandexCalendar();
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
      setStatus(await disconnectYandexCalendar());
      setConfirming(false);
      setFeedback({ tone: "ok", text: "Календарь отключён." });
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

  return (
    <section className="pixel-panel space-y-4 p-5">
      <h2 className="font-pixel text-foreground flex items-center gap-2 text-sm">
        <CalendarDays className="text-primary size-4" />
        Яндекс.Календарь
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
                Новые и изменённые встречи и напоминания попадают в календарь автоматически.
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
            Синхронизация добавит встречи и напоминания, созданные до подключения календаря.
            Отключение не удаляет события из Яндекс.Календаря, но новые записи перестанут
            синхронизироваться.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-muted-foreground font-mono text-[0.7rem] leading-relaxed">
            Встречи и напоминания из планировщика будут создаваться в календаре Яндекса. Нажмите
            «Подключить» — откроется окно Яндекса, где нужно разрешить доступ к календарю.
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" disabled={busy} onClick={() => void handleConnect()}>
              {busy ? (
                <LoaderCircle className="size-4 animate-spin" />
              ) : (
                <Link2 className="size-4" />
              )}
              {busy ? "Ждём разрешение…" : "Подключить"}
            </Button>
            <span className="text-muted-foreground font-mono text-[0.7rem] leading-relaxed">
              Вход через Яндекс ID, без пароля приложения.
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
