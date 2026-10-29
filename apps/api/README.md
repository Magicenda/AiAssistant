# AiAssistant — Backend

Backend локального AI-ассистента: аутентификация, чаты, работа с LLM,
транскрибация и озвучка, планы, задачи и встречи.

FastAPI + SQLAlchemy (async) + Alembic + GigaChat. Пакетный менеджер — uv.

## Запуск

Нужен [uv](https://docs.astral.sh/uv/) и Python 3.11+.

```bash
cd apps/api
cp .env.example .env        # заполните JWT_SECRET и GIGACHAT_*
uv sync
uv run uvicorn app:app --app-dir src --reload
```

`JWT_SECRET` обязателен и должен быть не короче 32 символов
(`openssl rand -hex 32`).

Из корня монорепы:

```bash
bun run db:up      # PostgreSQL в Docker
bun run dev:api
```

Запускать нужно из `apps/api`: так `src/` попадает в `sys.path` (импорты без
префикса `src.`), а папка `storage/` создаётся рядом с приложением.

## База данных

PostgreSQL поднимается из корневого [`docker-compose.yml`](../../docker-compose.yml):

```bash
bun run db:up     # docker compose up -d postgres
bun run db:down
bun run db:logs
```

| Параметр | Значение                         |
| -------- | -------------------------------- |
| Хост     | `localhost`                      |
| Порт     | `5434` (снаружи контейнера)      |
| Пользователь | `postgres`                   |
| Пароль   | `postgres`                       |
| База     | `ai_assistant`                   |

`DATABASE_URL` в `.env.example` уже указывает на этот контейнер. Подключиться
клиентом:

```bash
psql -h localhost -p 5434 -U postgres -d ai_assistant
```

Без Docker можно использовать SQLite: замените `DATABASE_URL` на
`sqlite+aiosqlite:///./assistant.db`.

Swagger — <http://localhost:8000/docs>, контракт API — в [`../../API.md`](../../API.md).

## Структура

```
apps/api/
├── src/
│   ├── app.py           # создание FastAPI, lifespan, подключение роутеров
│   ├── deps.py          # DI-зависимости
│   ├── core/            # конфиг, безопасность, исключения
│   ├── db/              # сессии, модели, репозитории
│   ├── routes/          # HTTP-контроллеры
│   ├── schemas/         # Pydantic-схемы
│   ├── services/        # бизнес-логика, LLM, TTS, транскрибация
│   └── tools/           # инструменты агента
├── pyproject.toml
├── uv.lock
└── requirements.txt
```

## LLM-провайдеры

Поддерживаются два варианта, переключение — через `LLM_PROVIDER`:

| `LLM_PROVIDER`      | Что использовать                  | Обязательные переменные                            |
| ------------------- | --------------------------------- | -------------------------------------------------- |
| `gigachat` (по умолчанию) | GigaChat API                | `GIGACHAT_CREDENTIALS`, `GIGACHAT_SCOPE`, `GIGACHAT_MODEL` |
| `openai_compatible` | Ollama или LM Studio              | `LLM_BASE_URL`, `LLM_MODEL` (ключ обычно любой)    |

Ollama и LM Studio отдают OpenAI-совместимый `/v1/chat/completions`:

```dotenv
LLM_PROVIDER=openai_compatible
LLM_BASE_URL=http://localhost:11434/v1   # Ollama; LM Studio — http://localhost:1234/v1
LLM_API_KEY=ollama                       # LM Studio — lm-studio
LLM_MODEL=qwen2.5:7b
```

Инструменты (задачи, встречи) работают в обоих режимах, если выбранная модель
умеет function calling.

## Переменные окружения

| Переменная             | Назначение                                  |
| ---------------------- | ------------------------------------------- |
| `LLM_PROVIDER`         | `gigachat` или `openai_compatible`          |
| `DATABASE_URL`         | строка подключения SQLAlchemy (async)       |
| `GIGACHAT_CREDENTIALS` | ключ авторизации GigaChat                   |
| `GIGACHAT_SCOPE`       | scope GigaChat                              |
| `GIGACHAT_MODEL`       | модель GigaChat                             |
| `LLM_BASE_URL`         | base URL Ollama/LM Studio, включает `/v1`   |
| `LLM_API_KEY`          | ключ OpenAI-совместимого сервера            |
| `LLM_MODEL`            | идентификатор модели Ollama/LM Studio       |
| `LLM_TIMEOUT`          | таймаут запроса к LLM, по умолчанию 120 с   |
| `JWT_SECRET`           | секрет подписи JWT, минимум 32 символа      |
| `JWT_ALGORITHM`        | алгоритм JWT, по умолчанию `HS256`          |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | время жизни токена, по умолчанию 60   |

## Команды

| Команда                                    | Что делает                     |
| ------------------------------------------ | ------------------------------ |
| `uv run uvicorn app:app --app-dir src --reload` | dev-сервер с автоперезагрузкой |
| `uv sync`                                  | установка зависимостей         |
| `uv run python -m ...`                     | запуск модулей из окружения    |
