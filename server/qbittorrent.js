import { env } from './env.js';

/**
 * Cliente da WebUI API do qBittorrent (v2).
 * Guarda o cookie SID e refaz o login sozinho quando a sessão cai.
 */

let sid = null;
let loginEmAndamento = null;

export const qbitConfigurado = () => Boolean(env.qbit.url);

const base = () => env.qbit.url.replace(/\/+$/, '');

function erro(msg, status = 502) {
  return Object.assign(new Error(msg), { status });
}

/**
 * Reaproveita a sessão. Isso não é otimização: o qBittorrent guarda os jobs de
 * busca *dentro da sessão*, então relogar entre o search/start e o search/results
 * faz o job "sumir" com 404. Só refaz o login quando o servidor recusa o SID (403).
 */
async function login(forcar = false) {
  if (sid && !forcar) return sid;
  if (loginEmAndamento) return loginEmAndamento;

  loginEmAndamento = (async () => {
    let res;
    try {
      res = await fetch(`${base()}/api/v2/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ username: env.qbit.user, password: env.qbit.pass }),
        signal: AbortSignal.timeout(10_000),
      });
    } catch (err) {
      // "fetch failed" sozinho não ajuda ninguém a achar o problema.
      throw erro(
        `Não alcancei o qBittorrent em ${base()} (${err.message}). ` +
          'Confira QBIT_URL, se os dois serviços estão na mesma rede e se a Web UI está escutando em 0.0.0.0.',
        503,
      );
    }

    const texto = (await res.text()).trim();
    // Com "bypass para localhost" ligado, o qBittorrent responde Ok. sem cookie.
    if (texto === 'Fails.') throw erro('qBittorrent recusou o login (usuário ou senha errados)', 401);

    const cookie = res.headers.getSetCookie?.().find((c) => c.startsWith('SID='));
    sid = cookie ? cookie.split(';')[0] : null;
    return sid;
  })().finally(() => {
    loginEmAndamento = null;
  });

  return loginEmAndamento;
}

async function chamar(caminho, { method = 'GET', body, retry = true } = {}) {
  if (!qbitConfigurado()) throw erro('qBittorrent não configurado no .env', 503);

  let res;
  try {
    res = await fetch(`${base()}/api/v2/${caminho}`, {
      method,
      headers: {
        ...(sid ? { Cookie: sid } : {}),
        ...(body instanceof URLSearchParams
          ? { 'Content-Type': 'application/x-www-form-urlencoded' }
          : {}),
      },
      body,
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    throw erro(`Não consegui falar com o qBittorrent em ${base()} (${err.message})`, 503);
  }

  if (res.status === 403 && retry) {
    // Sessão expirou do lado do qBittorrent: pega uma nova e repete uma vez.
    sid = null;
    await login(true);
    return chamar(caminho, { method, body, retry: false });
  }
  if (!res.ok) {
    // O corpo costuma explicar ("Search job was not found", por exemplo).
    const detalhe = await res.text().catch(() => '');
    throw erro(
      `qBittorrent respondeu ${res.status} em ${caminho}${detalhe ? `: ${detalhe.slice(0, 200)}` : ''}`,
    );
  }

  const tipo = res.headers.get('content-type') || '';
  return tipo.includes('application/json') ? res.json() : (await res.text()).trim();
}

/** Testa a conexão e devolve a versão — usado pela tela de ajustes. */
export async function versao() {
  await login();
  return chamar('app/version');
}

export async function listarTorrents() {
  await login();
  const lista = await chamar(
    `torrents/info?category=${encodeURIComponent(env.qbit.category)}&sort=added_on&reverse=true`,
  );
  return (Array.isArray(lista) ? lista : []).map((t) => ({
    hash: t.hash,
    nome: t.name,
    estado: t.state,
    progresso: t.progress,
    tamanho: t.size,
    baixado: t.completed,
    velocidade: t.dlspeed,
    eta: t.eta,
    seeds: t.num_seeds,
    peers: t.num_leechs,
    caminho: t.content_path || t.save_path,
    concluido: t.progress >= 1,
    adicionadoEm: t.added_on,
  }));
}

export async function listarArquivos(hash) {
  await login();
  const arquivos = await chamar(`torrents/files?hash=${hash}`);
  return Array.isArray(arquivos) ? arquivos : [];
}

/** Aceita magnet (string) ou o .torrent em si (Buffer). */
export async function adicionarTorrent({ magnet, torrent, filename }) {
  await login();
  const form = new FormData();
  form.append('category', env.qbit.category);
  if (env.qbit.savePath) form.append('savepath', env.qbit.savePath);

  if (magnet) form.append('urls', magnet);
  else if (torrent)
    form.append('torrents', new Blob([torrent], { type: 'application/x-bittorrent' }), filename || 'arquivo.torrent');
  else throw erro('Manda um magnet ou um arquivo .torrent', 400);

  const resposta = await chamar('torrents/add', { method: 'POST', body: form });
  if (typeof resposta === 'string' && resposta.toLowerCase().includes('fail'))
    throw erro('qBittorrent não aceitou esse torrent');
  return true;
}

export async function pausarTorrent(hash) {
  await login();
  // O endpoint mudou de nome no qBittorrent 5; tenta o novo e cai pro antigo.
  const corpo = new URLSearchParams({ hashes: hash });
  try {
    return await chamar('torrents/stop', { method: 'POST', body: corpo });
  } catch {
    return chamar('torrents/pause', { method: 'POST', body: new URLSearchParams({ hashes: hash }) });
  }
}

export async function retomarTorrent(hash) {
  await login();
  const corpo = new URLSearchParams({ hashes: hash });
  try {
    return await chamar('torrents/start', { method: 'POST', body: corpo });
  } catch {
    return chamar('torrents/resume', { method: 'POST', body: new URLSearchParams({ hashes: hash }) });
  }
}

/* ---------------------------------------------------------------- busca */

/** Plugins de busca instalados no qBittorrent (a busca não funciona sem nenhum). */
export async function pluginsBusca() {
  await login();
  const lista = await chamar('search/plugins');
  return (Array.isArray(lista) ? lista : []).map((p) => ({
    nome: p.fullName || p.name,
    id: p.name,
    ativo: p.enabled,
    url: p.url,
  }));
}

export async function iniciarBusca(padrao) {
  await login();

  const ativos = (await pluginsBusca()).filter((p) => p.ativo);
  if (!ativos.length)
    throw erro(
      'Nenhum plugin de busca ativo no qBittorrent. Abra Exibir → Motor de busca e instale um.',
      412,
    );

  const r = await chamar('search/start', {
    method: 'POST',
    body: new URLSearchParams({ pattern: padrao, plugins: 'enabled', category: 'all' }),
  });
  const id = typeof r === 'object' ? r.id : Number(r);
  if (!id) throw erro('qBittorrent não devolveu o id da busca');
  return id;
}

export async function resultadosBusca(id, limite = 60) {
  await login();
  const r = await chamar(`search/results?id=${id}&limit=${limite}`);
  const itens = (r.results || []).map((x) => ({
    nome: x.fileName,
    tamanho: x.fileSize,
    url: x.fileUrl,
    seeds: x.nbSeeders,
    peers: x.nbLeechers,
    site: x.siteUrl,
  }));
  // Mais seeds primeiro: é o que tem chance real de baixar.
  itens.sort((a, b) => (b.seeds || 0) - (a.seeds || 0));
  return { status: r.status, total: r.total ?? itens.length, itens };
}

export async function pararBusca(id) {
  await login();
  try {
    await chamar('search/stop', { method: 'POST', body: new URLSearchParams({ id: String(id) }) });
    await chamar('search/delete', { method: 'POST', body: new URLSearchParams({ id: String(id) }) });
  } catch {
    // busca já expirada do lado do qBittorrent, tudo bem
  }
}

/** Adiciona pelo link do resultado da busca: pode ser magnet ou URL de .torrent. */
export async function adicionarPorUrl(url) {
  await login();
  const form = new FormData();
  form.append('urls', url);
  form.append('category', env.qbit.category);
  if (env.qbit.savePath) form.append('savepath', env.qbit.savePath);

  const resposta = await chamar('torrents/add', { method: 'POST', body: form });
  if (typeof resposta === 'string' && resposta.toLowerCase().includes('fail'))
    throw erro('qBittorrent não aceitou esse link');
  return true;
}

export async function removerTorrent(hash, apagarArquivos = true) {
  await login();
  return chamar('torrents/delete', {
    method: 'POST',
    body: new URLSearchParams({ hashes: hash, deleteFiles: String(Boolean(apagarArquivos)) }),
  });
}
