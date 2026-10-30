# API голосового ассистента — документация для фронтенда

Базовый адрес зависит от окружения; при локальном запуске обычно `http://localhost:8000`.
Все рабочие эндпоинты начинаются с `/api`. Интерактивная документация (Swagger) доступна на `/docs`.

## Содержание

1. [Общие правила](#общие-правила)
2. [Авторизация](#авторизация)
3. [Чаты](#чаты)
4. [Запрос к ассистенту (текст)](#запрос-к-ассистенту-текст)
5. [Голосовой запрос](#голосовой-запрос)
6. [Профиль: задачи, напоминания, встречи](#профиль-задачи-напоминания-встречи)
7. [Распознавание речи отдельно](#распознавание-речи-отдельно)
8. [Ошибки](#ошибки)
9. [Примеры кода](#примеры-кода)

---

## Общие правила

- **Формат**: JSON (`Content-Type: application/json`), если не указано иное. Загрузка аудио — `multipart/form-data`, вход — `application/x-www-form-urlencoded`.
- **Авторизация**: все эндпоинты, кроме регистрации, входа и `GET /`, требуют заголовок
  `Authorization: Bearer <access_token>`. Без него или с недействительным токеном — `401`.
- **Даты и время**: ISO 8601 (`2026-10-29T16:05:29.085466+00:00`). Если смещения часового пояса нет, считайте время UTC. Показывайте пользователю в его часовом поясе.
- **Данные изолированы по пользователям**: пользователь видит только свои чаты, задачи, встречи и голосовые запросы. Чужой объект отвечает `404`, как будто его нет.
- **CORS** открыт для всех источников.

---

## Авторизация

Токен JWT живёт **60 минут**. После истечения любой запрос вернёт `401`: нужно войти заново. Refresh-токенов нет.

### `POST /api/auth/register` — регистрация

Доступ: открыт.

```json
{ "username": "alice", "password": "correct-horse-1" }
```

| Поле | Правила |
|---|---|
| `username` | 3–64 символа: латиница, цифры, `_` `.` `-`. Регистр не важен (`Alice` = `alice`), сохраняется в нижнем регистре |
| `password` | 8–128 символов |

Ответ `201`:
```json
{ "id": 1, "username": "alice", "created_at": "2026-10-29T16:05:29.085466+00:00" }
```
Ошибки: `409` — логин занят, `422` — не прошла проверка полей.

### `POST /api/auth/login` — вход

Доступ: открыт. **Тело не JSON, а форма** (`application/x-www-form-urlencoded`) — это стандарт OAuth2, благодаря ему работает кнопка Authorize в Swagger:

```
username=alice&password=correct-horse-1
```

Ответ `200`:
```json
{ "access_token": "eyJhbGciOi...", "token_type": "bearer" }
```
Ошибки: `401` — неверный логин или пароль (сообщение одинаковое в обоих случаях).

### `GET /api/auth/me` — текущий пользователь

Ответ `200`: тот же объект, что при регистрации. Удобно, чтобы проверить, что сохранённый токен ещё действителен.

---

## Чаты

Чат хранит историю переписки с ассистентом. Сначала нужно создать чат, затем передавать его `chat_id` в запросах к ассистенту.

### `POST /api/chat/create_chat`
```json
{ "name_chat": "Рабочие дела" }
```
Ответ `200`:
```json
{ "chat_id": 3, "name_chat": "Рабочие дела", "messages": [], "pinned": false }
```

### `GET /api/chat/get_all_chats`
Ответ `200`: массив чатов пользователя в формате выше, вместе с `messages`.

### `GET /api/chat/get_chat/{chat_id}`
Ответ `200`:
```json
{
  "chat_id": 3,
  "name_chat": "Рабочие дела",
  "pinned": false,
  "messages": [
    { "id": 10, "role": "user", "content": "Привет", "created_at": "2026-10-29T16:05:29+00:00", "reply_to": null },
    { "id": 11, "role": "assistant", "content": "Здравствуйте!", "created_at": "2026-10-29T16:05:31+00:00", "reply_to": null }
  ]
}
```
`role`: `user`, `assistant`, `system`, `tool`. `reply_to` — снимок цитируемого
сообщения `{ id, role, text }` или `null`. Ошибка: `404` — чата нет или он чужой.

### `PATCH /api/chat/{chat_id}`
Переименовывает и/или закрепляет чат. Оба поля необязательны:
```json
{ "name_chat": "Новое имя", "pinned": true }
```
Ответ `200`: обновлённый чат.

### `DELETE /api/chat/delete_chat/{chat_id}`
Ответ `200`: `true`. Вместе с чатом удаляются все его сообщения. Ошибка: `404`.

### `DELETE /api/chat/{chat_id}/message/{message_id}`
Удаляет одно сообщение. Ответ `200`: обновлённый чат. Ошибка: `404`.

### `DELETE /api/chat/{chat_id}/messages`
Очищает историю, оставляя чат и его имя. Ответ `200`: обновлённый чат.

### `POST /api/chat/add_message/{chat_id}`
Добавляет сообщение вручную. **Параметры передаются в query-строке, а не в теле**:
`POST /api/chat/add_message/3?role=user&content=Привет` (значения нужно кодировать через `encodeURIComponent`).
Ответ `200`: обновлённый чат. Обычно этот метод не нужен: сообщения сохраняются автоматически при запросах к ассистенту.

---

## Запрос к ассистенту (текст)

### `POST /api/llm/query`
Ассистент отвечает и при необходимости сам создаёт задачи, напоминания и встречи, меняет задачи и показывает список. Вопрос и ответ записываются в историю чата.

```json
{ "chat_id": 3, "query": "Напомни завтра в 9 утра позвонить маме" }
```
Ответ `200`:
```json
{ "answer": "Готово, напоминание создано." }
```
Запрос может идти несколько секунд (иногда десятки) — показывайте индикатор загрузки и не ставьте короткий таймаут. Ошибка: `404` — чата нет.

Необязательные поля:

- `reply_to` — цитата, на которую отвечает пользователь:
  `{ "id": "10", "role": "assistant", "text": "Превью ответа" }`. Сохраняется
  вместе с вопросом и возвращается в истории.
- `regenerate` — `true` заменяет последний ответ ассистента новым, не добавляя
  вопрос в историю повторно. `query` всё равно передаётся для контекста.
- `timezone` — IANA-часовой пояс пользователя, например `Europe/Moscow`.
  Названные пользователем дата и время трактуются в этом поясе; без поля
  используется UTC.

По умолчанию ответ генерирует GigaChat с ключом из env backend. Пользователь может
переключиться на локальную модель (Ollama / LM Studio), передав `model_settings`:

```json
{
  "chat_id": 3,
  "query": "Привет",
  "model_settings": {
    "provider": "local",
    "base_url": "http://localhost:11434/v1",
    "api_key": "",
    "model": "qwen2.5:7b",
    "temperature": 0.7
  }
}
```

`model_settings` необязателен. Поддерживаются только `provider: "gigachat"` и
`provider: "local"`; для `local` обязательны `base_url` и `model`. Без поля
backend использует настройки из env.

### `POST /api/llm/query_and_voice`
То же, что `/query`, плюс озвучка ответа в фоне. Тело то же. Ответ `202`:
```json
{ "job_id": "1d8f8bd6-244e-4003-abda-4a0bc2d7dd0c", "status": "pending" }
```
Текст ответа в этом ответе **не приходит** — он будет в `agent_reply_text` у job (см. ниже). Если текст нужен сразу, используйте `/query`, а озвучку запрашивайте отдельно через `/api/voice/generate`.

---

## Голосовой запрос

Озвучка и распознавание выполняются в фоне, поэтому работа идёт через **job**: вы отправляете запрос, получаете `job_id`, опрашиваете статус и забираете аудио.

### Полный цикл: `POST /api/voice/ask`

`multipart/form-data`:

| Поле | Тип | Описание |
|---|---|---|
| `chat_id` | число | чат пользователя |
| `file` | файл | аудиозапись; `Content-Type` должен начинаться с `audio/` (например, `audio/webm`), до 25 МБ |
| `model_settings` | строка, необязательно | JSON-настройки модели, те же, что в теле `/llm/query`; без них используется провайдер из env |
| `speak` | boolean, необязательно | `true` (по умолчанию) — сервер сам синтезирует mp3; `false` — job завершится с текстом и без аудио, клиент озвучит сам |
| `timezone` | строка, необязательно | IANA-часовой пояс пользователя, например `Europe/Moscow`; без поля используется UTC |

Ответ `202`:
```json
{ "job_id": "1d8f8bd6-244e-4003-abda-4a0bc2d7dd0c", "status": "pending" }
```
Ошибки: `400` — не аудио или пустой файл, `404` — чата нет, `413` — файл больше 25 МБ, `422` — некорректный `model_settings`.

Что делает сервер: распознаёт речь → отвечает через ассистента (с созданием задач и т.п.) → озвучивает ответ, если `speak=true`. Вопрос и ответ сохраняются в истории чата.

### `POST /api/voice/generate` — озвучить готовый текст

```json
{ "text": "Текст для озвучки" }
```
Ответ `202`: как выше. В job не будет `transcript`.

### `POST /api/voice/stream` — потоковая озвучка

```json
{ "text": "Текст для озвучки" }
```
Ответ `200`:
```json
{ "stream_url": "/api/voice/stream/5458c992ba074a97aa4a0cec1cd7bbf9", "expires_in": 300 }
```
`stream_url` можно сразу ставить в `<audio src>`: браузер начнёт играть, как только
придут первые байты mp3, не дожидаясь конца синтеза. Ссылка живёт 5 минут и не
требует `Authorization` — id и есть одноразовый секрет. Повторный GET запускает
синтез заново.

### `GET /api/voice/stream/{stream_id}` — поток mp3

Возвращает `audio/mpeg` постепенно (chunked), без заголовка `Authorization`.
`404` — ссылка истекла или не существует.

### `GET /api/voice/jobs/{job_id}` — статус

```json
{
  "job_id": "1d8f8bd6-244e-4003-abda-4a0bc2d7dd0c",
  "status": "completed",
  "error": null,
  "transcript": "запиши задачу купить хлеб",
  "agent_reply_text": "Записал: купить хлеб",
  "audio_binary_url": "/api/voice/jobs/1d8f8bd6-244e-4003-abda-4a0bc2d7dd0c/audio"
}
```

| `status` | Значение |
|---|---|
| `pending` | job создан, ещё не начат |
| `transcribing` | распознаётся речь |
| `thinking` | отвечает ассистент |
| `speaking` | озвучивается ответ |
| `completed` | готово, аудио можно скачать |
| `failed` | ошибка, причина в `error` |

Для `/voice/generate` и `/llm/query_and_voice` статусы `transcribing` и `thinking` пропускаются.

Поля `transcript` и `agent_reply_text` заполняются по мере выполнения: можно показывать распознанный вопрос и текст ответа, не дожидаясь аудио. Готовность аудио определяйте только по `status === "completed"`.

Тексты ошибок (`error`): `Речь не распознана`, `Превышено время обработки` (общий лимит — 3 минуты), `Не удалось обработать запрос`, `GigaChat отклонил ключ (401) — проверьте GIGACHAT_CREDENTIALS или выберите локальную модель`.

Рекомендации: опрашивайте раз в 0,5–1 секунду, останавливайтесь на `completed`/`failed`, сдавайтесь примерно через 3 минуты. Завершённый job хранится **15 минут**, потом отвечает `404`. Чужой или несуществующий job — `404` (`{"detail": "Задача не найдена"}`).

### `GET /api/voice/jobs/{job_id}/audio` — скачать аудио

Возвращает файл `audio/mpeg` (mp3). Если `status` не `completed`, ответ `400`.

**Важно:** этому запросу тоже нужен заголовок `Authorization`, а `<audio src="...">` заголовки не передаёт. Поэтому скачивайте через `fetch` и проигрывайте как blob (пример ниже). Поле `audio_binary_url` — относительный путь, добавляйте к нему базовый адрес.

---

## Профиль: задачи, напоминания, встречи

Три однотипных списка, содержимое создаёт ассистент по просьбе пользователя.

| Эндпоинт | Что возвращает |
|---|---|
| `GET /api/profile/tasks` | задачи |
| `GET /api/profile/reminders` | напоминания |
| `GET /api/profile/meetings` | встречи |

Query-параметры (необязательные):

| Параметр | По умолчанию | Описание |
|---|---|---|
| `limit` | `50` | сколько записей вернуть, от 1 до 100 |
| `only_upcoming` | `false` | `true` — только записи со сроком в будущем |

Сортировка по сроку, ближайшие первыми; задачи без срока в конце.

Ответ для задач и напоминаний:
```json
[
  {
    "id": 2,
    "type": "task",
    "description": "купить хлеб",
    "deadline": "2026-10-30T16:05:29+00:00",
    "created_at": "2026-10-29T16:05:29+00:00"
  }
]
```
`type`: `task` или `notify`. `deadline` может быть `null` (срок не задан).

Ответ для встреч:
```json
[
  {
    "id": 1,
    "description": "планёрка",
    "appointment": "2026-10-31T10:00:00+00:00",
    "created_at": "2026-10-29T16:05:29+00:00"
  }
]
```

Списки изменяются на стороне ассистента, поэтому перезапрашивайте их после каждого ответа ассистента.

---

## Распознавание речи отдельно

### `POST /api/audio/transcribe`

`multipart/form-data` с теми же полями, что у `/voice/ask`: `chat_id` (число, обязательное) и `file`.

Ответ `200`:
```json
{ "text": "запиши задачу купить хлеб" }
```
Ошибки: `400` — не аудио или пустой файл, `413` — больше 25 МБ, `422` — речь не распознана (`{"detail": "Речь не распознана"}`).
Метод выполняется синхронно и может занять несколько секунд. Нужен, чтобы показать распознанный текст до отправки ассистенту.

---

## Ошибки

Тело ошибки всегда содержит `detail`.

| Код | Когда | Формат `detail` |
|---|---|---|
| `400` | не аудио, пустой файл, аудио ещё не готово | строка |
| `401` | нет токена, токен недействителен или истёк; неверный логин/пароль | строка; в заголовке `WWW-Authenticate: Bearer` |
| `404` | чат, job не найден или принадлежит другому пользователю | строка |
| `409` | логин занят | строка |
| `413` | файл больше 25 МБ | строка |
| `422` | не прошла проверка полей / речь не распознана | для полей — массив, для распознавания — строка |

Формат `422` при ошибке в полях:
```json
{ "detail": [ { "loc": ["body", "password"], "msg": "String should have at least 8 characters", "type": "string_too_short" } ] }
```
Поэтому `detail` нужно проверять на тип: строка или массив.

---

## Примеры кода

### Обёртка над fetch с токеном

```js
const BASE = "http://localhost:8000";
let token = localStorage.getItem("token");      // или держите в памяти: безопаснее при XSS

async function api(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, { ...options, headers });
  if (res.status === 401) {                     // токен истёк или недействителен
    token = null; localStorage.removeItem("token");
    throw new Error("unauthorized");            // показать форму входа
  }
  return res;
}

async function login(username, password) {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    body: new URLSearchParams({ username, password }),   // форма, не JSON
  });
  if (!res.ok) throw new Error((await res.json()).detail);
  token = (await res.json()).access_token;
  localStorage.setItem("token", token);
}
```

### Текстовый запрос

```js
const res = await api("/api/llm/query", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ chat_id: chatId, query: "Какие у меня задачи?" }),
});
const { answer } = await res.json();
```

### Голосовой запрос целиком

```js
// 1. запись с микрофона (нужен HTTPS или localhost)
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
const recorder = new MediaRecorder(stream);
const chunks = [];
recorder.ondataavailable = (e) => chunks.push(e.data);
recorder.onstop = () => sendVoice(new Blob(chunks, { type: recorder.mimeType }));
// recorder.start() по нажатию, recorder.stop() по отпусканию кнопки

// 2. отправка
async function sendVoice(blob) {
  const form = new FormData();
  form.append("chat_id", chatId);
  form.append("file", blob, "voice.webm");      // Content-Type не указывать вручную
  const res = await api("/api/voice/ask", { method: "POST", body: form });
  if (!res.ok) return showError((await res.json()).detail);
  const { job_id } = await res.json();
  await waitAndPlay(job_id);
}

// 3. опрос статуса и воспроизведение
async function waitAndPlay(jobId) {
  const deadline = Date.now() + 3 * 60 * 1000;
  let shown = {};
  while (Date.now() < deadline) {
    const job = await (await api(`/api/voice/jobs/${jobId}`)).json();

    if (job.transcript && !shown.transcript) { shown.transcript = true; showUserMessage(job.transcript); }
    if (job.agent_reply_text && !shown.reply) { shown.reply = true; showAssistantMessage(job.agent_reply_text); }

    if (job.status === "failed") return showError(job.error);
    if (job.status === "completed") {
      const audio = await api(`/api/voice/jobs/${jobId}/audio`);   // с токеном
      const url = URL.createObjectURL(await audio.blob());
      new Audio(url).play();
      return;
    }
    await new Promise((r) => setTimeout(r, 700));
  }
  showError("Превышено время ожидания");
}
```

Советы:
- Safari записывает `audio/mp4`, Chrome и Firefox — `audio/webm`. Берите `recorder.mimeType` и подбирайте расширение файла.
- Браузер может заблокировать автоматическое воспроизведение, если пользователь не взаимодействовал со страницей. Запускайте воспроизведение после действия пользователя (нажатия кнопки записи).
- Блокируйте кнопку записи, пока идёт запрос, и показывайте статус (`transcribing` → «Слушаю…», `thinking` → «Думаю…», `speaking` → «Говорю…»).
- После ответа ассистента обновите списки задач, напоминаний и встреч.
