# AiAssistant

Локальный AI-ассистент: backend на Python и веб-интерфейс на Next.js.

## Структура

```
AiAssistant/
├── apps/
│   ├── api/   # FastAPI backend
│   └── web/   # Next.js frontend
├── docker-compose.yml   # PostgreSQL для локальной разработки
├── API.md     # контракт backend API
└── package.json   # скрипты монорепы
```

Каждое приложение живёт в своей папке `apps/*` со своим пакетным менеджером:
backend — uv, frontend — Bun.

## Backend

Приложение — в [`apps/api`](apps/api). Полное описание — в
[`apps/api/README.md`](apps/api/README.md).

```bash
cd apps/api
cp .env.example .env        # заполните JWT_SECRET и GIGACHAT_*
uv sync
uv run uvicorn app:app --app-dir src --reload
```

Из корня монорепы:

```bash
bun run db:up      # PostgreSQL в Docker (localhost:5434)
bun run sync:api   # установка зависимостей
bun run dev:api    # dev-сервер с автоперезагрузкой
```

Запускать нужно из `apps/api`: так `src/` попадает в `sys.path` (импорты без
префикса `src.`), а папка `storage/` создаётся рядом с приложением.

### База данных

PostgreSQL поднимается из [`docker-compose.yml`](docker-compose.yml) на
`localhost:5434` (порт снаружи, чтобы не конфликтовать с другими проектами):

```bash
bun run db:up     # запустить
bun run db:logs   # логи
bun run db:down   # остановить
```

Параметры по умолчанию: пользователь `postgres`, пароль `postgres`, база
`ai_assistant`. Строка подключения уже прописана в `.env.example`. Подключиться
клиентом:

```bash
psql -h localhost -p 5434 -U postgres -d ai_assistant
```

Провайдер LLM задаётся переменной `LLM_PROVIDER`: `gigachat` (по умолчанию)
или `openai_compatible` для Ollama / LM Studio. Подробности — в
[`apps/api/README.md`](apps/api/README.md#llm-провайдеры).

## Frontend

Frontend локального AI-ассистента: чат, голосовые сообщения и планировщик.
Next.js 16 (App Router) + Tailwind CSS v4 + shadcn/ui + Prettier + Bun.

**Это только фронтенд.** Запросы к модели, стриминг ответов и распознавание
речи выполняет внешний backend. Фронтенд не вызывает LLM-провайдеров
напрямую и не содержит серверной логики.

### Возможности

- Чат с backend: потоковый ответ (SSE) или JSON-ответ.
- Настройки модели в интерфейсе: провайдер, адрес API, ключ, модель, температура.
- История чатов, цитаты, перегенерация, остановка генерации, экспорт в Markdown.
- Голосовые сообщения: запись в браузере, расшифровка на сервере.
- Планировщик: планы, задачи, встречи, напоминания, поиск и календарь.
- Тёмная пиксельная тема, адаптивная вёрстка, PWA-манифест.

### Быстрый старт

Нужен [Bun](https://bun.sh) 1.4.4+ и запущенный backend ассистента.

```bash
cd apps/web
cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:8000
bun install
```

Из корня монорепы:

```bash
bun run dev:web
```

Откройте <http://localhost:3000>, перейдите в **Настройки** и укажите
провайдера, модель и API-ключ.

Адрес backend задаётся **только** через окружение:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8000
```

Значение инлайнится на этапе сборки; в интерфейсе его менять нельзя.
Для production установите переменную перед `bun run build:web`.

### Настройки модели

Хранятся в localStorage браузера и передаются backend вместе с запросом
в поле `model_settings`. Backend использует их для вызова модели;
если настройки не заполнены — применяет свою конфигурацию по умолчанию.

| Поле        | Описание                                                             |
| ----------- | -------------------------------------------------------------------- |
| Сервис      | `GigaChat` (по умолчанию) или `Локальная модель` (Ollama / LM Studio) |
| Адрес API   | Base URL без `/chat/completions`; только для локальной модели         |
| API-ключ    | Ключ локального сервера; обычно не нужен                             |
| Модель      | Идентификатор локальной модели                                       |
| Температура | 0–1.5, по умолчанию 0.7                                              |

Для GigaChat ключ хранится на backend в env, в браузер он не попадает.
Для локальной модели адрес и модель хранятся в localStorage и передаются
backend с запросом. Не используйте фронтенд с недоверенным backend.

### Контракт backend API

| Метод    | Путь                                   | Тело / ответ                                                 |
| -------- | -------------------------------------- | ------------------------------------------------------------ |
| `GET`    | `/`                                    | health-check, любой `2xx`                                    |
| `POST`   | `/chat/create_chat`                    | `{ name_chat }` → чат с `chat_id` и `messages`               |
| `GET`    | `/chat/get_all_chats`                  | чаты пользователя вместе с сообщениями                       |
| `GET`    | `/chat/get_chat/{chat_id}`             | один чат с историей                                          |
| `PATCH`  | `/chat/{chat_id}`                      | `{ name_chat?, pinned? }` → обновлённый чат                  |
| `POST`   | `/chat/add_message/{chat_id}`          | query-параметры `role`, `content` → обновлённый чат          |
| `DELETE` | `/chat/{chat_id}/message/{message_id}` | удаление сообщения → обновлённый чат                         |
| `DELETE` | `/chat/{chat_id}/messages`             | очистка истории → обновлённый чат                            |
| `DELETE` | `/chat/delete_chat/{chat_id}`          | удаление чата на сервере                                     |
| `POST`   | `/llm/query`                           | `{ chat_id, query, model_settings?, reply_to?, regenerate? }` |
| `POST`   | `/audio/transcribe`                    | multipart `chat_id`, `file` → `{ text }`                     |

`model_settings` — необязательный JSON-объект:

```json
{
  "provider": "local",
  "base_url": "http://localhost:11434/v1",
  "api_key": "",
  "model": "qwen2.5:7b",
  "temperature": 0.7
}
```

#### Стриминг

`POST /llm/query` может отвечать:

- `application/json` — `{ "answer": "..." }`;
- `text/plain` — обычный текст, фронтенд читает его чанками;
- `text/event-stream` — SSE. Поддерживаются `data: {"text":"..."}`,
  `data: {"answer":"..."}`, `data: {"delta":"..."}`,
  `data: {"choices":[{"delta":{"content":"..."}}]}` и `data: [DONE]`.

Если сервер пока отвечает JSON, чат работает без стриминга: ответ появляется
целиком после запроса.

#### CORS

Backend должен разрешать origin фронтенда (`http://localhost:3000`).
Для локальной разработки обычно достаточно `allow_origins=["*"]`.

### Как устроена интеграция

- Чаты и сообщения — источник правды на backend; фронтенд держит их кэш в памяти
  и перечитывает через `/chat/get_all_chats` и `/chat/get_chat/{id}`.
- Первое сообщение в новом диалоге создаёт чат на backend (`/chat/create_chat`),
  после чего приложение переходит на `/chat/{chat_id}`.
- Каждый запрос идёт в `/llm/query` с `chat_id`; backend сам сохраняет вопрос и
  ответ в историю, поэтому после ответа фронтенд перечитывает чат.
- Цитата ответа передаётся в `reply_to` и хранится на backend; `regenerate: true`
  заменяет последний ответ, не добавляя вопрос повторно.
- Переименование, закрепление, удаление сообщений и очистка истории — отдельные
  запросы к backend, локальных копий чатов больше нет.
- Голос: аудио уходит на `/audio/transcribe`, расшифровка становится вопросом.
  Сам аудиофайл backend не хранит — плеер работает по локальному оверлею в
  localStorage, привязанному к id сообщения.
- Если backend недоступен, сообщение не сохраняется, а в чате показывается ошибка
  с кнопкой «Повторить».

В localStorage остаются только черновики композера, настройки модели и
голосовые вложения.

### Команды

Запускать из корня монорепы:

| Команда              | Что делает                             |
| -------------------- | -------------------------------------- |
| `bun run dev:web`    | Next dev server (Turbopack)            |
| `bun run build:web`  | production build                       |
| `bun run start:web`  | production server                      |
| `bun run typecheck:web` | `tsc --noEmit`                      |
| `bun run lint:web`   | ESLint                                 |
| `bun run format:web` | форматирование файлов Prettier         |
| `bun run format:check:web` | проверка форматирования без записи |
| `bun run test:web`   | тесты фронтенда (Vitest)               |
| `bun run sync:api`   | установка зависимостей backend         |
| `bun run dev:api`    | backend dev-сервер с автоперезагрузкой |
| `bun run start:api`  | backend без автоперезагрузки           |
| `bun run db:up`      | PostgreSQL в Docker (localhost:5434)   |
| `bun run db:down`    | остановить контейнер с БД              |
| `bun run db:logs`    | логи PostgreSQL                        |

Перед коммитом: `bun run format:web`, затем `bun run typecheck:web` и
`bun run lint:web` — типы и линтер должны проходить чисто, проверка
форматирования — зелёная.

### Стиль кода

Форматирование — Prettier, конфиг в `apps/web/.prettierrc.json`: ширина
строки 100, стрелочные функции с одним аргументом — без скобок, плагин
`prettier-plugin-tailwindcss` сортирует Tailwind-классы. Стилистические
правила ESLint, конфликтующие с Prettier, отключены через
`eslint-config-prettier`.

Комментарии и JSDoc — на русском в едином стиле: комментарий объясняет
«зачем», а не «что»; полные предложения, без закомментированного кода и шума.
Полные правила — в скилле
[`.opencode/skills/russian-comments/SKILL.md`](.opencode/skills/russian-comments/SKILL.md).

### Структура

```
apps/web/src/
├── app/                    # только роутинг Next.js
│   ├── (marketing)/        # лендинг
│   └── (dashboard)/        # чат, планы, задачи, встречи, поиск, настройки
├── views/                  # экраны целиком
├── widgets/                # header, sidebar
├── features/
│   ├── assistant/          # клиент backend API: чаты, query, транскрипция
│   ├── model-settings/     # форма настроек модели
│   ├── conversations/      # чат, локальная история, стриминг в UI
│   └── planner/            # планировщик
├── entities/
│   ├── chat/               # типы чата
│   └── model-settings/     # типы и localStorage настроек модели
└── shared/                 # UI-примитивы, утилиты, конфиг, API-клиент
```

Правила для редакторов — в [`apps/web/AGENTS.md`](apps/web/AGENTS.md).
Зависимости слоёв: `app → views → widgets → features → entities → shared`.

### Данные и приватность

| Что                          | Где                                                     |
| ---------------------------- | ------------------------------------------------------- |
| Провайдер, модель, API-ключ  | localStorage браузера                                   |
| Чаты и сообщения             | на backend                                              |
| Черновики композера          | localStorage браузера                                   |
| Голосовые вложения           | localStorage браузера + отправка на `/audio/transcribe` |
| Планировщик                  | на backend                                              |

Backend получает настройки модели с каждым запросом и использует их для
обращения к провайдеру. Никаких секретов в самом фронтенде нет.

### Ограничения

- Backend API должен быть доступен из браузера (CORS).
- Формат SSE зависит от backend; фронтенд поддерживает несколько частых вариантов.
- Регенерация и удаление отдельных сообщений не меняют историю на сервере.
- Уведомления и TTS пока не подключены.
- Для микрофона нужен `localhost` или HTTPS.

### Диагностика

- **«Не удалось связаться с сервером ассистента»** — проверьте, что backend
  запущен и `NEXT_PUBLIC_API_URL` указывает на него.
- **CORS-ошибка в консоли** — разрешите origin фронтенда на backend.
- **Модель не отвечает / 401** — проверьте настройки модели на `/settings`:
  адрес API, ключ и название модели должны совпадать с тем, что даёт провайдер.
- **Ответ не стримится** — проверьте `Content-Type: text/event-stream` и формат
  `data:`-событий. JSON-ответы поддерживаются, но появляются целиком.
- **404 при запросе** — фронтенд пересоздаст серверный чат; если не помогает,
  проверьте `/chat/create_chat`.
- **Голос не расшифровывается** — проверьте `/chat/transcribe` и размер файла
  (до 25 МБ на стороне типового backend).
