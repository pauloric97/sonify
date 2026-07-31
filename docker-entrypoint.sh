#!/bin/sh
set -e

DIR="${DATA_DIR:-/app/data}"

# O volume montado pelo painel (EasyPanel, Portainer, compose) quase sempre chega
# pertencendo ao root. Se subimos como root, ajustamos o dono e só então largamos
# o privilégio — assim o app roda como "node" mesmo escrevendo num bind mount.
if [ "$(id -u)" = "0" ]; then
  mkdir -p "$DIR"
  chown -R node:node "$DIR"
  exec gosu node "$@"
fi

mkdir -p "$DIR"
exec "$@"
