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

`DATABASE_URL` в примере уже указывает на локальный SQLite; для production
замените на `postgresql+asyncpg://...`. `JWT_SECRET` обязателен и должен быть
не короче 32 символов (`openssl rand -hex 32`).

Из корня монорепы:

```bash
bun api:dev
```

Запускать нужно из `apps/api`: так `src/` попадает в `sys.path` (импорты без
префикса `src.`), а папка `storage/` создаётся рядом с приложением.

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

## Переменные окружения

| Переменная             | Назначение                                  |
| ---------------------- | ------------------------------------------- |
| `DATABASE_URL`         | строка подключения SQLAlchemy (async)       |
| `GIGACHAT_CREDENTIALS` | ключ авторизации GigaChat                   |
| `GIGACHAT_SCOPE`       | scope GigaChat                              |
| `GIGACHAT_MODEL`       | модель GigaChat                             |
| `JWT_SECRET`           | секрет подписи JWT, минимум 32 символа      |
| `JWT_ALGORITHM`        | алгоритм JWT, по умолчанию `HS256`          |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | время жизни токена, по умолчанию 60   |

## Команды

| Команда                                    | Что делает                     |
| ------------------------------------------ | ------------------------------ |
| `uv run uvicorn app:app --app-dir src --reload` | dev-сервер с автоперезагрузкой |
| `uv sync`                                  | установка зависимостей         |
| `uv run python -m ...`                     | запуск модулей из окружения    |
