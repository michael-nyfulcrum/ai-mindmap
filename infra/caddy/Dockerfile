FROM node:22-alpine AS web-build

WORKDIR /app
RUN corepack enable

ARG VITE_API_BASE_URL=
ARG VITE_MCP_URL=/mcp
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
ENV VITE_MCP_URL=${VITE_MCP_URL}

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json ./apps/web/package.json
COPY services/api/package.json ./services/api/package.json
RUN pnpm install --frozen-lockfile

COPY apps/web ./apps/web

RUN pnpm --filter @context-canvas/web build
RUN ! grep -R -E 'http://(127\.0\.0\.1|localhost):(8787|8790)' /app/apps/web/dist

FROM caddy:2-alpine

COPY infra/caddy/Caddyfile /etc/caddy/Caddyfile
COPY --from=web-build /app/apps/web/dist /srv/context-canvas
