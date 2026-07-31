# Sonify

Seu Spotify + Netflix pessoal. Os arquivos ficam num bucket S3-compatível (Cloudflare R2 ou
Backblaze B2) e o app é uma PWA escura, rápida e feita pra usar no celular.

- **Áudio**: fila, aleatório, repetição, favoritos, playlists, controle na tela de bloqueio
  (Media Session), atalhos de teclado.
- **Vídeo**: séries com temporada/episódio, "continuar de onde parou", próximo episódio automático.
- **Perfis**: um admin (sobe conteúdo) e quantos perfis de visualização você quiser, cada um com
  seu histórico, favoritos e playlists.
- **Streaming direto do bucket**: o servidor só assina a URL, os bytes vão do R2/B2 pro player.
  Sua VPS não gasta banda e o seek funciona (range requests).

Stack: Vite + React 19 + TypeScript + Tailwind no front, Express 5 + SQLite no back.

---

## 1. Instalar

```bash
npm install
cp .env.example .env
```

Gere o segredo dos tokens e cole no `.env`:

```bash
openssl rand -hex 32
```

## 2. Configurar o bucket

### Cloudflare R2

```env
S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=sonify
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_FORCE_PATH_STYLE=false
```

As chaves saem em **R2 → Manage R2 API Tokens** (permissão *Object Read & Write*).

### Backblaze B2

```env
S3_ENDPOINT=https://s3.us-west-004.backblazeb2.com
S3_REGION=us-west-004
S3_BUCKET=sonify
S3_ACCESS_KEY_ID=<keyID>
S3_SECRET_ACCESS_KEY=<applicationKey>
S3_FORCE_PATH_STYLE=true
```

Troque `us-west-004` pela região que aparece no endpoint do seu bucket.

### CORS (obrigatório pro upload pelo app)

O navegador sobe o arquivo direto pro bucket, então o bucket precisa liberar o seu domínio.

**R2** (Settings → CORS Policy):

```json
[
  {
    "AllowedOrigins": ["http://localhost:5173", "https://seu-dominio.com"],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": ["*"],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

**B2** (Bucket Settings → CORS Rules → *Share everything in this bucket with custom rules*):

```json
[
  {
    "corsRuleName": "sonify",
    "allowedOrigins": ["http://localhost:5173", "https://seu-dominio.com"],
    "allowedOperations": ["s3_put", "s3_get", "s3_head"],
    "allowedHeaders": ["*"],
    "exposeHeaders": ["etag"],
    "maxAgeSeconds": 3600
  }
]
```

**Não configurou CORS? Funciona mesmo assim.** Se o navegador não conseguir mandar o arquivo
direto pro bucket, o app reenvia passando pelo servidor (mesma origem, CORS não se aplica) e
mostra "(pelo servidor)" na lista. A diferença é só que aí o upload gasta banda da sua VPS.
Os presets da interface web do B2 liberam só download; pra liberar `s3_put` você precisa de regra
personalizada via CLI do B2 — ou simplesmente deixar o fallback fazer o trabalho.

O `S3_ENDPOINT` precisa do `https://` na frente, e no B2 a `S3_REGION` tem que ser a mesma do
endpoint (`auto` só vale pro R2). O app corrige esses dois casos sozinho e avisa no log.

Se você só vai jogar os arquivos no bucket por fora (rclone, painel web) e usar o
**Escanear bucket**, não precisa de CORS.

## 3. Rodar

```bash
npm run dev     # front em :5173, API em :3000
```

Abra http://localhost:5173. A primeira tela pede pra criar a conta de administrador.

Em produção:

```bash
npm run build
npm start       # tudo em :3000
```

---

## Como colocar mídia na biblioteca

**Enviando pelo app** — Ajustes → Enviar. Arrasta os arquivos, eles vão direto pro bucket e o
servidor lê as tags (título, artista, álbum, capa embutida) sozinho.

**Importando o que já está no bucket** — Ajustes → Biblioteca → Escanear bucket. Ele varre tudo,
ignora o que já está cadastrado e lê as tags de cada arquivo novo baixando só os primeiros 4 MB.

Se o arquivo não tiver tag, o nome é usado como fallback:

| Nome do arquivo                    | Vira                                        |
| ---------------------------------- | ------------------------------------------- |
| `03 - Cazuza - Exagerado.mp3`      | faixa 3, artista Cazuza, título Exagerado   |
| `Minha Serie S02E05 O Retorno.mp4` | série Minha Serie, T2 E5, título O Retorno  |

Dá pra corrigir qualquer coisa depois no menu **…** → Editar informações.

### Capa e dados de fontes externas

Quando o arquivo não tem tag nem capa embutida, o app busca fora:

| Fonte             | Serve pra                                  | Chave                     |
| ----------------- | ------------------------------------------ | ------------------------- |
| iTunes Search     | artista, título, álbum, ano, faixa, gênero, capa 600×600 | não precisa |
| Deezer            | reserva pra capa (1000×1000)               | não precisa               |
| TMDB              | filme e série: título do episódio, ano, pôster/backdrop | `TMDB_API_KEY` |

Acontece em dois momentos:

- **No upload/scan**, automático, só pros campos que estão vazios — tag do arquivo sempre
  ganha da API. Desligue com `ENRICH_ON_INGEST=false`.
- **No menu … → "Buscar capa e dados"**, manual. Mostra os resultados com miniatura pra você
  escolher, e aí sim sobrescreve (foi você que mandou). Tem um campo de busca pra redigitar
  quando o nome do arquivo é ruim demais pra achar sozinho.

Música funciona sem configurar nada. Vídeo fica desligado até você pôr a chave do TMDB
(gratuita, em https://www.themoviedb.org/settings/api — pegue a **API Key v3**, a curtinha).

Formatos: mp3, m4a, aac, flac, ogg, opus, wav (áudio) e mp4, m4v, mkv, webm, mov, avi (vídeo).
Não tem transcodificação — o navegador toca o arquivo como ele é, então prefira **mp4 (H.264 + AAC)**
pra vídeo, que funciona em tudo. MKV só toca em alguns navegadores.

---

## qBittorrent (opcional)

Se o qBittorrent roda na mesma máquina do Sonify, dá pra fechar o ciclo: você cola o magnet na
aba **Downloads**, acompanha o progresso e, quando termina, o Sonify sobe os arquivos pro bucket,
cadastra na biblioteca (com capa e metadados) e remove o torrent junto com os arquivos locais.

1. No qBittorrent: **Ferramentas → Opções → Web UI**, marque "Web User Interface (Remote control)",
   escolha a porta e defina usuário e senha.
2. No `.env`:

```env
QBIT_URL=http://localhost:8080
QBIT_USER=admin
QBIT_PASS=sua-senha
```

O Sonify só mexe em torrent da categoria `sonify` (`QBIT_CATEGORY`) — ele marca os que você
adiciona pelo app. O resto do seu qBittorrent fica intocado.

| Variável              | Padrão   | O que faz                                              |
| --------------------- | -------- | ------------------------------------------------------ |
| `QBIT_AUTO_IMPORT`    | `true`   | Importa sozinho ao concluir. `false` = só o botão manual |
| `QBIT_DELETE_AFTER`   | `true`   | Remove torrent e arquivos após importar. `false` = segue semeando |
| `QBIT_POLL_SECONDS`   | `30`     | De quanto em quanto tempo checa se terminou             |
| `QBIT_MIN_FILE_BYTES` | `300000` | Ignora arquivo menor que isso (sample, sobra)           |
| `QBIT_SAVE_PATH`      | —        | Pasta de download (em branco = padrão do qBittorrent)   |

Arquivo que não é mídia (`.txt`, `.nfo`, `.jpg`) é ignorado. Se a importação falhar no meio, o
torrent **não** é apagado e a tela mostra o erro com um "tentar de novo".

Como o arquivo já está no disco nesse caminho, as tags são lidas do arquivo inteiro — a duração
sai exata até em mp4 com o índice no fim.

---

## Explorar

Aba que mostra o que está em alta fora da sua biblioteca, pra você descobrir o que buscar:

| Seção                   | Fonte                          | Chave       |
| ----------------------- | ------------------------------ | ----------- |
| Álbuns e músicas em alta, MPB, sertanejo, rap BR | Deezer charts | não precisa |
| Mais baixados na Apple  | RSS do iTunes                  | não precisa |
| Filmes e séries em alta, populares, mais bem avaliados | TMDB | `TMDB_API_KEY` |

Tem busca própria (procura no Deezer e no TMDB ao mesmo tempo) e o catálogo fica em cache por
15 min pra não martelar as APIs.

Clicando num item abre o detalhe com um botão **"Procurar no qBittorrent"**: ele usa os plugins
de busca do próprio qBittorrent, lista os resultados ordenados por seeds e, ao clicar em um, manda
baixar. Daí o fluxo é o mesmo de sempre — termina, sobe pro bucket, entra na biblioteca.

### Termos preferidos (Ajustes → Busca)

No espírito das *preferred words* do Radarr: você monta uma lista em ordem de prioridade e os
resultados da busca são ordenados por ela. Quem está mais em cima vale mais ponto; empate desempata
por seeds. Padrão de fábrica:

```
dual audio > dublado > pt-br > ptbr > portugues > nacional > multi > legendado > 1080p
```

Serve pra idioma e também pra qualidade — é só pôr `2160p`, `remux` ou `web-dl` na lista.

Tem também uma lista de **termos bloqueados** (padrão: `cam`, `hdcam`, `ts`, `telesync`…), que
somem dos resultados, e um interruptor **"mostrar só o que bate com algum termo"** pra esconder
todo o resto. Mesmo ligado, a tela de busca oferece um "mostrar mesmo assim".

A comparação é por **palavra inteira** depois de normalizar acento e separador, então `pt-br`,
`PT_BR` e `PT.BR` são a mesma coisa, e bloquear `cam` não derruba "Camila Cabello".

Tudo isso fica no banco, editável pela interface — não precisa mexer no `.env` nem reiniciar.

O botão só aparece pro admin. A busca exige pelo menos um **plugin de busca ativo** no qBittorrent
(Exibir → Motor de busca → Plugins de busca); sem nenhum, o app avisa em vez de ficar rodando à toa.
As sugestões do catálogo já vêm com o termo de busca montado (`Artista Álbum`, ou `Filme Ano`).

Defina `CATALOGO_PAIS` (padrão `br`) pra mudar o país do RSS da Apple.

---

## Instalar como app no celular

Abra o site no Chrome/Safari e use "Adicionar à tela de início". É uma PWA: abre sem barra de
navegador, tem ícone próprio e o shell fica em cache (a mídia não — ela sempre vem do bucket).

Pra funcionar precisa de **HTTPS** (localhost também serve).

---

## Deploy no EasyPanel (Docker)

O `Dockerfile` já está pronto. No EasyPanel:

1. **Create Service → App**, nome `sonify`.
2. **Source**: GitHub → este repositório, branch `main`.
3. **Build**: método **Dockerfile** (o painel detecta sozinho).
4. **Environment**: cole as variáveis (mínimo `JWT_SECRET`, `S3_*`). Gere o segredo com
   `openssl rand -hex 32`. Veja o `.env.example` — no EasyPanel elas vão no painel, não em arquivo.
5. **Volumes**: monte um volume em **`/app/data`**. É onde ficam o SQLite e as capas — sem isso
   você perde as contas e a biblioteca a cada deploy.
6. **Domains**: aponte seu domínio pra porta **3000**. O EasyPanel cuida do HTTPS, que a PWA exige.

O container roda como usuário sem privilégio, tem healthcheck em `/api/health` e não precisa de
banco externo nem Redis.

Se for usar a integração com qBittorrent, ele precisa estar acessível a partir do container —
como outro serviço no mesmo projeto do EasyPanel (`QBIT_URL=http://qbittorrent:8080`), por exemplo.
Nesse caso o import automático só funciona se os dois compartilharem o volume de downloads.

## Deploy numa VPS (sem Docker)

```bash
git clone ... && cd sonify
npm install && npm run build
```

Rode com systemd:

```ini
[Unit]
Description=Sonify
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/sonify
ExecStart=/usr/bin/node server.js
Environment=NODE_ENV=production
Restart=always
User=sonify

[Install]
WantedBy=multi-user.target
```

Coloque um nginx/Caddy na frente pra terminar o TLS e apontar pra `localhost:3000`.
Só isso — não tem Docker, Redis, nem banco externo.

---

## Estrutura

```
server.js              entrypoint: monta rotas, serve o dist/
schema.sql             esquema SQLite (roda sozinho no boot)
server/
  env.js               .env + validação
  db.js                conexão SQLite + helpers
  auth.js              JWT, bcrypt, requireAuth/requireAdmin
  storage.js           cliente S3, URLs assinadas, listagem
  metadata.js          leitura de tags, capa, fallback pelo nome
  routes/
    auth.js            setup inicial, login, perfil
    users.js           CRUD de perfis (admin)
    library.js         faixas, álbuns, artistas, vídeos, busca
    playback.js        streaming, favoritos, progresso, histórico
    playlists.js       playlists e itens
    ingest.js          upload presigned + scan do bucket
src/
  lib/                 api, auth, player (contexto do <audio>), hooks
  components/          shell, player, listas, cards, sheets
  pages/               telas
scripts/
  create-admin.js      cria/reseta um admin pelo terminal
  make-icons.mjs       gera os ícones do PWA
data/                  sonify.db + capas extraídas (não versionar)
```

## Comandos

| Comando                | O que faz                                        |
| ---------------------- | ------------------------------------------------ |
| `npm run dev`          | front + API com reload                           |
| `npm run build`        | build de produção do front                       |
| `npm start`            | sobe tudo em :3000                               |
| `npm run db:migrate`   | aplica o schema (idempotente)                    |
| `npm run create-admin` | cria ou reseta a senha de um admin pelo terminal |
| `npm run icons`        | regera os ícones do PWA                          |

## Notas

- O token de login vale 60 dias, pra não ficar relogando no celular.
- As URLs de streaming são assinadas e valem 6h (`SIGNED_URL_TTL`).
- As capas são extraídas das tags e guardadas em `data/covers/` com nome = hash do conteúdo,
  então repetem entre faixas do mesmo álbum e podem ter cache eterno.
- Quem não tem capa ganha um degradê gerado a partir do nome do álbum/artista.
- Apagar da biblioteca **não** apaga do bucket (a não ser que você chame a API com `?purge=1`).
