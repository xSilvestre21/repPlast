/**
 * A sugestão de variáveis enquanto se digita um modelo de texto, como numa IDE.
 *
 * Abrir chave pede a lista; o que vem depois dela filtra; escolher troca o
 * pedaço digitado pela variável inteira. Módulo puro — a tela só mede onde
 * desenhar a lista —, então tudo que decide alguma coisa é testável em `node`.
 */

/** Uma chave aberta antes do cursor, e o que já foi digitado depois dela. */
export type Gatilho = { inicio: number; termo: string };

/**
 * A chave que o cursor está completando, ou `null`.
 *
 * Só conta a chave ainda aberta: `{nu` sugere, `{numero} e` não. O termo pode
 * ter espaço ("{pedido do"), porque quem procura escreve como fala — mas não
 * pode COMEÇAR com espaço: `{ ` é a pessoa escrevendo chave de verdade. O
 * teto de tamanho evita que uma chave esquecida lá atrás vire busca eterna.
 */
export function gatilhoNoCursor(texto: string, cursor: number): Gatilho | null {
  const antes = texto.slice(0, cursor);
  const casamento = /\{((?:[\p{L}_][\p{L}\p{N}_ ]{0,30})?)$/u.exec(antes);
  if (!casamento) return null;
  return { inicio: casamento.index, termo: casamento[1] };
}

/** Sem acento e sem caixa — "numero" acha "Número do pedido". */
function achatar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/**
 * As variáveis que casam com o termo, pelo nome OU pelo rótulo.
 *
 * Pelo rótulo porque quem monta o texto pensa "razão social", não `cliente`.
 * Cada palavra digitada precisa aparecer, em qualquer ordem; as que começam
 * com o termo inteiro vêm primeiro, que é o que o dedo espera.
 */
export function filtrarVariaveis<T extends { nome: string; rotulo: string }>(
  variaveis: T[],
  termo: string,
): T[] {
  const alvo = achatar(termo).replace(/_/g, " ").replace(/\s+/g, " ").trim();
  if (!alvo) return variaveis;
  const palavras = alvo.split(" ");

  const pontuar = (v: T) => {
    const nome = achatar(v.nome).replace(/_/g, " ");
    const rotulo = achatar(v.rotulo);
    if (nome.startsWith(alvo)) return 0;
    if (rotulo.startsWith(alvo)) return 1;
    if (palavras.every((p) => nome.includes(p) || rotulo.includes(p))) return 2;
    return null;
  };

  return variaveis
    .map((v) => ({ v, nota: pontuar(v) }))
    .filter((x): x is { v: T; nota: number } => x.nota !== null)
    .sort((a, b) => a.nota - b.nota)
    .map((x) => x.v);
}

/**
 * Troca o que vai da chave até o cursor por `abre`, e diz onde o cursor fica.
 *
 * Com `fecha` — o `{fim}` de um trecho condicional —, ele entra logo depois e o
 * cursor fica entre os dois, que é onde a pessoa vai escrever o trecho.
 *
 * Se a pessoa já tinha fechado a chave (`{nu|}`), a de fechamento existente é
 * aproveitada em vez de sobrar uma a mais.
 */
export function inserirVariavel(
  texto: string,
  inicio: number,
  cursor: number,
  abre: string,
  fecha = "",
): { texto: string; cursor: number } {
  const depois = texto.slice(cursor).replace(/^[a-z_]*\}/i, "");
  return {
    texto: texto.slice(0, inicio) + abre + fecha + depois,
    cursor: inicio + abre.length,
  };
}
