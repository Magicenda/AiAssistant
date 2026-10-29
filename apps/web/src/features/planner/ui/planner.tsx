"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowUpRight,
  Bell,
  CalendarDays,
  CheckCheck,
  ChevronLeft,
  ChevronRight,
  List,
  RefreshCw,
  Search,
  Sparkles,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { ApiError } from "@/shared/api";
import { cn } from "@/shared/lib/cn";
import { fetchEntries, type Entry, type EntryKind } from "../model/entries";

type Section = "plans" | "tasks" | "meetings" | "reminders" | "search";
const titles = {
  plans: "Мои планы",
  tasks: "Задачи",
  meetings: "Встречи",
  reminders: "Напоминания",
  search: "Поиск",
};
const kinds = { task: "Задача", meeting: "Встреча", reminder: "Напоминание" };
const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}` +
  `-${String(date.getDate()).padStart(2, "0")}`;
const selectClass = "h-9 rounded-md border bg-background px-3 text-sm";
const dateFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  year: "numeric",
});

/** Сортирует по сроку: ближайшие первыми, записи без срока — в конце. */
function byDeadline(a: Entry, b: Entry) {
  if (a.date === null && b.date === null) return 0;
  if (a.date === null) return 1;
  if (b.date === null) return -1;
  return a.date.localeCompare(b.date);
}

interface PlannerProps {
  /** Раздел дашборда, определяет фильтр записей и заголовок. */
  section: Section;
}

/**
 * Экран планировщика ('use client': данные профиля с backend, календарь месяца,
 * фильтры по вкладкам и периодам). Записи создаются ассистентом, поэтому
 * список перезапрашивается при открытии раздела и по возврату фокуса.
 *
 * @param props - Пропсы компонента.
 * @returns Разметку раздела планировщика.
 */
export function Planner({ section }: PlannerProps) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState<Date | null>(null);
  const [month, setMonth] = useState<Date | null>(null);
  const [selected, setSelected] = useState("");
  const [calendar, setCalendar] = useState(false);
  const [tab, setTab] = useState("active");
  const [period, setPeriod] = useState("all");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    try {
      const next = await fetchEntries();
      setEntries(next);
      setError("");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Не удалось загрузить записи.");
    } finally {
      setReady(true);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect --
       дата устройства доступна только после гидрации */
    const today = new Date();
    setNow(today);
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelected(dateKey(today));
    /* eslint-enable react-hooks/set-state-in-effect */
    void load();
    const onRefresh = () => void load();
    window.addEventListener("chats-change", onRefresh);
    window.addEventListener("focus", onRefresh);
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => {
      window.removeEventListener("chats-change", onRefresh);
      window.removeEventListener("focus", onRefresh);
      window.clearInterval(timer);
    };
  }, [load]);

  function refresh() {
    setRefreshing(true);
    void load();
  }

  if (!ready || !now || !month) {
    return <p className="text-muted-foreground p-8">Загрузка…</p>;
  }

  const today = dateKey(now);
  const kindForSection: EntryKind | undefined =
    section === "tasks"
      ? "task"
      : section === "meetings"
        ? "meeting"
        : section === "reminders"
          ? "reminder"
          : undefined;
  const filtered = entries
    .filter(item => {
      if (kindForSection && item.kind !== kindForSection) return false;
      if (kindForSection) {
        const isPast = item.date !== null && new Date(item.date) < now;
        if (tab === "past" ? !isPast : isPast) return false;
      }
      if (section === "search") {
        return item.title.toLocaleLowerCase("ru").includes(query.trim().toLocaleLowerCase("ru"));
      }
      if (section === "plans") {
        if (calendar) return item.date?.slice(0, 10) === selected;
        if (period === "today") return item.date?.slice(0, 10) === today;
        if (period === "tomorrow") {
          const next = new Date(now);
          next.setDate(next.getDate() + 1);
          return item.date?.slice(0, 10) === dateKey(next);
        }
        if (period === "week") {
          const end = new Date(now);
          end.setDate(end.getDate() + 7);
          return item.date !== null && item.date.slice(0, 10) >= today && new Date(item.date) < end;
        }
      }
      return true;
    })
    .sort(byDeadline);

  const tabs = [
    ["active", section === "reminders" ? "Ближайшие" : "Предстоящие"],
    ["past", "Прошедшие"],
  ];
  const start = new Date(month);
  start.setDate(1 - ((month.getDay() + 6) % 7));
  const upcomingCount = (kind: EntryKind) =>
    entries.filter(entry => entry.kind === kind && (entry.date === null || new Date(entry.date) >= now))
      .length;

  return (
    <section className="mx-auto max-w-6xl space-y-6 p-2 pb-10 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-primary mb-3 text-xs font-semibold tracking-[0.2em] uppercase">
            Личное пространство
          </p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{titles[section]}</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Задачи, встречи и напоминания в одном месте
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
            Обновить
          </Button>
          {section !== "search" && (
            <Button asChild>
              <Link href="/chat">
                <Sparkles className="size-4" />
                Создать в чате
              </Link>
            </Button>
          )}
        </div>
      </header>
      {section === "plans" && (
        <>
          <div className="border-border bg-card/70 shadow-primary/5 relative overflow-hidden rounded-3xl border p-6 shadow-xl backdrop-blur-xl md:p-8">
            <div
              aria-hidden="true"
              className="border-primary/15 absolute -top-20 -right-16 size-72 rounded-full border-[35px]"
            />
            <div className="relative max-w-lg">
              <span className="bg-card/70 text-muted-foreground inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
                <Sparkles className="text-primary size-3.5" /> Ваш день · под контролем
              </span>
              <h2 className="mt-5 text-3xl leading-tight font-medium tracking-tight md:text-4xl">
                Всё важное
                <br />
                <span className="text-primary">в одном месте.</span>
              </h2>
              <p className="text-muted-foreground mt-4 max-w-sm text-sm leading-relaxed">
                Планы, задачи и встречи. Просто и без лишнего.
              </p>
              <Button asChild variant="outline" className="bg-card/70 mt-5">
                <Link href="/chat">
                  Открыть ассистента <ArrowUpRight className="size-4" />
                </Link>
              </Button>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "Задачи в работе", count: upcomingCount("task"), icon: CheckCheck },
              { label: "Предстоящие встречи", count: upcomingCount("meeting"), icon: CalendarDays },
              { label: "Ближайшие напоминания", count: upcomingCount("reminder"), icon: Bell },
            ].map(({ label, count, icon: Icon }) => (
              <div
                key={label}
                className="border-border bg-card/70 flex items-center gap-4 rounded-2xl border p-5"
              >
                <span className="bg-primary/10 text-primary rounded-xl p-3">
                  <Icon className="size-5" />
                </span>
                <div>
                  <p className="text-2xl font-semibold">{count}</p>
                  <p className="text-muted-foreground text-xs">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <>
        <p className="border-border bg-card/70 text-muted-foreground rounded-2xl border px-4 py-3 text-xs">
          Записи создаёт ассистент, они хранятся на сервере. Обновите список после диалога.
        </p>
        {section === "search" && (
          <label className="flex items-center gap-3">
            <Search className="text-muted-foreground size-5 shrink-0" />
            <Input
              aria-label="Поиск записей"
              placeholder="Найти задачу, встречу или напоминание…"
              value={query}
              onChange={event => setQuery(event.target.value)}
            />
          </label>
        )}
        {kindForSection && (
          <div className="flex flex-wrap gap-2" aria-label="Фильтр записей">
            {tabs.map(([value, label]) => (
              <Button
                key={value}
                aria-pressed={tab === value}
                variant={tab === value ? "default" : "outline"}
                onClick={() => setTab(value)}
              >
                {label}
              </Button>
            ))}
          </div>
        )}
        {section === "plans" && (
          <div className="flex flex-wrap justify-between gap-3">
            <div className="flex gap-2">
              <Button
                variant={!calendar ? "default" : "outline"}
                aria-pressed={!calendar}
                onClick={() => setCalendar(false)}
              >
                <List className="size-4" />
                Список
              </Button>
              <Button
                variant={calendar ? "default" : "outline"}
                aria-pressed={calendar}
                onClick={() => setCalendar(true)}
              >
                <CalendarDays className="size-4" />
                Календарь
              </Button>
            </div>
            {!calendar && (
              <select
                aria-label="Период"
                className={selectClass}
                value={period}
                onChange={event => setPeriod(event.target.value)}
              >
                <option value="all">Все записи</option>
                <option value="today">Сегодня</option>
                <option value="tomorrow">Завтра</option>
                <option value="week">Ближайшие 7 дней</option>
              </select>
            )}
          </div>
        )}
        {section === "plans" && calendar && (
          <div className="border-border bg-card/70 shadow-primary/5 overflow-x-auto rounded-3xl border shadow-lg backdrop-blur-xl">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3 sm:p-4">
                <h2 className="font-semibold capitalize">
                  {month.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}
                </h2>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Предыдущий месяц"
                    onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                  >
                    <ChevronLeft className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                      setSelected(today);
                    }}
                  >
                    Сегодня
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Следующий месяц"
                    onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                  >
                    <ChevronRight className="size-4" />
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-7">
                {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map(day => (
                  <div key={day} className="text-muted-foreground p-3 text-center text-xs">
                    {day}
                  </div>
                ))}
                {Array.from({ length: 42 }, (_, index) => {
                  const day = new Date(start);
                  day.setDate(start.getDate() + index);
                  const key = dateKey(day);
                  const count = entries.filter(item => item.date?.slice(0, 10) === key).length;
                  return (
                    <Button
                      key={key}
                      variant="ghost"
                      aria-pressed={selected === key}
                      aria-label={`${day.toLocaleDateString("ru-RU")}, записей: ${count}`}
                      aria-current={key === today ? "date" : undefined}
                      onClick={() => setSelected(key)}
                      className={cn(
                        "h-16 min-w-0 flex-col gap-1 rounded-none border-t p-0 text-xs sm:h-20 sm:text-sm",
                        day.getMonth() !== month.getMonth() && "text-muted-foreground",
                        selected === key && "bg-accent ring-ring ring-1 ring-inset",
                        key === today && "font-bold underline underline-offset-4",
                      )}
                    >
                      <span>{day.getDate()}</span>
                      {count > 0 && <span className="text-xs">{count} зап.</span>}
                    </Button>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        <div className="space-y-3">
          <h2 className="font-semibold">
            {calendar && section === "plans"
              ? new Date(`${selected}T12:00`).toLocaleDateString("ru-RU", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : section === "search"
                ? "Результаты поиска"
                : "Записи"}
            <span className="text-muted-foreground ml-2 text-sm font-normal">{filtered.length}</span>
          </h2>
          {filtered.length === 0 && (
            <div className="border-border bg-card/70 rounded-3xl border px-6 py-16 text-center">
              <CalendarDays className="text-muted-foreground mx-auto mb-3 size-8" />
              <p className="font-medium">
                {section === "search" ? "Ничего не найдено" : "Пока нет записей"}
              </p>
              <p className="text-muted-foreground mt-2 text-sm">
                {section === "search"
                  ? "Попробуйте другое слово из названия."
                  : "Попросите ассистента создать задачу, встречу или напоминание."}
              </p>
            </div>
          )}
          {filtered.map(item => (
            <article
              key={item.id}
              className="border-border bg-card/70 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="min-w-0">
                <p className="font-medium break-words">{item.title}</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  {kinds[item.kind]} ·{" "}
                  {item.date ? dateFormat.format(new Date(item.date)) : "Без срока"}
                </p>
              </div>
            </article>
          ))}
        </div>
      </>
    </section>
  );
}
