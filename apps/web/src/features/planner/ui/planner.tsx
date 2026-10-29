"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
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
const kindIcons = { task: CheckCheck, meeting: CalendarDays, reminder: Bell };
const kindFilters: { value: "all" | EntryKind; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "task", label: "Задачи" },
  { value: "meeting", label: "Встречи" },
  { value: "reminder", label: "Напоминания" },
];

const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}` +
  `-${String(date.getDate()).padStart(2, "0")}`;
const addDays = (date: Date, days: number) => {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
};
const selectClass = "border-border bg-input text-foreground h-9 border-2 px-3 font-mono text-xs";
const entryDateFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const entryDateFormatYear = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const dayFormat = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** Компактный срок записи: год показываем только если он отличается от текущего. */
function formatEntryDate(iso: string, now: Date) {
  const date = new Date(iso);
  const format = date.getFullYear() === now.getFullYear() ? entryDateFormat : entryDateFormatYear;
  return format.format(date);
}

/** Сортирует по сроку: ближайшие первыми, записи без срока — в конце. */
function byDeadline(a: Entry, b: Entry) {
  if (a.date === null && b.date === null) return 0;
  if (a.date === null) return 1;
  if (b.date === null) return -1;
  return a.date.localeCompare(b.date);
}

interface PlanGroup {
  /** Стабильный ключ группы для React. */
  key: string;
  /** Заголовок группы в списке. */
  label: string;
  /** Записи, попавшие в группу. */
  items: Entry[];
}

/** Раскладывает записи планов по срокам, чтобы список читался сверху вниз. */
function planGroups(items: Entry[], now: Date): PlanGroup[] {
  const today = dateKey(now);
  const tomorrow = dateKey(addDays(now, 1));
  const weekEnd = dateKey(addDays(now, 7));
  const buckets = {
    overdue: [] as Entry[],
    today: [] as Entry[],
    tomorrow: [] as Entry[],
    week: [] as Entry[],
    later: [] as Entry[],
    none: [] as Entry[],
  };

  for (const item of items) {
    if (item.date === null) {
      buckets.none.push(item);
      continue;
    }
    if (new Date(item.date) < now) {
      buckets.overdue.push(item);
      continue;
    }
    const day = item.date.slice(0, 10);
    if (day === today) buckets.today.push(item);
    else if (day === tomorrow) buckets.tomorrow.push(item);
    else if (day < weekEnd) buckets.week.push(item);
    else buckets.later.push(item);
  }

  return [
    { key: "overdue", label: "Просрочено", items: buckets.overdue },
    { key: "today", label: "Сегодня", items: buckets.today },
    { key: "tomorrow", label: "Завтра", items: buckets.tomorrow },
    { key: "week", label: "На этой неделе", items: buckets.week },
    { key: "later", label: "Позже", items: buckets.later },
    { key: "none", label: "Без срока", items: buckets.none },
  ].filter(group => group.items.length > 0);
}

interface EntryCardProps {
  /** Запись для отображения. */
  entry: Entry;
  /** Текущее время для подсветки просроченных записей. */
  now: Date;
}

/** Карточка записи: тип, срок и отметка просрочки. */
function EntryCard({ entry, now }: EntryCardProps) {
  const Icon = kindIcons[entry.kind];
  const overdue = entry.date !== null && new Date(entry.date) < now;

  return (
    <article className="pixel-panel flex items-start gap-3 p-4">
      <span className="bg-primary/15 text-primary flex size-9 shrink-0 items-center justify-center">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-foreground text-sm font-bold break-words">{entry.title}</p>
        <p className="text-muted-foreground mt-1 font-mono text-[0.7rem] tracking-wider uppercase">
          {kinds[entry.kind]} · {entry.date ? formatEntryDate(entry.date, now) : "Без срока"}
        </p>
      </div>
      {overdue && (
        <span className="text-destructive border-destructive/40 shrink-0 border px-2 py-1 font-mono text-[0.6rem] tracking-wider uppercase">
          Просрочено
        </span>
      )}
    </article>
  );
}

interface PlannerProps {
  /** Раздел дашборда, определяет фильтр записей и заголовок. */
  section: Section;
}

/**
 * Экран планировщика ('use client': данные профиля с backend, календарь месяца,
 * фильтры по типам и периодам). Записи создаются ассистентом, поэтому
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
  const [kind, setKind] = useState<"all" | EntryKind>("all");
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
  const kindFilter: EntryKind | undefined = kindForSection ?? (kind === "all" ? undefined : kind);
  const calendarEntries = kindFilter ? entries.filter(entry => entry.kind === kindFilter) : entries;
  const filtered = entries
    .filter(item => {
      if (kindFilter && item.kind !== kindFilter) return false;
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
        if (period === "tomorrow") return item.date?.slice(0, 10) === dateKey(addDays(now, 1));
        if (period === "week") {
          const end = addDays(now, 7);
          return item.date !== null && item.date.slice(0, 10) >= today && new Date(item.date) < end;
        }
      }
      return true;
    })
    .sort(byDeadline);

  const countOf = (value: "all" | EntryKind) =>
    value === "all" ? entries.length : entries.filter(entry => entry.kind === value).length;

  const tabs = [
    ["active", section === "reminders" ? "Ближайшие" : "Предстоящие"],
    ["past", "Прошедшие"],
  ];
  const start = new Date(month);
  start.setDate(1 - ((month.getDay() + 6) % 7));

  const groups = section === "plans" && !calendar ? planGroups(filtered, now) : [];
  const listTitle =
    section === "search"
      ? "Результаты поиска"
      : section === "plans" && calendar
        ? dayFormat.format(new Date(`${selected}T12:00`))
        : "Записи";

  return (
    <section className="mx-auto max-w-5xl space-y-5 p-2 pb-10 md:p-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-pixel text-foreground text-2xl sm:text-3xl">{titles[section]}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={cn("size-4", refreshing && "animate-spin")} />
            Обновить
          </Button>
          {section !== "search" && (
            <Button size="sm" asChild>
              <Link href="/chat">
                <Sparkles className="size-4" />
                Создать в чате
              </Link>
            </Button>
          )}
        </div>
      </header>

      {error && (
        <p role="alert" className="text-destructive font-mono text-sm">
          {error}
        </p>
      )}

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

      {section === "plans" && (
        <div className="flex flex-wrap gap-2" aria-label="Фильтр по типу">
          {kindFilters.map(({ value, label }) => (
            <Button
              key={value}
              size="sm"
              aria-pressed={kind === value}
              variant={kind === value ? "default" : "outline"}
              onClick={() => setKind(value)}
            >
              {label}
              <span className="font-mono text-[0.7rem] opacity-70">{countOf(value)}</span>
            </Button>
          ))}
        </div>
      )}

      {kindForSection && (
        <div className="flex flex-wrap gap-2" aria-label="Фильтр записей">
          {tabs.map(([value, label]) => (
            <Button
              key={value}
              size="sm"
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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={!calendar ? "default" : "outline"}
              aria-pressed={!calendar}
              onClick={() => setCalendar(false)}
            >
              <List className="size-4" />
              Список
            </Button>
            <Button
              size="sm"
              variant={calendar ? "default" : "outline"}
              aria-pressed={calendar}
              onClick={() => setCalendar(true)}
            >
              <CalendarDays className="size-4" />
              Календарь
            </Button>
          </div>
          {!calendar && (
            <label className="flex items-center gap-2">
              <span className="text-muted-foreground font-mono text-[0.7rem] tracking-wider uppercase">
                Период
              </span>
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
            </label>
          )}
        </div>
      )}

      {section === "plans" && calendar && (
        <div className="pixel-panel overflow-x-auto">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b-2 border-black/40 p-3">
              <h2 className="font-pixel text-foreground text-sm capitalize">
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
                  size="sm"
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
                <div
                  key={day}
                  className="text-muted-foreground border-border border-b p-2 text-center font-mono text-[0.7rem] uppercase"
                >
                  {day}
                </div>
              ))}
              {Array.from({ length: 42 }, (_, index) => {
                const day = new Date(start);
                day.setDate(start.getDate() + index);
                const key = dateKey(day);
                const count = calendarEntries.filter(
                  item => item.date?.slice(0, 10) === key,
                ).length;
                return (
                  <Button
                    key={key}
                    variant="ghost"
                    aria-pressed={selected === key}
                    aria-label={`${day.toLocaleDateString("ru-RU")}, записей: ${count}`}
                    aria-current={key === today ? "date" : undefined}
                    onClick={() => setSelected(key)}
                    className={cn(
                      "border-border h-11 min-w-0 flex-col gap-1 border-t p-0 font-mono text-xs sm:h-12",
                      day.getMonth() !== month.getMonth() && "text-muted-foreground/50",
                      selected === key && "bg-accent text-accent-foreground",
                      key === today && "text-primary font-bold underline underline-offset-4",
                    )}
                  >
                    <span className="font-mono">{day.getDate()}</span>
                    {count > 0 && (
                      <span className="font-mono text-[0.6rem] opacity-70">{count}</span>
                    )}
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {groups.length > 0 ? (
          groups.map(group => (
            <section key={group.key} className="space-y-2">
              <div className="flex items-baseline gap-2">
                <h2 className="font-pixel text-foreground text-sm">{group.label}</h2>
                <span className="text-muted-foreground font-mono text-xs">
                  {group.items.length}
                </span>
              </div>
              <div className="space-y-2">
                {group.items.map(item => (
                  <EntryCard key={item.id} entry={item} now={now} />
                ))}
              </div>
            </section>
          ))
        ) : filtered.length === 0 ? (
          <div className="pixel-panel px-6 py-14 text-center">
            <CalendarDays className="text-muted-foreground mx-auto mb-3 size-8" />
            <p className="font-pixel text-foreground text-sm">
              {section === "search"
                ? "Ничего не найдено"
                : section === "plans" && calendar
                  ? "На этот день ничего нет"
                  : section === "plans" && entries.length > 0
                    ? "За выбранный период ничего нет"
                    : "Пока нет записей"}
            </p>
            <p className="text-muted-foreground mt-2 font-mono text-xs leading-relaxed">
              {section === "search"
                ? "Попробуйте другое слово из названия."
                : section === "plans" && entries.length > 0
                  ? "Смените период или тип записи."
                  : "Попросите ассистента создать задачу, встречу или напоминание."}
            </p>
            {section !== "search" && (
              <Button size="sm" className="mt-4" asChild>
                <Link href="/chat">
                  <Sparkles className="size-4" />
                  Создать в чате
                </Link>
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="flex items-baseline gap-2">
              <h2
                className={cn(
                  "text-foreground text-sm",
                  section === "plans" && calendar
                    ? "font-mono font-bold tracking-wide uppercase"
                    : "font-pixel",
                )}
              >
                {listTitle}
              </h2>
              <span className="text-muted-foreground font-mono text-xs">{filtered.length}</span>
            </div>
            <div className="space-y-2">
              {filtered.map(item => (
                <EntryCard key={item.id} entry={item} now={now} />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
