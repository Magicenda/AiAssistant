# AiAssistant

## Запуск

```bash
uv sync
cp .env.example .env        # заполните DATABASE_URL и GIGACHAT_*
uv run uvicorn app:app --app-dir src --reload
```

Запускать нужно из корня проекта: так `src/` попадает в `sys.path` (импорты без префикса `src.`), а папка `storage/` создаётся в корне.
