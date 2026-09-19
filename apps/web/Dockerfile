# ── Build stage ──────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc* ./
COPY apps/web/package.json ./apps/web/
COPY packages/ ./packages/
COPY services/api/package.json ./services/api/
COPY services/worker/package.json ./services/worker/
COPY libs/ ./libs/

RUN pnpm install --frozen-lockfile --ignore-scripts

COPY apps/web/ ./apps/web/

# Build the Vite app — env vars injected at build time
ARG VITE_API_BASE_URL
ARG VITE_APP_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_APP_URL=$VITE_APP_URL

RUN pnpm --filter web build

# ── Serve stage ─────────────────────────────────────────────
FROM caddy:2-alpine
COPY --from=builder /app/apps/web/dist /srv
COPY apps/web/Caddyfile /etc/caddy/Caddyfile
EXPOSE 80
CMD ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
