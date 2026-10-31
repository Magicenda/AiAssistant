import { Bell, CalendarDays } from "lucide-react";

/** Задержки квадратиков индикатора набора: волна бежит слева направо. */
const TYPING_DELAYS = [0, 180, 360];

/** Задержки столбиков эквалайзера: чем дальше от края, тем позже всплеск. */
const EQ_DELAYS = Array.from({ length: 14 }, (_, index) => `${index * 80}ms`);

/**
 * Пиксельное окно диалога для лендинга (Server Component).
 * Спрайт ассистента, эквалайзер и сканлайны живут на CSS-анимациях,
 * поэтому секция остаётся статической и не тянет клиентский JS.
 *
 * @returns Декоративную сцену с окном чата и плавающими карточками.
 */
export function LandingTerminal() {
  return (
    <div
      aria-hidden="true"
      className="landing-terminal relative mx-auto w-full max-w-sm sm:max-w-md xl:max-w-none"
    >
      {/* Орбита: квадраты перескакивают по периметру окна рывками. */}
      <div className="landing-orbit pointer-events-none absolute -inset-5">
        <span className="bg-primary absolute top-0 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2" />
        <span className="bg-secondary absolute top-1/2 left-0 size-1.5 -translate-x-1/2 -translate-y-1/2" />
        <span className="bg-primary/50 absolute right-0 bottom-1/4 size-1.5 translate-x-1/2" />
      </div>

      {/* Календарь и напоминание выглядывают из-за окна: намёк на планировщик. */}
      <div className="landing-chip pixel-panel text-primary bg-card absolute -top-4 right-2 z-10 flex size-11 items-center justify-center sm:-right-4">
        <CalendarDays className="size-5" />
      </div>
      <div className="landing-chip landing-chip--late pixel-panel text-secondary bg-card absolute -bottom-4 left-2 z-10 flex size-11 items-center justify-center sm:-left-4">
        <Bell className="size-5" />
      </div>

      <div className="pixel-panel bg-card relative p-2.5">
        {/* Шапка окна: квадраты вместо кнопок и бегущая полоска статуса. */}
        <div className="flex items-center gap-1.5 px-1 pb-2">
          <span className="bg-secondary size-2" />
          <span className="bg-primary size-2" />
          <span className="bg-foreground/25 size-2" />
          <span className="bg-border ml-auto h-1 w-20" />
        </div>

        <div className="pixel-frame bg-background relative overflow-hidden p-3 sm:p-4">
          {/* Сканлайны и светящаяся развёртка делают экран похожим на ЭЛТ. */}
          <span className="landing-scan pointer-events-none absolute inset-0 z-10" />

          {/* Сообщение пользователя: плашки вместо текста, чтобы не дублировать копию. */}
          <div className="border-secondary/70 bg-secondary/10 relative ml-auto w-3/4 border-2 px-3 py-2">
            <span className="bg-foreground/70 block h-1.5 w-full" />
            <span className="bg-foreground/40 mt-1.5 block h-1.5 w-2/3" />
          </div>

          {/* Ответ ассистента: спрайт моргает, а строки продолжают «печататься». */}
          <div className="relative mt-4 flex items-start gap-2">
            <span className="pixel-frame bg-card flex size-10 shrink-0 items-center justify-center p-1.5">
              <svg
                viewBox="2 0 28 24"
                shapeRendering="crispEdges"
                className="landing-bot size-full"
              >
                {/* Антенна: лампочка сигналит, что ассистент работает. */}
                <g className="landing-bot__antenna">
                  <rect x="15" y="2" width="2" height="2" />
                  <rect className="landing-bot__led" x="13" y="0" width="6" height="2" />
                </g>

                {/* Голова с «наушниками» по бокам. */}
                <g className="landing-bot__head">
                  <rect x="9" y="4" width="14" height="2" />
                  <rect x="6" y="6" width="20" height="14" />
                  <rect x="8" y="20" width="16" height="2" />
                  <rect x="11" y="22" width="10" height="1" />
                  <rect x="3" y="10" width="2" height="8" />
                  <rect x="27" y="10" width="2" height="8" />
                </g>

                <rect className="landing-bot__face" x="8" y="8" width="16" height="10" />

                <g className="landing-bot__eyes">
                  <rect x="12" y="10" width="2" height="2" />
                  <rect x="18" y="10" width="2" height="2" />
                </g>

                {/* Рот — столбики эквалайзера, как в голосовом режиме. */}
                <g className="landing-bot__mouth">
                  <rect x="9" y="16" width="2" height="1" />
                  <rect x="12" y="15" width="2" height="2" />
                  <rect x="15" y="14" width="2" height="3" />
                  <rect x="18" y="15" width="2" height="2" />
                  <rect x="21" y="16" width="2" height="1" />
                </g>
              </svg>
            </span>

            <div className="border-border bg-card min-w-0 flex-1 border-2 px-3 py-2">
              <span className="bg-foreground/75 block h-1.5 w-full" />
              <span className="bg-foreground/45 mt-1.5 block h-1.5 w-4/5" />
              <span className="bg-primary mt-1.5 block h-1.5 w-1/2" />

              <div className="mt-2 flex items-center gap-1">
                {TYPING_DELAYS.map(delay => (
                  <span
                    key={delay}
                    className="landing-typing bg-primary size-1.5"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
                <span className="bg-primary pixel-blink ml-auto size-1.5" />
              </div>
            </div>
          </div>
        </div>

        {/* Нижняя панель: живой эквалайзер и индикаторы связи. */}
        <div className="flex items-end justify-between gap-3 px-1 pt-2">
          <div className="flex h-5 items-end gap-1">
            {EQ_DELAYS.map(delay => (
              <span
                key={delay}
                className="landing-eq bg-secondary w-1"
                style={{ animationDelay: delay }}
              />
            ))}
          </div>
          <div className="flex gap-1">
            <span className="bg-primary size-1.5" />
            <span className="bg-primary/50 size-1.5" />
            <span className="bg-border size-1.5" />
          </div>
        </div>
      </div>
    </div>
  );
}
