# AiAssistant — Frontend

Next.js 16 (App Router) + Tailwind CSS v4 + shadcn/ui + bun. Монорепо, фронтенд целиком живёт в `apps/web/` (свой `package.json`, `bun.lock`, `node_modules`).

Требуется Bun 1.4.4+ (зафиксирован в `packageManager` и `engines` корневого `package.json`). Lockfile в формате `lockfileVersion: 2` старые версии bun не читают.

> Фронтенд изолирован от остальных стеков монорепы: все JS-зависимости и `bun.lock` — внутри `apps/web`.

## Quick start

```bash
cd apps/web          # фронтенд-контекст: deps, bun.lock, AGENTS.md, components.json — всё здесь
bun install
bun dev              # http://localhost:3000
```

Скрипты-шорткаты из корня монорепы (пробрасывают в `apps/web`): `bun dev`, `bun build`, `bun typecheck` — работают и без `workspaces` в корневом package.json, чтобы не мешать другим стекам.

Полезные команды (запуск из корня):

| Команда | Что делает |
| --- | --- |
| `bun dev` | Next dev server (Turbopack) |
| `bun build` | production build |
| `bun typecheck` | `tsc --noEmit` |
| `bun lint` | ESLint (`eslint-config-next`, flat config) |

Добавление shadcn-компонента: `cd apps/web && bunx shadcn@latest add button`. Компонент упадёт в `src/shared/ui/`.

Правила для AI-редакторов: `apps/web/AGENTS.md` (Cursor/Windsurf читают его относительно этой папки — не тащить фронтенд-правила вверх, монорепа мультистековая).

## Планировщик

В личном кабинете доступны ассистент (`/chat`), мои планы (`/plans`), задачи
(`/tasks`), встречи (`/meetings`), напоминания (`/reminders`), поиск (`/search`),
профиль и настройки (`/settings`). В «Мои планы» можно переключаться между списком
и календарём: выбрать месяц и день, посмотреть записи на выбранную дату.

Записи создаются кнопкой «Добавить» и сохраняются в localStorage текущего браузера.
Задачи можно отмечать выполненными; встречи и напоминания разделяются по времени.
Поиск работает по вхождению текста в название, включая прошедшие записи.
Чаты можно создавать и выбирать в боковом меню; история хранится в localStorage.
Кнопка микрофона записывает аудио через MediaRecorder. Повторное нажатие завершает
запись: её можно прослушать, скачать, удалить или отправить на сервер.
Нужны HTTPS (или localhost) и разрешение на микрофон. Формат выбирается по поддержке
браузера: WebM/Opus, MP4 или Ogg/Opus; файл сохраняет реальный MIME-тип.

Для подключения бэкенда задайте в `apps/web/.env.local` и перезапустите dev server
(для production потребуется пересборка):

```dotenv
NEXT_PUBLIC_AUDIO_UPLOAD_URL=https://your-backend.example/audio
NEXT_PUBLIC_AUDIO_UPLOAD_MODE=multipart
NEXT_PUBLIC_AUDIO_UPLOAD_FIELD=file
```

По умолчанию POST отправляет бинарный File в multipart/form-data в поле `file`.
Если бэкенд ожидает бинарное тело, укажите `NEXT_PUBLIC_AUDIO_UPLOAD_MODE=binary`:
тело запроса будет содержать сам файл, Content-Type — реальный MIME-тип записи.
Content-Type для multipart выставляет браузер вместе с boundary. При другом origin
бэкенд должен разрешать CORS. URL, авторизацию и контракт ответа нужно согласовать
с бэкендом; пока URL не задан, запись доступна для прослушивания и скачивания,
а отправка показывает сообщение о недостающей настройке. Ошибка загрузки сохраняет
файл для повторной попытки. Аудио не записывается в localStorage и не восстанавливается
после перезагрузки. Успешная отправка означает HTTP 2xx, ответ пока не обрабатывается.

Светлая и тёмная темы переключаются в меню и настройках; выбор сохраняется.
Семантический поиск, серверное хранение, ответы AI, выполнение голосовых команд,
доставка уведомлений и озвучивание ответов пока не подключены. Настройка голосовых ответов сохраняет
только предпочтение пользователя. Используется часовой пояс устройства.

## Структура (облегчённый FSD)

```
apps/web/src/
├── app/                # ТОЛЬКО роутинг: page.tsx импортирует View и рендерит
│   ├── (marketing)/    # Лендинг — владелец: dev #1
│   ├── (auth)/         # Вход/регистрация
│   └── (dashboard)/    # Чат + Профиль — владелец: dev #2
├── views/              # Экраны целиком: views/<screen>/{ui,index.ts}
├── widgets/            # Крупные блоки над страницей: header, sidebar
├── features/           # Пользовательские сценарии: auth-form, conversations, planner, theme
├── entities/           # Домен и типы: chat
└── shared/             # shadcn (ui/), либы (lib/), конфиги, типы
```

## Правила деления кода (чтобы не конфликтовать в Git)

| Код | Куда класть |
| --- | --- |
| Смена текста/вёрстки одной страницы | `views/<screen>/ui/*` (или сразу роут, если мелочь) |
| Компонент длиннее ~150 строк / участвует в нескольких экранах | `widgets/<имя>/` |
| Интерактив = сценарий (форма, отправка через API) | `features/<имя>/{ui,model,api,index.ts}` |
| Типы под фичу | рядом с фичей (`model/types.ts`), общие для ≥2 фич — `entities/<имя>/model/types.ts` |
| Запросы к API | `features/*` через функции; общий клиент — `shared/api/index.ts` |
| Настройки/константы/навигация | `shared/config/` |

Правила зависимостей (сверху вниз, не наоборот):

```
app → views → widgets → features → entities → shared
```

- Никогда не импортить «вверх» (из `shared` в `entities` нельзя; из `views` в другое `views` — желательно через фичу).
- Каждый slice экспортируется только через свой `index.ts` (public API).
- Роуты: `page.tsx` — 3–5 строк, только `import { XView } from "@/views/x"` + рендер.
- Работаем параллельно: каждый трогает свои `views/*` и роут. Общие файлы (`shared/*`, `app/layout.tsx`) меняем по договорённости.

## Tailwind CSS v4 — краткая шпаргалка

**Нет `tailwind.config.js`.** Вся конфигурация живёт в CSS — `src/app/globals.css`:

```css
@import "tailwindcss";        /* вместо @tailwind base/components/utilities */
@import "tw-animate-css";     /* анимации для shadcn */

@custom-variant dark (&:is(.dark *));  /* кастомный вариант */

:root { --primary: oklch(...); }        /* CSS-переменные (тема) */

@theme inline {                /* здесь регистрируются токены */
  --color-primary: var(--primary);      /* после этого работает класс bg-primary */
  --radius-lg: var(--radius);
}
```

- Новый design-token: заводишь CSS-переменную + маппишь её в `@theme inline` → получаешь автогенерированные утилиты (`--color-brand` → `bg-brand`, `text-brand`, …).
- Расширение классов/анимаций: `@utility` и обычный CSS больше не нуждаются в плагинах.
- Данные-специфичные варианты: `data-[state=open]:...` работает как в v3, кастомные — через `@custom-variant`.
- Проектор `postcss` уже настроен (`@tailwindcss/postcss` в `postcss.config.mjs`) — ничего дополнительно ставить не надо.
