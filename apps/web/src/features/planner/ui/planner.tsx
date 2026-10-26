"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, List, Plus, Search, Sparkles, ArrowUpRight, CheckCheck, Bell } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { cn } from "@/shared/lib/cn";

type Kind = "task" | "meeting" | "reminder";
type Entry = { id: string; title: string; kind: Kind; date: string; done: boolean };
type Section = "plans" | "tasks" | "meetings" | "reminders" | "search" | "settings";
const titles = {
  plans: "Мои планы", tasks: "Задачи", meetings: "Встречи", reminders: "Напоминания",
  search: "Поиск", settings: "Настройки",
};
const kinds = { task: "Задача", meeting: "Встреча", reminder: "Напоминание" };
const storageKey = "ai-assistant-planner-v1";
const dateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}` +
  `-${String(date.getDate()).padStart(2, "0")}`;
const selectClass = "h-9 rounded-md border bg-background px-3 text-sm";

function isEntry(value: unknown): value is Entry {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<Entry>;
  return typeof item.id === "string" && typeof item.title === "string" &&
    (item.kind === "task" || item.kind === "meeting" || item.kind === "reminder") &&
    typeof item.date === "string" && Number.isFinite(Date.parse(item.date)) &&
    typeof item.done === "boolean";
}

export function Planner({ section }: { section: Section }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [now, setNow] = useState<Date | null>(null);
  const [month, setMonth] = useState<Date | null>(null);
  const [selected, setSelected] = useState("");
  const [calendar, setCalendar] = useState(false);
  const [tab, setTab] = useState("active");
  const [period, setPeriod] = useState("all");
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState("");
  const [kind, setKind] = useState<Kind>("task");
  const [voice, setVoice] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect --
       дата устройства и localStorage доступны только после гидрации */
    const today = new Date();
    setNow(today);
    setMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelected(dateKey(today));
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(storageKey) ?? "[]");
      if (Array.isArray(saved) && saved.every(isEntry)) setEntries(saved);
      else setError("Не удалось прочитать сохранённые записи.");
      setVoice(localStorage.getItem("ai-assistant-voice") === "true");
    } catch { setError("Хранилище браузера недоступно или данные повреждены."); }
    setReady(true);
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => window.clearInterval(timer);
  }, []);

  function save(next: Entry[]) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
      setEntries(next);
      setError("");
      return true;
    } catch {
      setError("Не удалось сохранить изменения. Проверьте доступ к хранилищу браузера.");
      return false;
    }
  }

  if (!ready || !now || !month) {
    return <p className="p-8 text-muted-foreground">Загрузка…</p>;
  }

  const today = dateKey(now);
  const type: Kind | undefined = section === "tasks" ? "task" :
    section === "meetings" ? "meeting" : section === "reminders" ? "reminder" : undefined;
  const filtered = entries.filter((item) => {
    if (type && item.kind !== type) return false;
    if (section === "tasks") {
      if (tab === "done" ? !item.done : item.done) return false;
      if (tab === "overdue" && new Date(item.date) >= now) return false;
    }
    if (section === "meetings" || section === "reminders") {
      if ((new Date(item.date) < now) !== (tab === "past")) return false;
    }
    if (section === "search") {
      return item.title.toLocaleLowerCase("ru").includes(query.trim().toLocaleLowerCase("ru"));
    }
    if (section === "plans") {
      if (calendar) return item.date.slice(0, 10) === selected;
      if (period === "today") return item.date.slice(0, 10) === today;
      if (period === "tomorrow") {
        const next = new Date(now);
        next.setDate(next.getDate() + 1);
        return item.date.slice(0, 10) === dateKey(next);
      }
      if (period === "week") {
        const end = new Date(now);
        end.setDate(end.getDate() + 7);
        return item.date.slice(0, 10) >= today && new Date(item.date) < end;
      }
    }
    return true;
  }).sort((a, b) => a.date.localeCompare(b.date));

  const tabs = section === "tasks"
    ? [["active", "Активные"], ["overdue", "Просроченные"], ["done", "Выполненные"]]
    : [["active", section === "reminders" ? "Ближайшие" : "Предстоящие"],
      ["past", section === "reminders" ? "Прошедшие" : "Прошедшие"]];
  const start = new Date(month);
  start.setDate(1 - (month.getDay() + 6) % 7);

  return (
    <section className="mx-auto max-w-6xl space-y-6 p-2 pb-10 md:p-6">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-primary">Личное пространство</p>
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{titles[section]}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {section === "settings" ? "Параметры ассистента" :
              "Задачи, встречи и напоминания в одном месте"}
          </p>
        </div>
        {section !== "settings" && section !== "search" && (
          <Button onClick={() => { setKind(type ?? "task"); setAdding(!adding); }}>
            <Plus className="size-4" />Добавить запись
          </Button>
        )}
      </header>
      {section === "plans" && <>
        <div className="relative overflow-hidden rounded-3xl border border-border bg-card/70 p-6 shadow-xl shadow-primary/5 backdrop-blur-xl md:p-8">
          <div aria-hidden="true" className="absolute -right-16 -top-20 size-72 rounded-full border-[35px] border-primary/15" />
          <div className="relative max-w-lg">
            <span className="inline-flex items-center gap-2 rounded-full border bg-card/70 px-3 py-1 text-xs text-muted-foreground">
              <Sparkles className="size-3.5 text-primary" /> Ваш день · под контролем
            </span>
            <h2 className="mt-5 text-3xl font-medium leading-tight tracking-tight md:text-4xl">
              Всё важное<br /><span className="text-primary">в одном месте.</span>
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Планы, задачи и встречи. Просто и без лишнего.
            </p>
            <Button asChild variant="outline" className="mt-5 bg-card/70">
              <Link href="/chat">Открыть ассистента <ArrowUpRight className="size-4" /></Link>
            </Button>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { label: "Задачи в работе", count: entries.filter(e => e.kind === "task" && !e.done).length,
              icon: CheckCheck },
            { label: "Предстоящие встречи", count: entries.filter(e => e.kind === "meeting" &&
              new Date(e.date) >= now).length, icon: CalendarDays },
            { label: "Ближайшие напоминания", count: entries.filter(e => e.kind === "reminder" &&
              new Date(e.date) >= now).length, icon: Bell },
          ].map(({ label, count, icon: Icon }) => <div key={label}
            className="flex items-center gap-4 rounded-2xl border border-border bg-card/70 p-5">
            <span className="rounded-xl bg-primary/10 p-3 text-primary"><Icon className="size-5" /></span>
            <div><p className="text-2xl font-semibold">{count}</p>
              <p className="text-xs text-muted-foreground">{label}</p></div>
          </div>)}
        </div>
      </>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {section === "settings" ? (
        <div className="space-y-5 rounded-3xl border border-border bg-card/70 p-6 shadow-sm">
          <div>
            <p className="font-medium">Часовой пояс</p>
            <p className="text-sm text-muted-foreground">
              {Intl.DateTimeFormat().resolvedOptions().timeZone} · используется время устройства
            </p>
          </div>
          <label className="flex items-center gap-3">
            <input type="checkbox" checked={voice} onChange={(event) => {
              try {
                localStorage.setItem("ai-assistant-voice", String(event.target.checked));
                setVoice(event.target.checked);
              } catch { setError("Не удалось сохранить настройку."); }
            }} />
            Голосовые ответы
          </label>
          <p className="text-sm text-muted-foreground">
            Предпочтение сохраняется. Озвучивание станет доступно после подключения ассистента.
          </p>
        </div>
      ) : <>
        <p className="rounded-2xl border border-border bg-card/70 px-4 py-3 text-xs text-muted-foreground">
          Записи сохраняются в этом браузере. Голосовой ассистент и уведомления пока не подключены.
        </p>
        {adding && <form className="space-y-4 rounded-3xl border bg-card/70 p-6 shadow-lg shadow-primary/5" onSubmit={(event) => {
          event.preventDefault();
          if (!title.trim() || !date || !Number.isFinite(Date.parse(date))) return;
          if (save([...entries, { id: crypto.randomUUID(), title: title.trim(),
            kind, date, done: false }])) {
            setTitle(""); setDate(""); setAdding(false);
          }
        }}>
          <h2 className="font-semibold">Новая запись</h2>
          <label className="block space-y-2 text-sm">Название
            <Input required maxLength={200} value={title}
              onChange={(event) => setTitle(event.target.value)} placeholder="Например, встреча с командой" />
          </label>
          <div className="flex flex-wrap gap-4">
            <label className="space-y-2 text-sm">Тип
              <select className={cn(selectClass, "block")} value={kind}
                onChange={(event) => setKind(event.target.value as Kind)}>
                {Object.entries(kinds).map(([value, label]) =>
                  <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
            <label className="space-y-2 text-sm">Дата и время
              <Input required type="datetime-local" value={date}
                onChange={(event) => setDate(event.target.value)} />
            </label>
          </div>
          <div className="flex gap-2">
            <Button type="submit">Сохранить</Button>
            <Button type="button" variant="ghost" onClick={() => setAdding(false)}>Отмена</Button>
          </div>
        </form>}
        {section === "search" && <label className="flex items-center gap-3">
          <Search className="size-5 shrink-0 text-muted-foreground" />
          <Input aria-label="Поиск записей" placeholder="Найти задачу, встречу или напоминание…"
            value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>}
        {type && <div className="flex flex-wrap gap-2" aria-label="Фильтр записей">
          {tabs.map(([value, label]) => <Button key={value} aria-pressed={tab === value}
            variant={tab === value ? "default" : "outline"} onClick={() => setTab(value)}>
            {label}
          </Button>)}
        </div>}
        {section === "plans" && <div className="flex flex-wrap justify-between gap-3">
          <div className="flex gap-2">
            <Button variant={!calendar ? "default" : "outline"} aria-pressed={!calendar}
              onClick={() => setCalendar(false)}><List className="size-4" />Список</Button>
            <Button variant={calendar ? "default" : "outline"} aria-pressed={calendar}
              onClick={() => setCalendar(true)}><CalendarDays className="size-4" />Календарь</Button>
          </div>
          {!calendar && <select aria-label="Период" className={selectClass} value={period}
            onChange={(event) => setPeriod(event.target.value)}>
            <option value="all">Все записи</option><option value="today">Сегодня</option>
            <option value="tomorrow">Завтра</option><option value="week">Ближайшие 7 дней</option>
          </select>}
        </div>}
        {section === "plans" && calendar && <div className="overflow-x-auto rounded-3xl border border-border bg-card/70 shadow-lg shadow-primary/5 backdrop-blur-xl">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b p-3 sm:p-4">
              <h2 className="font-semibold capitalize">
                {month.toLocaleDateString("ru-RU", { month: "long", year: "numeric" })}
              </h2>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" aria-label="Предыдущий месяц"
                  onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
                  <ChevronLeft className="size-4" />
                </Button>
                <Button variant="outline" onClick={() => {
                  setMonth(new Date(now.getFullYear(), now.getMonth(), 1)); setSelected(today);
                }}>Сегодня</Button>
                <Button variant="ghost" size="icon" aria-label="Следующий месяц"
                  onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-7">
              {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map(day =>
                <div key={day} className="p-3 text-center text-xs text-muted-foreground">{day}</div>)}
              {Array.from({ length: 42 }, (_, index) => {
                const day = new Date(start);
                day.setDate(start.getDate() + index);
                const key = dateKey(day);
                const count = entries.filter(item => item.date.slice(0, 10) === key).length;
                return <Button key={key} variant="ghost" aria-pressed={selected === key}
                  aria-label={`${day.toLocaleDateString("ru-RU")}, записей: ${count}`}
                  aria-current={key === today ? "date" : undefined}
                  onClick={() => setSelected(key)}
                  className={cn("h-16 min-w-0 flex-col gap-1 rounded-none border-t p-0 text-xs sm:h-20 sm:text-sm",
                    day.getMonth() !== month.getMonth() && "text-muted-foreground",
                    selected === key && "bg-accent ring-1 ring-inset ring-ring",
                    key === today && "font-bold underline underline-offset-4")}>
                  <span>{day.getDate()}</span>
                  {count > 0 && <span className="text-xs">{count} зап.</span>}
                </Button>;
              })}
            </div>
          </div>
        </div>}
        <div className="space-y-3">
          <h2 className="font-semibold">
            {calendar && section === "plans"
              ? new Date(`${selected}T12:00`).toLocaleDateString("ru-RU", {
                day: "numeric", month: "long", year: "numeric",
              }) : section === "search" ? "Результаты поиска" : "Записи"}
            <span className="ml-2 text-sm font-normal text-muted-foreground">{filtered.length}</span>
          </h2>
          {filtered.length === 0 && <div className="rounded-3xl border border-border bg-card/70 px-6 py-16 text-center">
            <CalendarDays className="mx-auto mb-3 size-8 text-muted-foreground" />
            <p className="font-medium">{section === "search" ? "Ничего не найдено" : "Пока нет записей"}</p>
            <p className="mt-2 text-sm text-muted-foreground">
              {section === "search" ? "Попробуйте другое слово из названия." :
                "Добавьте запись или выберите другой период."}
            </p>
          </div>}
          {filtered.map(item => <article key={item.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card/70 p-5 shadow-sm transition-shadow hover:shadow-md">
            <div className="min-w-0">
              <p className={cn("break-words font-medium", item.done && "line-through text-muted-foreground")}>
                {item.title}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                {kinds[item.kind]} · {new Date(item.date).toLocaleString("ru-RU", {
                  day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", year: "numeric",
                })}
              </p>
            </div>
            {item.kind === "task" && <Button variant="outline" size="sm"
              onClick={() => save(entries.map(entry => entry.id === item.id
                ? { ...entry, done: !entry.done } : entry))}>
              {item.done ? "Вернуть в активные" : "Выполнено"}
            </Button>}
          </article>)}
        </div>
      </>}
    </section>
  );
}
