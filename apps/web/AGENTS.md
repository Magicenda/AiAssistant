# AGENTS.md

Инструкции для AI-редакторов (Cursor/Copilot/Windsurf) при работе с этим приложением.

## Архитектура

- Стек: Next.js 16 App Router + TypeScript strict + Tailwind v4 + shadcn/ui + lucide-react + bun.
- Слои (облегчённый FSD), зависимости разрешены только «вниз»:
  `app (роутинг) → views → widgets → features → entities → shared`.
  Запрещено: импорт из вышележащих слоёв, из `views` внутрь `views`.
- Каждый slice (`views/*`, `widgets/*`, `features/*`, `entities/*`) импортируется **только** через `index.ts` в его корне, а не напрямую из `ui/`.
- `app/**` — только роутинг: `page.tsx` не содержит вёрстки и логики, только импорт View-компонента из `views/`.
- Это **фронтенд-only** приложение: в нём нет API routes, работы с LLM-провайдером, ключами и транскрипцией. Всё это делает внешний backend.

## Backend API

- Адрес backend задаётся **только** через `NEXT_PUBLIC_API_URL` (по умолчанию `http://localhost:8000`). Значение инлайнится на этапе сборки; поля адреса сервера в UI не делать.
- Запросы к backend инкапсулированы в `features/assistant/model/client.ts`. Не разбрасывать `fetch` по компонентам.
- Настройки модели (провайдер, base URL, ключ, модель, температура) хранит пользователь в localStorage — `entities/model-settings`. Форма — `features/model-settings`.
- Эти настройки передаются backend в поле `model_settings` запроса `/llm/query` (JSON) и `/chat/transcribe` (multipart). Если модель не заполнена, поле не отправляется — backend использует свою конфигурацию.
- **Никаких секретов в сборке**: не добавлять API-ключи в `.env` и не заворачивать их в `NEXT_PUBLIC_*`.
- Backend — источник правды для LLM-истории; localStorage — только локальный кеш интерфейса. `remoteId` в чате связывает их.
- Ошибки API показывать пользователю на русском (`{ message }`, `{ detail }` FastAPI); сетевые ошибки — отдельным текстом.
- Контракт и требования к SSE описаны в README. При смене контракта обновлять `features/assistant`, `entities/model-settings` и README вместе.

## Компоненты

- Серверный компонент по умолчанию. `'use client'` — только когда компоненту нужны: state/refs, эффекты, браузерные события, `next/navigation` hooks (например, `usePathname`). Не вешать `'use client'` на layouts и на уровни выше необходимого.
- UI-примитивы — только shadcn из `@/shared/ui/*`. Импорт всегда прямой (`@/shared/ui/button`): `shared/ui` — набор примитивов, а не slice, баррела у него нет. Не писать свои Button/Input/Card/Dialog/Tabs. Не импортировать напрямую из `@/radix-ui/*` — только через shadcn-обёртку в `shared/ui`.
- Добавление компонента shadcn: `bunx shadcn@latest add <name>` — он кладётся в `@/shared/ui`. Файлы, сгенерированные shadcn, можно править — это наш код.
- Крупная композиция (секция страницы, header/sidebar) — `widgets/*`. Сценарий с логикой/эффектами — `features/*`. Типы сущностей — `entities/*/model/types.ts`.
- Бизнес-логика, fetch, state-management **запрещены** внутри `shared/**` и `widgets/**`. В `shared` живут только dumb-компоненты, утилиты (`cn`, форматтеры), конфиги, константы, типы.
- Стили — только utility-классы Tailwind. Не создавать свои CSS-файлы/модули; тёмная тема — через переменные `globals.css`, не через инлайн-стили.
- Каждый slice обязан экспортировать свой public API через `index.ts`; при создании slice создавать и barrel. Исключение — `shared/ui`: примитивы подключаются напрямую, баррела нет.

## Иконки

- **Запрет на кастомные/SVG-иконки и emoji-иконки, если нужная есть в lucide-react.** Сначала искать в lucide (`MessageSquare`, `Send`, `Sparkles`, …), только при отсутствии — обосновывать SVG.
- Импорт: `import { Send } from "lucide-react"` в `fileName-case` как на сайте lucide.
- Размер иконки задавать только через Tailwind (`className="size-4"`), не через атрибуты width/height.

## TypeScript / импорты

- Aliases: `@/*` → `src/*`. Всегда использовать alias с `@/`, не относительные пути вида `../../`. Исключение: только соседние файлы внутри одного slice (`./ui/...`).
- Максимум `100` символов на строку; брейл-строки текстов — на русском, окей.
- `strict` включён; no `any` (use `unknown` + сужение).
- Типы Next 16: `params`/`searchParams` — это Promise, `await` или `React.use()`; динамический роут — `params: Promise<{ id: string }>`.
- Не коммитить `next-env.d.ts`, `.next/`, `node_modules/` (в `.gitignore`).

## Конфигурация Tailwind v4

- **Не создавать** `tailwind.config.js/ts` — не поддерживается, всё в `src/app/globals.css`.
- Новый дизайн-токен: CSS-переменная в `:root` + маппинг в `@theme inline` внутри `globals.css`. Не рассыпать хардкодные цвета в компонентах — только токены (`bg-background`, `text-muted-foreground`).
- Проекция PostCSS уже настроена; не менять `postcss.config.mjs`.

## Роутинг (App Router)

- Группы: `(marketing)` — `/`, `(dashboard)` — `/chat`, `/chat/[id]`, `/plans`, `/tasks`,
  `/meetings`, `/reminders`, `/search`, `/settings`.
- API routes в этом приложении отсутствуют: `src/app/api` не создавать.
- Не переносить файлы между папками без сопровождения ссылок (typedRoutes включён — сломанные `<Link>` ловятся на `tsc`).
- Мета-данные каждой страницы задавать через `export const metadata` в `page.tsx`.

## Данные

- Чаты, черновики и планировщик — localStorage браузера.
- Backend хранит историю диалога для LLM; очистка локального чата создаёт серверный чат заново.
- Не добавлять серверное хранение и Docker в этот репозиторий без отдельной задачи.

## Процесс

- Перед коммитом запускать `bun typecheck` и `bun lint` — оба должны проходить чисто.
- Для production-сборки использовать `bun build`; Docker и серверную часть сюда не добавлять.
- Вопросы «куда класть код» решаются по README.md разделу «Структура».
- Не переписывать чужие слои: работу в `views/<чужой-screen>` согласовывать с владельцем.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
