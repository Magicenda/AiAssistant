# AiAssistant

Веб-ассистент с текстовым и голосовым режимами, задачами, встречами и напоминаниями.
Backend — FastAPI, frontend — Next.js. Поддерживаются GigaChat, Ollama и LM Studio.

## Возможности

- потоковый текстовый чат через SSE;
- распознавание речи через Whisper и озвучка ответов;
- задачи с обязательным сроком, встречи и напоминания;
- уведомления за 30 минут до срока, пока приложение открыто;
- создание, поиск, изменение и удаление записей через агента;
- авторизация, часовые пояса и раздельные данные пользователей.

## Запуск в Docker

```bash
cp .env.example .env
```

Укажите в `.env` ключ GigaChat и секрет JWT:

```dotenv
GIGACHAT_CREDENTIALS=ваш_ключ
JWT_SECRET=случайная_строка_не_короче_32_символов
```

```bash
docker compose up -d --build
```

- приложение через nginx: <http://localhost>;
- frontend напрямую: <http://localhost:3000>;
- Swagger: <http://localhost:8000/docs>;
- PostgreSQL: `localhost:5434`.

Nginx — единственная публичная точка входа: отдаёт frontend и проксирует `/api/*`
в backend. Конфиг — [`deploy/nginx/default.conf`](deploy/nginx/default.conf).

Первый запуск может занять несколько минут: загружается модель Whisper.

## Деплой в прод

На сервере достаточно Docker с compose-плагином:

```bash
git clone <репозиторий> AiAssistant
cd AiAssistant
cp .env.example .env
# заполните секреты и публичный адрес
docker compose up -d --build
```

В `.env` для прода обязательно:

- `NEXT_PUBLIC_API_URL` — публичный адрес сайта, например `https://ai.example.com`.
  Значение вшивается в бандл при сборке, поэтому после его изменения выполните
  `docker compose up -d --build` ещё раз.
- `JWT_SECRET` — случайная строка (`openssl rand -hex 32`).
- `GIGACHAT_CREDENTIALS` или настройки локальной модели.
- `POSTGRES_PASSWORD`, если база доступна не только внутри compose.

Наружу смотрит только контейнер `nginx` (порт `HTTP_PORT`, по умолчанию 80).
Frontend, backend и PostgreSQL опубликованы на `127.0.0.1` и из интернета
недоступны. Nginx уже умеет SSE и потоковое аудио без буферизации.

HTTPS удобно терминировать внешним прокси или балансировщиком перед nginx.
Если TLS должен держать сам nginx, добавьте в конфиг `listen 443 ssl` с
сертификатами и смонтируйте их в контейнер.

## Локальная разработка

Нужны Bun 1.4.4+, Python 3.11+, [uv](https://docs.astral.sh/uv/) и Docker.

```bash
cp .env.example .env
bun run db:up
bun run sync:api
cd apps/web && bun install && cd ../..
```

Запустите в разных терминалах:

```bash
bun run dev:api
bun run dev:web
```

Для SQLite без Docker задайте:

```dotenv
DATABASE_URL=sqlite+aiosqlite:///./assistant.db
```

Все настройки описаны в [`.env.example`](.env.example). Для локальной LLM используйте
`LLM_PROVIDER=openai_compatible` вместе с `LLM_BASE_URL` и `LLM_MODEL`.

## Полезные команды

```bash
bun run docker:up        # запустить весь стек
bun run docker:down      # остановить весь стек
bun run nginx:logs       # логи публичного nginx
bun run test:web         # тесты frontend
bun run typecheck:web    # проверка TypeScript
bun run lint:web         # ESLint
bun run format:web       # Prettier
```

## Структура и документация

```text
apps/api/   FastAPI, база данных, LLM, инструменты агента, Whisper и TTS
apps/web/   Next.js, чат, голосовой режим, планировщик и настройки
deploy/     конфиг nginx для production
API.md      HTTP API, SSE и примеры запросов
```

- [API.md](API.md) — контракт API;
- [apps/api/README.md](apps/api/README.md) — настройка backend;
- [apps/web/AGENTS.md](apps/web/AGENTS.md) — архитектура frontend.

Микрофон работает только на `localhost` или HTTPS. Системные уведомления требуют разрешения
браузера; для доставки при закрытом приложении понадобится Web Push.
