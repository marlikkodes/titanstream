# ── Build stage ──────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

RUN npm install -g pnpm

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc* ./
COPY services/worker/package.json ./services/worker/
COPY services/api/package.json ./services/api/
COPY packages/ ./packages/
COPY libs/ ./libs/

RUN pnpm install --frozen-lockfile --ignore-scripts

COPY services/worker/ ./services/worker/

WORKDIR /app/services/worker

RUN pnpm build

# ── Production Runtime stage ─────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

RUN npm install -g pnpm

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc* ./
COPY services/worker/package.json ./services/worker/
COPY services/api/package.json ./services/api/
COPY packages/ ./packages/
COPY libs/ ./libs/

RUN pnpm install --prod --frozen-lockfile --ignore-scripts

COPY --from=builder /app/services/worker/dist ./services/worker/dist

WORKDIR /app/services/worker

ENV NODE_ENV=production

CMD ["node", "dist/main.js"]
