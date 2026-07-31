# syntax=docker/dockerfile:1

# Imagem baseada em Debian (não Alpine) de propósito: o better-sqlite3 tem binário
# pronto pra glibc, então não precisa compilar nada no runtime.
FROM node:24-bookworm-slim AS base
WORKDIR /app
ENV NODE_ENV=production

# ---------------------------------------------------------------- deps
FROM base AS deps
# python3/make/g++ só existem aqui: se o binário pronto do better-sqlite3 não
# servir, o npm compila na hora. Nada disso vai pra imagem final.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --include=dev

# ---------------------------------------------------------------- build
FROM deps AS build
COPY . .
RUN npm run build

# ------------------------------------------------------ deps de produção
FROM deps AS prod-deps
RUN npm prune --omit=dev

# -------------------------------------------------------------- runtime
FROM base AS runtime

COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build     /app/dist         ./dist
COPY package.json server.js schema.sql ./
COPY server ./server
COPY scripts ./scripts

# Banco SQLite e capas extraídas ficam aqui — monte um volume nesse caminho.
ENV DATA_DIR=/app/data
ENV PORT=3000
RUN mkdir -p /app/data && chown -R node:node /app

USER node
EXPOSE 3000
VOLUME ["/app/data"]

# Sem curl na imagem: o próprio Node faz o healthcheck.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
