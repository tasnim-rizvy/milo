# syntax=docker/dockerfile:1

# ── Stage 1 · build — install workspaces, compile the React client ─────────
FROM node:26-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci
COPY client/ client/
RUN npm run build

# ── Stage 2 · run — Fastify server + built client, production deps only ────
FROM node:26-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY server/package.json server/
COPY client/package.json client/
RUN npm ci --omit=dev && npm cache clean --force
COPY server/ server/
COPY --from=build /app/client/dist client/dist
EXPOSE 3001
# PORT and HOST come from the platform (Render sets PORT=10000);
# with no LLM keys the engine runs fully on the scripted fast-path.
CMD ["node", "server/src/index.js"]
