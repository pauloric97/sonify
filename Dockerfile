# syntax=docker/dockerfile:1

# Debian e não Alpine de propósito: o better-sqlite3 tem binário pronto pra glibc,
# então o build não precisa compilar nada na mão.
FROM node:24-bookworm-slim AS base
WORKDIR /app
ENV NODE_ENV=production

# ---------------------------------------------------------------- deps
FROM base AS deps
# python3/make/g++ vivem só nesta camada: se o binário pronto do better-sqlite3
# não servir, o npm compila aqui. Nada disso entra na imagem final.
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

# gosu: entra como root só pra acertar o dono do volume e cai pro usuário node.
RUN apt-get update \
 && apt-get install -y --no-install-recommends gosu \
 && rm -rf /var/lib/apt/lists/*

COPY --from=prod-deps /app/node_modules ./node_modules
# O vite já joga o conteúdo de public/ (ícones, manifest, sw) dentro de dist/.
COPY --from=build     /app/dist         ./dist
COPY package.json server.js schema.sql ./
COPY server ./server
COPY scripts ./scripts
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Banco SQLite e capas extraídas das tags. Monte um volume neste caminho.
ENV DATA_DIR=/app/data
ENV PORT=3000
RUN mkdir -p /app/data && chown -R node:node /app

EXPOSE 3000
VOLUME ["/app/data"]

# Sem curl na imagem: o próprio Node faz o healthcheck.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.js"]
