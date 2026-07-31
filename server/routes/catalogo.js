import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { buscarNoCatalogo, destaques } from '../catalogo.js';

export const catalogoRouter = Router();
catalogoRouter.use(requireAuth);

// O catálogo é igual pra todo mundo: cacheia por alguns minutos pra não
// martelar as APIs a cada visita.
let cache = { em: 0, dados: null };
const TTL = 15 * 60 * 1000;

catalogoRouter.get('/destaques', async (req, res) => {
  if (cache.dados && Date.now() - cache.em < TTL) return res.json(cache.dados);
  try {
    const dados = await destaques();
    cache = { em: Date.now(), dados };
    res.json(dados);
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});

catalogoRouter.get('/buscar', async (req, res) => {
  try {
    res.json(await buscarNoCatalogo(req.query.q));
  } catch (err) {
    res.status(502).json({ error: err.message });
  }
});
