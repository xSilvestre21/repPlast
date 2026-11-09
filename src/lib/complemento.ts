/**
 * As etiquetas de complemento, sobre um campo que continua sendo texto.
 *
 * O complemento é texto livre e é o texto que vai para o banco: as etiquetas só
 * o escrevem. Por isso o estado de cada uma é lido do próprio texto, e não
 * guardado à parte — quem digita "tampa removível" à mão vê a etiqueta acender,
 * e quem apaga a palavra vê apagar.
 *
 * Módulo puro: roda igual em teste, sem navegador.
 */

export interface GrupoComplemento {
  titulo: string;
  /** Aceita uma opção só: marcar outra troca a anterior. É o caso da cor. */
  umaSo?: boolean;
  opcoes: readonly string[];
}

const escapar = (texto: string) => texto.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

/** A opção inteira, entre espaços ou nas pontas do texto, sem olhar a caixa. */
const padraoDa = (opcao: string) => new RegExp(`(^|\\s)${escapar(opcao)}(?=\\s|$)`, "iu");

/**
 * Separa o que no texto é opção do que foi digitado à mão.
 *
 * Da opção mais longa para a mais curta, e cada uma tira o que achou: sem isso,
 * "C/ Disco Ventilado" acenderia também "C/ Disco", e "Por Rosca", "Rosca".
 */
function separar(texto: string, grupos: readonly GrupoComplemento[]) {
  const opcoes = grupos.flatMap((g) => g.opcoes).sort((a, b) => b.length - a.length);
  const marcadas = new Set<string>();
  let resto = texto;

  for (const opcao of opcoes) {
    const padrao = padraoDa(opcao);
    if (padrao.test(resto)) {
      marcadas.add(opcao);
      resto = resto.replace(padrao, "$1");
    }
  }

  return { marcadas, resto: resto.trim().replace(/\s+/g, " ") };
}

/** As opções que já estão escritas no texto. */
export function opcoesMarcadas(
  texto: string,
  grupos: readonly GrupoComplemento[],
): Set<string> {
  return separar(texto, grupos).marcadas;
}

/** O que no texto foi digitado à mão, fora das opções. */
export function textoDigitado(texto: string, grupos: readonly GrupoComplemento[]): string {
  return separar(texto, grupos).resto;
}

/** As opções marcadas na ordem dos grupos, com o digitado à mão no fim. */
function escrever(
  marcadas: ReadonlySet<string>,
  digitado: string,
  grupos: readonly GrupoComplemento[],
) {
  const emOrdem = grupos.flatMap((g) => g.opcoes.filter((o) => marcadas.has(o)));
  return [...emOrdem, digitado.trim()].filter(Boolean).join(" ");
}

/** Troca o que foi digitado à mão, sem mexer nas opções marcadas. */
export function comTextoDigitado(
  texto: string,
  grupos: readonly GrupoComplemento[],
  digitado: string,
): string {
  return escrever(separar(texto, grupos).marcadas, digitado, grupos);
}

/**
 * Põe ou tira uma opção do texto.
 *
 * O texto volta sempre na ordem dos grupos, com o que foi digitado à mão no
 * fim. É o que padroniza a descrição: a ordem dos cliques não muda o que sai
 * impresso, e dois produtos iguais não ficam com descrições diferentes.
 */
export function alternarOpcao(
  texto: string,
  grupos: readonly GrupoComplemento[],
  opcao: string,
): string {
  const { marcadas, resto } = separar(texto, grupos);

  if (marcadas.has(opcao)) {
    marcadas.delete(opcao);
  } else {
    const grupo = grupos.find((g) => g.opcoes.includes(opcao));
    if (grupo?.umaSo) grupo.opcoes.forEach((o) => marcadas.delete(o));
    marcadas.add(opcao);
  }

  return escrever(marcadas, resto, grupos);
}
