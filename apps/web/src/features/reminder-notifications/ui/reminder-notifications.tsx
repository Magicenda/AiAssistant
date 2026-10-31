"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, BellRing, X } from "lucide-react";
import type { TaskItemDto } from "@/entities/planner";
import { getAccessToken } from "@/shared/api";
import { Button } from "@/shared/ui/button";
import { claimDueReminders } from "../api";

const POLL_INTERVAL_MS = 30_000;

/** Следит за наступившими напоминаниями во всём личном кабинете. */
export function ReminderNotifications() {
  const [reminders, setReminders] = useState<TaskItemDto[]>([]);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">(
    "unsupported",
  );
  const polling = useRef(false);

  const poll = useCallback(async () => {
    if (!getAccessToken() || polling.current) return;
    polling.current = true;
    try {
      const due = await claimDueReminders();
      if (due.length === 0) return;

      setReminders(current => {
        const known = new Set(current.map(reminder => reminder.id));
        return [...current, ...due.filter(reminder => !known.has(reminder.id))];
      });

      if ("Notification" in window && Notification.permission === "granted") {
        for (const reminder of due) {
          new Notification("Напоминание", { body: reminder.description });
        }
      }
    } catch {
      // Следующая проверка повторит запрос; фоновые сетевые ошибки не мешают работе кабинета.
    } finally {
      polling.current = false;
    }
  }, []);

  useEffect(() => {
    const permissionTimer = window.setTimeout(() => {
      if ("Notification" in window) setPermission(Notification.permission);
      void poll();
    }, 0);
    const timer = window.setInterval(() => void poll(), POLL_INTERVAL_MS);
    const onFocus = () => void poll();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearTimeout(permissionTimer);
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
    };
  }, [poll]);

  async function enableSystemNotifications() {
    if (!("Notification" in window)) return;
    setPermission(await Notification.requestPermission());
  }

  function dismiss(id: number) {
    setReminders(current => current.filter(reminder => reminder.id !== id));
  }

  return (
    <aside
      aria-label="Уведомления о напоминаниях"
      className="fixed right-4 bottom-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-3"
    >
      {permission === "default" && (
        <div className="pixel-panel bg-card flex items-center gap-3 p-3 shadow-lg">
          <Bell className="text-primary size-5 shrink-0" />
          <p className="min-w-0 flex-1 text-sm">Разрешите системные уведомления о напоминаниях.</p>
          <Button size="sm" onClick={() => void enableSystemNotifications()}>
            Включить
          </Button>
        </div>
      )}

      {reminders.map(reminder => (
        <div
          key={reminder.id}
          role="status"
          className="pixel-panel border-primary/40 bg-card flex items-start gap-3 p-4 shadow-lg"
        >
          <BellRing className="text-primary mt-0.5 size-5 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-mono text-xs tracking-wider uppercase">Напоминание</p>
            <p className="mt-1 text-sm font-medium break-words">{reminder.description}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Закрыть напоминание"
            onClick={() => dismiss(reminder.id)}
          >
            <X className="size-4" />
          </Button>
        </div>
      ))}
    </aside>
  );
}
