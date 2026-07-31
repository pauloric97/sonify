import { one, run } from './db.js';

/**
 * Preferências de busca de torrent, no espírito das "preferred words" do Radarr:
 * a ordem da lista é a prioridade — quem está em cima vale mais ponto.
 */
export const PADROES = {
  termosPreferidos: [
    'dual audio',
    'dublado',
    'pt-br',
    'ptbr',
    'portugues',
    'nacional',
    'multi',
    'legendado',
    '1080p',
  ],
  termosBloqueados: ['cam', 'hdcam', 'camrip', 'ts', 'telesync', 'telecine', 'hdts'],
  // Esconde tudo que não bate com nenhum termo preferido (padrão: só ordena).
  somentePreferidos: false,
};

export function lerConfig(chave) {
  const linha = one('SELECT valor FROM config WHERE chave = :chave', { chave });
  if (!linha) return PADROES[chave];
  try {
    return JSON.parse(linha.valor);
  } catch {
    return PADROES[chave];
  }
}

export function salvarConfig(chave, valor) {
  run(
    `INSERT INTO config (chave, valor, atualizado_em) VALUES (:chave, :valor, datetime('now'))
     ON CONFLICT(chave) DO UPDATE SET valor = :valor, atualizado_em = datetime('now')`,
    { chave, valor: JSON.stringify(valor) },
  );
}

export const preferenciasBusca = () => ({
  termosPreferidos: lerConfig('termosPreferidos'),
  termosBloqueados: lerConfig('termosBloqueados'),
  somentePreferidos: lerConfig('somentePreferidos'),
});
