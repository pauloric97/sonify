import { Router } from 'express';
import { requireAdmin, requireAuth } from '../auth.js';
import { PADROES, preferenciasBusca, salvarConfig } from '../config.js';
import { armazenamento } from '../armazenamento.js';

export const configRouter = Router();
configRouter.use(requireAuth, requireAdmin);

/** Diz se os dados sobrevivem ao próximo deploy. */
configRouter.get('/armazenamento', (req, res) => {
  res.json(armazenamento());
});

configRouter.get('/busca', (req, res) => {
  res.json({ ...preferenciasBusca(), padroes: PADROES });
});

const limparLista = (v) =>
  Array.isArray(v)
    ? [...new Set(v.map((t) => String(t).trim().toLowerCase()).filter(Boolean))].slice(0, 60)
    : null;

configRouter.put('/busca', (req, res) => {
  const { termosPreferidos, termosBloqueados, somentePreferidos } = req.body || {};

  const preferidos = limparLista(termosPreferidos);
  const bloqueados = limparLista(termosBloqueados);
  if (preferidos) salvarConfig('termosPreferidos', preferidos);
  if (bloqueados) salvarConfig('termosBloqueados', bloqueados);
  if (typeof somentePreferidos === 'boolean') salvarConfig('somentePreferidos', somentePreferidos);

  res.json(preferenciasBusca());
});
