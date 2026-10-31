# AiAssistant

AI-ассистент с веб-интерфейсом: чаты, голосовой режим и планировщик. Backend на FastAPI, фронтенд на Next.js. Модель подключается через GigaChat или локально через Ollama / LM Studio.

## Стек

- Backend: Python 3.11+, FastAPI, SQLAlchemy (async), Alembic, PostgreSQL
- Frontend: Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui
- Пакетные менеджеры: uv для backend, Bun для frontend
- Docker Compose для всего стека

## Быстрый старт

```bash
cp .env.example .env
# заполните GIGACHAT_CREDENTIALS и JWT_SECRET (openssl rand -hex 32)
bun run docker:up
```

Интерфейс откроется на <http://localhost:3000>, Swagger на <http://localhost:8000/docs>, PostgreSQL слушает `localhost:5434`.

Первый запуск занимает несколько минут: собираются образы и скачивается модель Whisper.

## Запуск без Docker

Backend:

```bash
bun run db:up     # PostgreSQL в Docker
bun run sync:api
bun run dev:api
```

Frontend:

```bash
cd apps/web
bun install
```

Дальше из корня:

```bash
bun run dev:web
```

Понадобятся Bun 1.4.4+, Python 3.11+ и [uv](https://docs.astral.sh/uv/). Рабочая директория backend — `apps/api`, поэтому `storage/` появляется рядом с ним.

## Настройки

Все переменные лежат в одном `.env` в корне, его читают и backend, и frontend. Шаблон с комментариями — [`.env.example`](.env.example). Главное:

- `GIGACHAT_CREDENTIALS` — ключ GigaChat, `JWT_SECRET` — подпись токенов входа. В Docker без своего секрета подставляется dev-значение из compose.
- `LLM_PROVIDER` — `gigachat` или `openai_compatible`. Для локальной модели также нужны `LLM_BASE_URL` и `LLM_MODEL`.
- `NEXT_PUBLIC_API_URL` — адрес backend для браузера. Значение вшивается в бандл при сборке, поэтому после изменения frontend нужно пересобрать.

Провайдера, модель и температуру можно переопределить в настройках интерфейса. Они сохраняются в браузере и уходят на backend вместе с запросом.

## Команды

Запускать из корня монорепы.

| Команда                 | Что делает                       |
| ----------------------- | -------------------------------- |
| `bun run dev:web`       | frontend с горячей перезагрузкой |
| `bun run dev:api`       | backend с автоперезагрузкой      |
| `bun run docker:up`     | весь стек в Docker               |
| `bun run db:up`         | только PostgreSQL                |
| `bun run test:web`      | тесты frontend (Vitest)          |
| `bun run typecheck:web` | проверка типов                   |
| `bun run lint:web`      | ESLint                           |
| `bun run format:web`    | форматирование кода и README     |

Перед коммитом достаточно `format:web`, `typecheck:web` и `lint:web`.

## Структура

```
apps/api/   FastAPI: авторизация, чаты, LLM, голос, планировщик
apps/web/   Next.js: лендинг, чат, голосовой режим, планы, настройки
API.md      контракт API: эндпоинты, SSE, примеры
```

Слои фронтенда: `app → views → widgets → features → entities → shared`. Подробнее — в [`apps/web/AGENTS.md`](apps/web/AGENTS.md).

## Что стоит знать

- Чаты, задачи, напоминания и встречи хранятся на backend. В localStorage остаются только настройки модели, движок озвучки и черновики ввода.
- Ответы приходят потоком через `/api/llm/query/stream` (SSE). Голос идёт через `/api/audio/transcribe` и `/api/voice/*`.
- Микрофон работает только на `localhost` или HTTPS.
- Для GigaChat ключ остаётся на backend. Если выбрать локальную модель, её адрес и ключ передаются с каждым запросом.

## Документация

- [API.md](API.md) — эндпоинты, авторизация, стриминг, примеры запросов.
- [apps/api/README.md](apps/api/README.md) — backend: запуск, LLM-провайдеры, переменные окружения.
- [apps/web/AGENTS.md](apps/web/AGENTS.md) — правила разработки фронтенда.
