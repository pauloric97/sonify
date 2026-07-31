import { Router } from 'express';
import express from 'express';
import { all, one, run } from '../db.js';
import { requireAdmin, requireAuth } from '../auth.js';
import { env } from '../env.js';
import {
  adicionarPorUrl,
  adicionarTorrent,
  iniciarBusca,
  listarTorrents,
  pararBusca,
  pausarTorrent,
  pluginsBusca,
  qbitConfigurado,
  removerTorrent,
  resultadosBusca,
  retomarTorrent,
  versao,
} from '../qbittorrent.js';
import { verificarUmaVez } from '../torrent-worker.js';
import { preferenciasBusca } from '../config.js';
import { ordenarResultados } from '../ranking.js';

export const torrentsRouter = Router();
const soAdmin = [requireAuth, requireAdmin];

/**
 * Erro sem mensagem vira '{}' no JSON e o front só consegue dizer "Erro 502".
 * Aqui garantimos um texto e deixamos o rastro no log do container.
 */
function responderErro(res, err) {
  const mensagem = err?.message || String(err) || 'Erro desconhecido falando com o qBittorrent';
  console.error('[qbit]', mensagem);
  res.status(err?.status || 502).json({ error: mensagem });
}

/** Estado da conexão — a tela mostra isso quando não está configurado. */
torrentsRouter.get('/status', soAdmin, async (req, res) => {
  if (!qbitConfigurado())
    return res.json({ configurado: false, conectado: false, erro: 'QBIT_URL não definido no .env' });

  try {
    res.json({
      configurado: true,
      conectado: true,
      versao: await versao(),
      categoria: env.qbit.category,
      autoImport: env.qbit.autoImport,
      apagarDepois: env.qbit.deleteAfter,
    });
  } catch (err) {
    res.json({ configurado: true, conectado: false, erro: err.message });
  }
});

/**
 * Percorre cada etapa da integração e diz onde quebra. Existe porque "Erro 502"
 * na tela não conta nada — aqui dá pra ver se parou no login, no plugin ou na busca.
 */
torrentsRouter.get('/diagnostico', soAdmin, async (req, res) => {
  const etapas = [];
  const passo = async (nome, fn) => {
    try {
      const detalhe = await fn();
      etapas.push({ nome, ok: true, detalhe: String(detalhe ?? 'ok') });
      return true;
    } catch (err) {
      etapas.push({ nome, ok: false, detalhe: err?.message || String(err) });
      return false;
    }
  };

  etapas.push({
    nome: 'Configuração',
    ok: qbitConfigurado(),
    detalhe: qbitConfigurado()
      ? `${env.qbit.url} • usuário "${env.qbit.user || '(vazio)'}" • categoria "${env.qbit.category}"`
      : 'QBIT_URL não definido',
  });

  if (qbitConfigurado()) {
    const conectou = await passo('Conexão e login', async () => `qBittorrent ${await versao()}`);

    if (conectou) {
      let temPlugin = false;
      await passo('Plugins de busca', async () => {
        const plugins = await pluginsBusca();
        const ativos = plugins.filter((p) => p.ativo);
        temPlugin = ativos.length > 0;
        if (!plugins.length) throw new Error('nenhum plugin instalado (Exibir → Motor de busca)');
        if (!ativos.length) throw new Error(`${plugins.length} instalado(s), nenhum ativo`);
        return `${ativos.length} ativo(s): ${ativos.map((p) => p.nome).join(', ')}`;
      });

      if (temPlugin) {
        await passo('Busca de teste', async () => {
          const id = await iniciarBusca('ubuntu');
          await new Promise((r) => setTimeout(r, 3000));
          const r = await resultadosBusca(id, 5);
          await pararBusca(id);
          return `status "${r.status}", ${r.total} resultado(s)`;
        });
      }
    }
  }

  res.json({ etapas });
});

torrentsRouter.get('/', soAdmin, async (req, res) => {
  if (!qbitConfigurado()) return res.json({ torrents: [], importacoes: [] });
  try {
    const torrents = await listarTorrents();
    const importacoes = all('SELECT * FROM torrents ORDER BY criado_em DESC LIMIT 50');
    const porHash = new Map(importacoes.map((i) => [i.hash, i]));
    res.json({
      torrents: torrents.map((t) => ({ ...t, importacao: porHash.get(t.hash) || null })),
      importacoes,
    });
  } catch (err) {
    responderErro(res, err);
  }
});

torrentsRouter.post('/', soAdmin, async (req, res) => {
  const magnet = String(req.body?.magnet || '').trim();
  if (!magnet) return res.status(400).json({ error: 'Cole um magnet link' });
  if (!/^magnet:\?/i.test(magnet)) return res.status(400).json({ error: 'Isso não parece um magnet link' });

  try {
    await adicionarTorrent({ magnet });
    res.json({ ok: true });
  } catch (err) {
    responderErro(res, err);
  }
});

/** Upload de .torrent: o corpo vem cru mesmo, é binário. */
torrentsRouter.post(
  '/arquivo',
  soAdmin,
  express.raw({ type: 'application/x-bittorrent', limit: '10mb' }),
  async (req, res) => {
    if (!req.body?.length) return res.status(400).json({ error: 'Arquivo .torrent vazio' });
    try {
      await adicionarTorrent({ torrent: req.body, filename: String(req.query.nome || 'arquivo.torrent') });
      res.json({ ok: true });
    } catch (err) {
      responderErro(res, err);
    }
  },
);

/* ---------------------------------------------------------------- busca */

/** Dispara a busca nos plugins do qBittorrent e devolve o id pra ir puxando os resultados. */
torrentsRouter.post('/buscar', soAdmin, async (req, res) => {
  const termo = String(req.body?.termo || '').trim();
  if (!termo) return res.status(400).json({ error: 'Diga o que procurar' });
  try {
    res.json({ id: await iniciarBusca(termo) });
  } catch (err) {
    responderErro(res, err);
  }
});

torrentsRouter.get('/buscar/:id', soAdmin, async (req, res) => {
  try {
    const r = await resultadosBusca(Number(req.params.id));
    const prefs = preferenciasBusca();
    // `?todos=1` ignora o filtro de "só preferidos" sem mexer na configuração.
    const itens = ordenarResultados(r.itens, {
      ...prefs,
      somentePreferidos: req.query.todos === '1' ? false : prefs.somentePreferidos,
    });
    res.json({ ...r, itens, ocultos: r.itens.length - itens.length });
  } catch (err) {
    responderErro(res, err);
  }
});

torrentsRouter.delete('/buscar/:id', soAdmin, async (req, res) => {
  // Encerrar a busca é melhor esforço: se falhar, o qBittorrent expira sozinho.
  await pararBusca(Number(req.params.id)).catch(() => {});
  res.json({ ok: true });
});

/** Baixa um resultado da busca (magnet ou link de .torrent). */
torrentsRouter.post('/da-busca', soAdmin, async (req, res) => {
  const url = String(req.body?.url || '').trim();
  if (!/^(magnet:\?|https?:\/\/)/i.test(url))
    return res.status(400).json({ error: 'Link inválido' });
  try {
    await adicionarPorUrl(url);
    res.json({ ok: true });
  } catch (err) {
    responderErro(res, err);
  }
});

torrentsRouter.post('/:hash/pausar', soAdmin, async (req, res) => {
  try {
    await pausarTorrent(req.params.hash);
    res.json({ ok: true });
  } catch (err) {
    responderErro(res, err);
  }
});

torrentsRouter.post('/:hash/retomar', soAdmin, async (req, res) => {
  try {
    await retomarTorrent(req.params.hash);
    res.json({ ok: true });
  } catch (err) {
    responderErro(res, err);
  }
});

/** Força a importação agora (ou tenta de novo, se deu erro antes). */
torrentsRouter.post('/:hash/importar', soAdmin, async (req, res) => {
  try {
    run('DELETE FROM torrents WHERE hash = :hash', { hash: req.params.hash });
    await verificarUmaVez({ forcarHash: req.params.hash });
    res.json({ importacao: one('SELECT * FROM torrents WHERE hash = :hash', { hash: req.params.hash }) });
  } catch (err) {
    responderErro(res, err);
  }
});

torrentsRouter.delete('/:hash', soAdmin, async (req, res) => {
  try {
    await removerTorrent(req.params.hash, req.query.arquivos !== '0');
    run('DELETE FROM torrents WHERE hash = :hash', { hash: req.params.hash });
    res.json({ ok: true });
  } catch (err) {
    responderErro(res, err);
  }
});
