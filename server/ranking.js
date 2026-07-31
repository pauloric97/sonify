/**
 * Ordena resultados de busca de torrent pelos termos preferidos.
 *
 * A comparação é por palavra inteira depois de normalizar: nome de release usa
 * ponto, hífen e underscore como separador, então "Filme.2024.PT-BR.1080p" e
 * "Filme 2024 ptbr" caem no mesmo formato. Isso também evita o falso positivo
 * clássico de bloquear "cam" e derrubar "Camila Cabello".
 */

export function normalizar(texto) {
  return ` ${String(texto || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;
}

const bate = (nomeNormalizado, termo) => nomeNormalizado.includes(normalizar(termo));

/**
 * Pontua e ordena. Peso = posição na lista (o primeiro termo vale mais).
 * Empate cai pra quem tem mais seeds, que é o que baixa de verdade.
 */
export function ordenarResultados(resultados, preferencias = {}) {
  const preferidos = (preferencias.termosPreferidos || []).filter(Boolean);
  const bloqueados = (preferencias.termosBloqueados || []).filter(Boolean);
  const somentePreferidos = Boolean(preferencias.somentePreferidos);

  const pontuados = resultados
    .map((r) => {
      const nome = normalizar(r.nome);

      const bloqueadoPor = bloqueados.find((t) => bate(nome, t)) || null;
      const termos = [];
      let pontos = 0;

      preferidos.forEach((termo, i) => {
        if (bate(nome, termo)) {
          termos.push(termo);
          pontos += preferidos.length - i;
        }
      });

      return { ...r, pontos, termos, bloqueadoPor };
    })
    .filter((r) => !r.bloqueadoPor)
    .filter((r) => !somentePreferidos || r.pontos > 0);

  pontuados.sort((a, b) => b.pontos - a.pontos || (b.seeds || 0) - (a.seeds || 0));
  return pontuados;
}
