# syntax=docker/dockerfile:1

# --- Сборка ---
FROM oven/bun:1.4.4-alpine AS builder

WORKDIR /app

# NEXT_PUBLIC_* инлайнится в бандл на этапе сборки, поэтому адрес API
# передаётся build arg'ом, а не переменной окружения контейнера.
ARG NEXT_PUBLIC_API_URL=http://localhost:8000
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_TELEMETRY_DISABLED=1

# Зависимости ставятся отдельным слоем: они меняются реже, чем исходники
COPY package.json bun.lock ./
RUN --mount=type=cache,target=/root/.bun/install/cache \
    bun install --frozen-lockfile

COPY . .
RUN bun run build

# --- Запуск ---
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Приложение не работает от root
USER node

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=5 \
    CMD node -e "fetch('http://127.0.0.1:3000/', { signal: AbortSignal.timeout(3000) }).then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "server.js"]
