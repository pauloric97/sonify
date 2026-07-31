import { env } from './env.js';
import { all, one, run } from './db.js';
import { importarArquivoLocal } from './ingestir.js';
import {
  listarArquivos,
  listarTorrents,
  qbitConfigurado,
  removerTorrent,
} from './qbittorrent.js';
import path from 'node:path';
import { existsSync } from 'node:fs';

let rodando = false;

const marcar = (hash, campos) => {
  const chaves = Object.keys(campos);
  run(
    `INSERT INTO torrents (hash, ${chaves.join(', ')}) VALUES (:hash, ${chaves.map((k) => `:${k}`).join(', ')})
     ON CONFLICT(hash) DO UPDATE SET ${chaves.map((k) => `${k} = :${k}`).join(', ')}`,
    { hash, ...campos },
  );
};

/**
 * Monta a lista de arquivos de mídia de um torrent no disco.
 * `content_path` é o arquivo direto quando o torrent tem um só; senão é a pasta.
 */
async function arquivosDoTorrent(t) {
  const arquivos = await listarArquivos(t.hash);
  if (!arquivos.length) return existsSync(t.caminho) ? [t.caminho] : [];

  // O `name` de cada arquivo já inclui a pasta raiz do torrent, e o content_path
  // aponta pro arquivo (torrent de 1 arquivo) ou pra essa pasta. Nos dois casos o
  // diretório-pai é a base certa pra juntar com o name.
  const raiz = path.dirname(t.caminho);
  return arquivos
    .filter((a) => a.progress >= 1)
    .map((a) => {
      // O `name` do arquivo já vem relativo à pasta do torrent.
      const direto = path.join(raiz, a.name);
      if (existsSync(direto)) return direto;
      const semPastaRaiz = path.join(raiz, ...a.name.split('/').slice(1));
      return existsSync(semPastaRaiz) ? semPastaRaiz : null;
    })
    .filter(Boolean);
}

async function importar(t, userId) {
  marcar(t.hash, { nome: t.nome, status: 'importando', erro: null });

  const caminhos = await arquivosDoTorrent(t);
  let importados = 0;

  for (const caminho of caminhos) {
    try {
      const media = await importarArquivoLocal({ caminho, userId });
      if (media) {
        importados++;
        console.log(`[torrent] importado: ${media.title}`);
      }
    } catch (err) {
      console.error(`[torrent] falhou em ${path.basename(caminho)}:`, err.message);
      marcar(t.hash, { status: 'erro', erro: err.message, arquivos: importados });
      return; // não apaga o torrent se deu ruim no meio
    }
  }

  if (!importados) {
    marcar(t.hash, { status: 'erro', erro: 'Nenhum arquivo de mídia encontrado no torrent', arquivos: 0 });
    return;
  }

  marcar(t.hash, {
    status: 'ok',
    arquivos: importados,
    erro: null,
    importado_em: new Date().toISOString(),
  });

  if (env.qbit.deleteAfter) {
    try {
      await removerTorrent(t.hash, true);
      console.log(`[torrent] "${t.nome}" removido do qBittorrent junto com os arquivos`);
    } catch (err) {
      console.error('[torrent] importei mas não consegui remover:', err.message);
    }
  }
}

/** Uma passada: procura torrent concluído que ainda não foi importado. */
export async function verificarUmaVez({ forcarHash = null } = {}) {
  if (!qbitConfigurado() || rodando) return;
  rodando = true;
  try {
    const admin = one("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1");
    if (!admin) return;

    const torrents = await listarTorrents();
    const jaVistos = new Map(all('SELECT hash, status FROM torrents').map((r) => [r.hash, r.status]));

    for (const t of torrents) {
      if (forcarHash && t.hash !== forcarHash) continue;
      if (!t.concluido) continue;
      const status = jaVistos.get(t.hash);
      if (status === 'ok' || status === 'importando') continue;
      if (status === 'erro' && !forcarHash) continue; // erro só reprocessa no botão manual

      await importar(t, admin.id);
    }
  } catch (err) {
    console.error('[torrent] ciclo falhou:', err.message);
  } finally {
    rodando = false;
  }
}

export function iniciarWorkerTorrents() {
  if (!qbitConfigurado()) return;
  if (!env.qbit.autoImport) {
    console.log('[torrent] auto-import desligado (QBIT_AUTO_IMPORT=false)');
    return;
  }
  console.log(
    `[torrent] vigiando o qBittorrent a cada ${env.qbit.pollSeconds}s ` +
      `(categoria "${env.qbit.category}", apagar depois: ${env.qbit.deleteAfter})`,
  );
  setTimeout(verificarUmaVez, 5000);
  setInterval(verificarUmaVez, env.qbit.pollSeconds * 1000).unref();
}
