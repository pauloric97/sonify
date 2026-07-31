import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { coversDir, env } from './env.js';
import { one } from './db.js';

/**
 * Responde a pergunta que todo mundo faz antes do segundo deploy:
 * "se eu subir de novo, perco tudo?"
 *
 * Dentro de um container, o disco é descartável. Só sobrevive o que estiver
 * num volume montado. A prova está em /proc/self/mountinfo: um volume aparece
 * como ponto de montagem próprio; a raiz "/" não conta, porque é a camada
 * efêmera da imagem.
 */

const tamanhoDe = (arquivo) => {
  try {
    return statSync(arquivo).size;
  } catch {
    return 0;
  }
};

/** Exportada separada pra dar pra testar sem estar num container. */
export function analisarMontagem(dir, mountinfo, emContainer) {
  if (!emContainer) return { persistente: true, montagem: null, motivo: 'fora de container' };

  const alvos = mountinfo
    .split('\n')
    .map((linha) => linha.split(' ')[4])
    .filter(Boolean);

  // Sobe do diretório até a raiz procurando um ponto de montagem. "/" é ignorado
  // de propósito: no container ele é a própria camada efêmera.
  let atual = path.resolve(dir);
  while (atual !== '/') {
    if (alvos.includes(atual)) return { persistente: true, montagem: atual, motivo: null };
    const pai = path.dirname(atual);
    if (pai === atual) break;
    atual = pai;
  }

  return {
    persistente: false,
    montagem: null,
    motivo: 'sem volume montado — os dados somem no próximo deploy',
  };
}

export function armazenamento() {
  let mountinfo = '';
  try {
    mountinfo = readFileSync('/proc/self/mountinfo', 'utf8');
  } catch {
    // não é Linux; segue com string vazia
  }

  const emContainer =
    existsSync('/.dockerenv') || /\/(docker|containerd|kubepods)/.test(mountinfo);

  const bancoArquivo = path.join(env.dataDir, 'sonify.db');
  const banco =
    tamanhoDe(bancoArquivo) + tamanhoDe(`${bancoArquivo}-wal`) + tamanhoDe(`${bancoArquivo}-shm`);

  let capas = { quantidade: 0, bytes: 0 };
  try {
    const arquivos = readdirSync(coversDir);
    capas = {
      quantidade: arquivos.length,
      bytes: arquivos.reduce((soma, f) => soma + tamanhoDe(path.join(coversDir, f)), 0),
    };
  } catch {
    // pasta ainda não existe
  }

  const contagens = one(`
    SELECT
      (SELECT COUNT(*) FROM users)     AS usuarios,
      (SELECT COUNT(*) FROM media)     AS midias,
      (SELECT COUNT(*) FROM playlists) AS playlists,
      (SELECT COUNT(*) FROM plays)     AS reproducoes
  `);

  return {
    dataDir: env.dataDir,
    banco: bancoArquivo,
    bancoBytes: banco,
    capas,
    emContainer,
    ...analisarMontagem(env.dataDir, mountinfo, emContainer),
    contagens,
  };
}
