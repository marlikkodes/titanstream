FROM node:20-alpine

WORKDIR /app

COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc* ./
COPY services/api/package.json ./services/api/
COPY services/worker/package.json ./services/worker/
COPY packages/ ./packages/
COPY libs/ ./libs/

ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"

RUN npm install -g pnpm && pnpm install --frozen-lockfile --ignore-scripts

COPY services/api/ ./services/api/

WORKDIR /app/services/api

RUN pnpm --filter @titanstream/api run prisma:generate

RUN pnpm --filter @titanstream/api build

RUN chmod +x start.sh

EXPOSE 3000

CMD ["./start.sh"]
