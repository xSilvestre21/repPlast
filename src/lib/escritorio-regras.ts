import { LARGURAS_EM } from "./larguras-escritorio";

/**
 * Regras do nome do escritório, num módulo sem `server-only`: o formulário de
 * cadastro (cliente) e a ação (servidor) leem o mesmo número — como
 * `senha-regras.ts`.
 *
 * 45 caracteres é a trava do campo: acima disso quase nenhum nome cabe no topo
 * (medido com 200 mil nomes montados com o vocabulário de representação), e
 * deixar digitar 60 só para recusar depois era pior. Quem decide de verdade é
 * `cabeNoTopo`: o nome aparece inteiro no topo do aplicativo, sem
 * "…", e um limite por contagem não garante isso — o que decide é onde as
 * palavras quebram. "QUALIPLAST REPRESENTAÇÕES COMERCIAIS" (36) não cabe, porque
 * "REPRESENTAÇÕES" sozinha ocupa quase uma linha; "Moreira & Guimarães
 * Representações Ltda" (39) cabe.
 */
export const TAMANHO_MAXIMO_ESCRITORIO = 45;

/**
 * O menor espaço que o topo dá ao nome, em px, em qualquer largura de janela.
 * Medido em `navegacao.btest.tsx`, que falha se o layout passar a dar menos.
 * O aperto é no notebook (1280 px ou mais): as abas ganham rótulo, ficam no
 * centro exato do topo, e o nome fica com metade do que sobra — 121,2 px.
 */
export const LARGURA_MINIMA_DO_NOME = 121;

/** O último degrau de `NomeQueCabe`: duas linhas de 12 px. */
export const FONTE_MINIMA_DO_NOME = 12;
export const LINHAS_DO_NOME = 2;

/** O `tracking-[-0.03em]` do nome no topo. */
const ESPACAMENTO_EM = -0.03;

/** Caractere fora da tabela (emoji, alfabeto não latino): conta como o mais largo. */
const LARGURA_DESCONHECIDA_EM = Math.max(...Object.values(LARGURAS_EM));

function larguraEm(texto: string) {
  let soma = 0;
  for (const caractere of texto) {
    soma += (LARGURAS_EM[caractere] ?? LARGURA_DESCONHECIDA_EM) + ESPACAMENTO_EM;
  }
  return soma;
}

/**
 * Se o nome cabe inteiro no topo, no menor espaço e na menor fonte.
 *
 * Faz a quebra de linha do navegador — palavra que não cabe desce para a linha
 * de baixo — com as larguras da própria fonte. Erra só para o lado seguro: não
 * desconta o kerning (que aproxima letras) nem quebra depois de hífen, como o
 * navegador faz; e deixa 2 px de folga para o arredondamento.
 */
export function cabeNoTopo(nome: string): boolean {
  const limite = (LARGURA_MINIMA_DO_NOME - 2) / FONTE_MINIMA_DO_NOME;
  const espaco = larguraEm(" ");

  let linhas = 1;
  let linha = 0;
  for (const palavra of nome.trim().split(/\s+/)) {
    const largura = larguraEm(palavra);
    if (largura > limite) return false;
    if (linha === 0) linha = largura;
    else if (linha + espaco + largura <= limite) linha += espaco + largura;
    else {
      linhas++;
      linha = largura;
    }
  }
  return linhas <= LINHAS_DO_NOME;
}

/**
 * O nome como é gravado: sem espaço nas pontas nem espaços repetidos — o
 * mesmo que o topo mostra, já que o navegador junta espaços seguidos.
 */
export function normalizarNomeEscritorio(texto: string): string {
  return texto.trim().replace(/\s+/g, " ");
}

/**
 * Por que o nome não serve, ou `null` se serve. Uma frase só para o cadastro e
 * para a troca em Configurações — a regra é a mesma, e a pessoa não pode ouvir
 * duas versões dela. Não confere se outro escritório já usa o nome: isso é do
 * servidor (`nome-escritorio.ts`).
 */
export function problemaNoNomeEscritorio(nome: string): string | null {
  if (!nome) return "Informe o nome do escritório — é como a sua representação é conhecida.";
  if (nome.length > TAMANHO_MAXIMO_ESCRITORIO) {
    return (
      `O nome do escritório pode ter até ${TAMANHO_MAXIMO_ESCRITORIO} caracteres — este tem ` +
      `${nome.length}. Use o nome pelo qual os clientes conhecem a representação, ` +
      "como “Representação Silvestre”."
    );
  }
  if (!cabeNoTopo(nome)) {
    return (
      "Este nome não cabe inteiro no topo do aplicativo. Encurte um pouco — tire o “Ltda” " +
      "ou abrevie uma palavra longa, como “Representações” para “Rep.”."
    );
  }
  return null;
}

/**
 * Nos primeiros dias depois do cadastro o nome troca à vontade: é quando se
 * percebe o erro de digitação, ou que o nome por extenso ficou pequeno demais
 * no topo. Depois, uma troca por intervalo — de graça, mas sem dar para ficar
 * trocando e soltando nomes para outros escritórios.
 */
export const PRAZO_LIVRE_DIAS = 7;
export const INTERVALO_TROCA_DIAS = 30;

const DIA_MS = 24 * 60 * 60 * 1000;

/**
 * Quando o nome pode ser trocado de novo, ou `null` se já pode agora.
 *
 * Troca feita dentro do prazo livre não conta para o intervalo: quem corrigiu
 * o nome no terceiro dia não fica um mês sem poder corrigir de novo no oitavo.
 */
export function proximaTrocaPermitida({
  criadaEm,
  ultimaTroca,
  agora,
}: {
  criadaEm: Date;
  ultimaTroca: Date | null;
  agora: Date;
}): Date | null {
  const fimDoPrazoLivre = criadaEm.getTime() + PRAZO_LIVRE_DIAS * DIA_MS;
  if (agora.getTime() < fimDoPrazoLivre) return null;
  if (!ultimaTroca || ultimaTroca.getTime() < fimDoPrazoLivre) return null;

  const liberada = new Date(ultimaTroca.getTime() + INTERVALO_TROCA_DIAS * DIA_MS);
  return agora < liberada ? liberada : null;
}

const DATA_DA_TROCA = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "America/Sao_Paulo",
});

/** "14/11/2026" — a data em que a próxima troca fica liberada, no fuso de quem lê. */
export function dataDaProximaTroca(data: Date): string {
  return DATA_DA_TROCA.format(data);
}
