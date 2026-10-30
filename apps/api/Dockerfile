# syntax=docker/dockerfile:1

# Python 3.11 + uv из официального образа astral-sh
FROM ghcr.io/astral-sh/uv:python3.11-bookworm-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

# Зависимости ставятся отдельным слоем: они меняются реже, чем исходники
COPY pyproject.toml uv.lock README.md ./
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev --no-install-project

COPY src ./src
RUN --mount=type=cache,target=/root/.cache/uv \
    uv sync --frozen --no-dev

EXPOSE 8000

# Приложение (и Whisper) стартует не мгновенно, healthcheck ждёт до 3 минут
HEALTHCHECK --interval=30s --timeout=5s --start-period=180s --retries=5 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/', timeout=3)"

CMD ["uvicorn", "app:app", "--app-dir", "src", "--host", "0.0.0.0", "--port", "8000"]
