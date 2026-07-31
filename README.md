<div align="center">

# Sonify

**Seu Spotify e sua Netflix, rodando no seu servidor.**

Uma PWA escura que toca os seus mp3 e mp4 guardados num bucket S3-compatível
(Cloudflare R2 ou Backblaze B2), com biblioteca, playlists, perfis por pessoa e
importação automática de downloads.

</div>

---

## Índice

- [O que é](#o-que-é)
- [Como funciona](#como-funciona)
- [O que tem dentro](#o-que-tem-dentro)
- [Começando](#começando)
- [Configuração](#configuração)
- [Colocando mídia na biblioteca](#colocando-mídia-na-biblioteca)
- [Capa e metadados automáticos](#capa-e-metadados-automáticos)
- [Explorar](#explorar)
- [qBittorrent](#qbittorrent)
- [Deploy](#deploy)
- [Instalar no celular](#instalar-no-celular)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Comandos](#comandos)
- [Limitações conhecidas](#limitações-conhecidas)

---

## O que é

Um servidor de mídia pessoal para quem já paga por armazenamento barato em nuvem e quer
ouvir e assistir a própria coleção de qualquer lugar, sem depender de catálogo de terceiros.

A diferença para um Plex ou Jellyfin é onde os arquivos moram: aqui eles ficam num bucket
S3-compatível, não no disco do servidor. Isso significa que a máquina que roda o Sonify pode
ser a VPS mais barata que existir — ela nunca serve os bytes da mídia, só assina a URL e sai
da frente.

**Não é** um serviço de streaming, não busca conteúdo licenciado e não vem com biblioteca
nenhuma: você traz os seus arquivos.

## Como funciona

```
                    ┌──────────────────────────────────────────┐
   navegador ──1──► │  Sonify (Express)     SQLite: metadados,  │
      │             │                       contas, playlists   │
      │             └───────────────┬──────────────────────────┘
      │                             │ 2. assina URL temporária
      │                             ▼
      └──────────3. bytes────► Bucket R2 / B2
```

1. O player pede `/api/stream/:id`.
2. O servidor confere o token e responde **302** para uma URL assinada do bucket, válida por
   algumas horas.
3. O navegador busca o arquivo **direto no bucket**, com *range requests* — por isso o seek
   funciona e a barra de progresso é precisa.

O servidor nunca fica no meio do caminho dos bytes. Ele guarda no SQLite só o que é leve:
título, artista, álbum, duração, quem ouviu o quê, playlists e favoritos. As capas extraídas
das tags ficam em disco com o nome sendo o hash do conteúdo, então repetem entre faixas do
mesmo álbum e podem ter cache eterno.

Como `<audio>` e `<video>` não mandam header `Authorization`, o token do streaming viaja na
query string — é a mesma sessão, só por outro caminho.

**Stack:** Vite + React 19 + TypeScript + Tailwind no front, Express 5 + SQLite no back.
Sem Redis, sem banco externo, sem fila. Um processo Node e um arquivo `.db`.

## O que tem dentro

**Áudio** — fila com aleatório e repetição, favoritos, playlists (públicas ou privadas),
histórico, mais tocadas, busca por título/artista/álbum. Controle pela tela de bloqueio do
celular via Media Session, e atalhos de teclado no desktop.

**Vídeo** — filmes e séries com temporada e episódio, "continuar de onde parou" com a posição
salva a cada 10 s, e próximo episódio automático quando o atual acaba.

**Perfis** — um admin, que sobe conteúdo e administra, e quantos perfis de visualização você
quiser. Cada um com histórico, favoritos e playlists próprios. Cada perfil escolhe sua cor de
destaque.

**PWA** — instala na tela de início, abre sem barra de navegador, com o shell em cache. A mídia
nunca é pré-cacheada: ela sempre vem do bucket.

## Começando

Requisitos: **Node 22+** e um bucket S3-compatível.

```bash
git clone https://github.com/pauloric97/sonify.git
cd sonify
npm install
cp .env.example .env
```

Gere o segredo das sessões e cole no `.env`:

```bash
openssl rand -hex 32
```

Preencha as variáveis `S3_*` (veja abaixo) e suba:

```bash
npm run dev     # front em :5173, API em :3000
```

Abra <http://localhost:5173>. A primeira tela pede para criar a conta de administrador —
quem chegar primeiro vira dono da instância, e depois disso o cadastro fecha.

## Configuração

Tudo por variável de ambiente. O `.env` é lido se existir; em produção use o painel do seu
provedor. Só `JWT_SECRET` e o bloco `S3_*` são obrigatórios.

| Variável | Padrão | Para que serve |
| --- | --- | --- |
| `PORT` | `3000` | Porta do servidor |
| `JWT_SECRET` | — | Segredo das sessões. **Obrigatório** |
| `DATA_DIR` | `./data` | Onde ficam o SQLite e as capas |
| `S3_ENDPOINT` | — | Endpoint do bucket, **com `https://`** |
| `S3_REGION` | `auto` | `auto` no R2; no B2, a região do endpoint |
| `S3_BUCKET` | — | Nome do bucket |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | — | Credenciais |
| `S3_FORCE_PATH_STYLE` | `false` | `true` no Backblaze |
| `S3_PREFIX` | — | Pasta dentro do bucket (ex.: `midia/`) |
| `SIGNED_URL_TTL` | `21600` | Validade das URLs de streaming, em segundos |
| `TMDB_API_KEY` | — | Liga capa e dados de filme/série |
| `ENRICH_ON_INGEST` | `true` | Busca metadados faltantes ao importar |
| `CATALOGO_PAIS` | `br` | País das paradas no Explorar |
| `QBIT_*` | — | Integração com qBittorrent ([abaixo](#qbittorrent)) |

### Cloudflare R2

```env
S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
S3_REGION=auto
S3_FORCE_PATH_STYLE=false
```

As chaves saem em **R2 → Manage R2 API Tokens**, com permissão *Object Read & Write*.

### Backblaze B2

```env
S3_ENDPOINT=https://s3.us-west-004.backblazeb2.com
S3_REGION=us-west-004
S3_FORCE_PATH_STYLE=true
```

Troque `us-west-004` pela região que aparece no endpoint do seu bucket. No B2 a região
**precisa** bater com o endpoint: `auto` só funciona no R2. O app corrige os dois enganos mais
comuns sozinho (endpoint sem `https://`, região `auto` no B2) e avisa no log.

### CORS (opcional)

Só é necessário para o upload sair do navegador direto para o bucket. Sem CORS o app continua
funcionando: ele reenvia o arquivo passando pelo servidor.

<details>
<summary>Regra para Cloudflare R2</summary>

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
</details>

<details>
<summary>Regra para Backblaze B2</summary>

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

Atenção: os presets prontos da interface web do B2 liberam só download. Para permitir
`s3_put` é preciso regra personalizada pela CLI — ou simplesmente deixar o envio pelo
servidor cuidar disso.
</details>

## Colocando mídia na biblioteca

**Enviando pelo app** — *Ajustes → Enviar*. Arraste os arquivos: eles vão do navegador direto
para o bucket, com barra de progresso. Se o bucket não tiver CORS liberado, o app reenvia
passando pelo servidor e avisa na tela.

**Importando o que já está lá** — *Ajustes → Biblioteca → Escanear bucket*. Varre tudo, ignora
o que já está cadastrado e lê as tags de cada arquivo novo baixando só os primeiros 4 MB.
Serve para quem joga os arquivos por fora, com rclone ou pelo painel.

**Por torrent** — veja [qBittorrent](#qbittorrent).

Formatos aceitos: mp3, m4a, aac, flac, ogg, opus, wav, wma para áudio; mp4, m4v, mkv, webm,
mov, avi para vídeo.

Arquivo sem tag cai no nome:

| Nome do arquivo | Vira |
| --- | --- |
| `03 - Cazuza - Exagerado.mp3` | faixa 3, artista Cazuza, título Exagerado |
| `Minha Serie S02E05 O Retorno.mp4` | série Minha Serie, T2 E5, título O Retorno |

Dá para corrigir qualquer coisa depois no menu **⋯ → Editar informações**.

## Capa e metadados automáticos

Quando o arquivo não traz tag nem capa embutida, o Sonify busca fora:

| Fonte | Traz | Precisa de chave |
| --- | --- | --- |
| iTunes Search | artista, título, álbum, ano, faixa, gênero, capa 600×600 | não |
| Deezer | capa 1000×1000, como reserva | não |
| TMDB | filme e série: título do episódio, ano, pôster e backdrop | sim |

Acontece em dois momentos: **no upload e no scan**, automático e só para os campos vazios — a
tag do arquivo sempre ganha da API; e **no menu ⋯ → Buscar capa e dados**, manual, listando os
resultados com miniatura para você escolher, e aí sim sobrescrevendo.

Música funciona sem configurar nada. Vídeo depende de uma chave gratuita do
[TMDB](https://www.themoviedb.org/settings/api) (a *API Key v3*).

## Explorar

Uma aba que mostra o que está em alta fora da sua biblioteca, para descobrir o que buscar:
paradas de álbuns e faixas do Deezer, mais baixados do RSS da Apple e seções por gênero, tudo
sem chave; filmes e séries em alta, populares e mais bem avaliados pelo TMDB. Tem busca própria
e o catálogo fica 15 min em cache.

Clicando num item abre o detalhe com o botão **Procurar no qBittorrent**, com o termo de busca
já montado.

## qBittorrent

Se o qBittorrent roda na mesma máquina, o ciclo fecha sozinho: você cola o magnet na aba
**Downloads**, acompanha o progresso e, ao terminar, o Sonify sobe os arquivos para o bucket,
cadastra na biblioteca com capa e metadados, e remove o torrent junto com os arquivos locais.

1. No qBittorrent: **Ferramentas → Opções → Web UI**, ative a interface e defina usuário e senha.
2. No `.env`:

```env
QBIT_URL=http://localhost:8080
QBIT_USER=admin
QBIT_PASS=sua-senha
```

O Sonify só enxerga e mexe em torrents da categoria `sonify` — o resto do seu qBittorrent fica
intocado. Arquivo que não é mídia é ignorado, assim como arquivos pequenos demais (sample,
sobra). Se a importação falhar no meio, o torrent **não** é apagado e a tela mostra o erro com
um "tentar de novo".

| Variável | Padrão | O que faz |
| --- | --- | --- |
| `QBIT_CATEGORY` | `sonify` | Categoria gerenciada pelo app |
| `QBIT_AUTO_IMPORT` | `true` | Importar sozinho ao concluir |
| `QBIT_DELETE_AFTER` | `true` | Apagar torrent e arquivos após importar |
| `QBIT_POLL_SECONDS` | `30` | Intervalo de verificação |
| `QBIT_MIN_FILE_BYTES` | `300000` | Ignora arquivos menores que isso |
| `QBIT_SAVE_PATH` | — | Pasta de download (vazio = padrão do qBittorrent) |

### Termos preferidos

No espírito das *preferred words* do Radarr: em **Ajustes → Busca** você monta uma lista em
ordem de prioridade e os resultados são ordenados por ela. Quem está mais em cima vale mais
ponto; empate desempata por seeds.

```
dual audio > dublado > pt-br > ptbr > portugues > nacional > multi > legendado > 1080p
```

Serve para idioma e também para qualidade — basta pôr `2160p` ou `remux` na lista. Há ainda
uma lista de **termos bloqueados** (`cam`, `hdcam`, `ts`, `telesync`…), que somem dos
resultados, e um interruptor para esconder tudo que não bate com nenhum termo.

A comparação é por **palavra inteira**, depois de normalizar acento e separador: `pt-br`,
`PT_BR` e `PT.BR` são a mesma coisa, e bloquear `cam` não derruba "Camila Cabello". Tudo isso
fica no banco e é editável pela interface, sem reiniciar.

> A busca depende de ter pelo menos um **plugin de busca ativo** no qBittorrent
> (*Exibir → Motor de busca*). Sem nenhum, o app avisa em vez de ficar tentando.

## Deploy

### Docker / EasyPanel

O `Dockerfile` já está pronto — multi-stage, imagem final sem ferramenta de build, rodando
como usuário sem privilégio e com healthcheck em `/api/health`.

```bash
docker build -t sonify .
docker run -d --name sonify -p 3000:3000 \
  -v sonify-data:/app/data \
  -e JWT_SECRET=... -e S3_ENDPOINT=... -e S3_BUCKET=... \
  -e S3_ACCESS_KEY_ID=... -e S3_SECRET_ACCESS_KEY=... \
  sonify
```

No **EasyPanel**: Create Service → App, source no GitHub, build por **Dockerfile**, variáveis
no painel, volume em **`/app/data`** e o domínio apontando para a porta **3000**.

> O volume em `/app/data` não é opcional: é onde vivem o banco e as capas. Sem ele você perde
> as contas e a biblioteca a cada deploy.

### VPS sem Docker

```bash
npm install && npm run build
npm start          # tudo em :3000
```

Coloque um nginx ou Caddy na frente para o TLS, apontando para `localhost:3000`. A PWA exige
HTTPS para instalar.

<details>
<summary>Unidade systemd</summary>

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
</details>

## Instalar no celular

Abra o site e use "Adicionar à tela de início". Precisa de HTTPS (localhost também serve).

Depois de cada deploy, a primeira visita ainda serve a versão em cache e a segunda já pega a
nova — é como o service worker se atualiza.

## Estrutura do projeto

```
server.js              entrypoint: monta as rotas e serve o dist/
schema.sql             esquema SQLite, aplicado sozinho no boot
server/
  env.js               leitura e validação das variáveis
  db.js                conexão SQLite e helpers
  auth.js              JWT, bcrypt, requireAuth / requireAdmin
  storage.js           cliente S3, URLs assinadas, listagem
  metadata.js          tags, capa embutida, fallback pelo nome
  enrich.js            iTunes, Deezer e TMDB
  catalogo.js          paradas e destaques do Explorar
  ingestir.js          núcleo compartilhado de ingestão
  qbittorrent.js       cliente da WebUI API
  torrent-worker.js    laço que importa torrent concluído
  ranking.js           pontuação dos resultados de busca
  config.js            preferências editáveis pela interface
  routes/              auth, users, library, playback, playlists,
                       ingest, torrents, catalogo, config
src/
  lib/                 api, auth, player (contexto do <audio>), hooks
  components/          shell, player, listas, cards, sheets
  pages/               telas
scripts/
  create-admin.js      cria ou reseta um admin pelo terminal
  make-icons.mjs       gera os ícones do PWA sem dependência externa
data/                  sonify.db e capas extraídas (fora do git)
```

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Front e API juntos, com reload |
| `npm run build` | Build de produção do front |
| `npm start` | Sobe tudo em `:3000` |
| `npm run db:migrate` | Aplica o schema (idempotente) |
| `npm run create-admin` | Cria ou reseta um admin pelo terminal |
| `npm run icons` | Regera os ícones do PWA |

## Limitações conhecidas

- **Sem transcodificação.** O navegador toca o arquivo como ele é. Para vídeo, prefira
  **mp4 (H.264 + AAC)**, que funciona em tudo; mkv só toca em alguns navegadores.
- **Sem download offline.** O shell do app fica em cache, a mídia não.
- Apagar da biblioteca **não** apaga do bucket, a menos que se chame a API com `?purge=1`.
- Arquivo com header quebrado pode entrar sem duração; o player grava a duração correta na
  primeira vez que toca.

---

<div align="center">
<sub>Projeto pessoal. Você traz os seus arquivos — o Sonify só organiza e toca.</sub>
</div>
