FROM node:22-alpine AS web-build

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/package.json
COPY services/api/package.json ./services/api/package.json
RUN pnpm install --frozen-lockfile

COPY apps/web ./apps/web

RUN pnpm --filter @context-canvas/web build

FROM caddy:2-alpine

COPY infra/caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=web-build /app/apps/web/dist /srv/context-canvas
