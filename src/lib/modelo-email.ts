/**
 * O motor dos textos padrão de e-mail — o do pedido e o da proposta.
 *
 * Cada documento traz a própria tabela de variáveis (`{numero}`, `{cliente}`…)
 * e os próprios valores; as regras são as mesmas para os dois:
 *
 *   - `{nome}` vira o dado; variável desconhecida fica à vista, como está.
 *   - A linha que depende de um dado vazio some inteira ("CNPJ: " sem CNPJ).
 *   - `{se nome}…{fim}` só aparece quando o documento tem o dado; pode ter
 *     várias linhas, texto sem variável e um bloco dentro do outro.
 *
 * Módulo puro, testável sem servidor nem banco.
 */

/** Uma variável como quem monta o texto a vê: nome de gente e um exemplo. */
export type DefinicaoVariavel = { rotulo: string; exemplo: string; podeFaltar: boolean };
export type TabelaDeVariaveis = Record<string, DefinicaoVariavel>;

const VARIAVEL = /\{([a-z_]+)\}/g;

const ABRE_BLOCO = /\{se ([a-z_]+)\}/g;
const FIM_BLOCO = "{fim}";

/**
 * O bloco mais de dentro: um `{se}` sem outro `{se}` antes do seu `{fim}`.
 * Resolver sempre o de dentro primeiro é o que deixa um bloco dentro do outro.
 */
const BLOCO_INTERNO = /\{se ([a-z_]+)\}((?:(?!\{se [a-z_]+\})[\s\S])*?)\{fim\}/;

/*
 * Marcas do lugar onde havia uma etiqueta de bloco. A linha que ficou só com
 * marcas era linha de etiqueta — `{se x}` sozinho, ou um bloco inteiro que
 * sumiu — e sai do texto; a pessoa escreveu a etiqueta, não uma linha em branco.
 */
const MARCA = "\u0000";

/** As variáveis do modelo que não existem — `{clinte}` digitado errado, por exemplo. */
export function variaveisDesconhecidas(modelo: string, tabela: TabelaDeVariaveis): string[] {
  const nomes = [
    ...[...modelo.matchAll(VARIAVEL)].map((m) => m[1]).filter((nome) => nome !== "fim"),
    ...[...modelo.matchAll(ABRE_BLOCO)].map((m) => m[1]),
  ];
  return [...new Set(nomes.filter((nome) => !(nome in tabela)))];
}

/** Os dados que o modelo usa em `{se …}`, sem repetir e na ordem da tabela. */
export function condicoesDoModelo(modelo: string, tabela: TabelaDeVariaveis): string[] {
  const usados = new Set([...modelo.matchAll(ABRE_BLOCO)].map((m) => m[1]));
  return Object.keys(tabela).filter((nome) => usados.has(nome));
}

/**
 * O primeiro problema do modelo, em português de gente, ou `null`.
 *
 * Variável que não existe, `{se}` sem `{fim}` e `{fim}` sobrando — os três
 * mandariam um texto com chaves no meio. `doDocumento` completa a frase:
 * "não é um dado do pedido", "…da proposta".
 */
export function problemaNoModelo(
  modelo: string,
  tabela: TabelaDeVariaveis,
  doDocumento: string,
): string | null {
  const desconhecidas = variaveisDesconhecidas(modelo, tabela);
  if (desconhecidas.length > 0) {
    const lista = desconhecidas.map((v) => `{${v}}`).join(", ");
    return desconhecidas.length === 1
      ? `${lista} não é um dado ${doDocumento}.`
      : `${lista} não são dados ${doDocumento}.`;
  }

  let resto = modelo;
  while (BLOCO_INTERNO.test(resto)) resto = resto.replace(BLOCO_INTERNO, "");

  const aberto = new RegExp(ABRE_BLOCO.source).exec(resto);
  if (aberto) return `Falta o {fim} do trecho que começa em {se ${aberto[1]}}.`;
  if (resto.includes(FIM_BLOCO)) return "Tem um {fim} sobrando, sem o {se …} que ele fecha.";

  return null;
}

/** Os valores de exemplo da tabela — o documento que a prévia de Configurações usa. */
export function valoresDeExemplo(
  tabela: TabelaDeVariaveis,
  sem: string[] = [],
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(tabela).map(([nome, v]) => [nome, sem.includes(nome) ? "" : v.exemplo]),
  );
}

/**
 * Assunto e corpo preenchidos com os `valores` do documento.
 *
 * Valor vazio ("") quer dizer "o documento não tem": some a linha que depende
 * dele e o trecho `{se}` que o exige. Variável fora de `valores` fica como
 * está, para a pessoa ver o erro em vez de um buraco.
 */
export function preencherModelo(
  modelo: { assunto: string; corpo: string },
  valores: Record<string, string>,
): { assunto: string; corpo: string } {
  const valor = (nome: string) => (nome in valores ? valores[nome].trim() : null);
  const preencher = (texto: string) =>
    texto.replace(VARIAVEL, (bruto, nome: string) => valor(nome) ?? bruto);

  /** Resolve os blocos de dentro para fora, deixando marcas onde havia etiqueta. */
  const resolverBlocos = (texto: string) => {
    let resultado = texto;
    let bloco: RegExpExecArray | null;
    while ((bloco = BLOCO_INTERNO.exec(resultado))) {
      const [inteiro, nome, miolo] = bloco;
      const troca = valor(nome) ? `${MARCA}${miolo}${MARCA}` : MARCA;
      resultado = resultado.replace(inteiro, () => troca);
    }
    return resultado;
  };

  const soMarca = (linha: string) =>
    linha.includes(MARCA) && linha.replaceAll(MARCA, "").trim() === "";

  const linhas = resolverBlocos(modelo.corpo)
    .split("\n")
    .filter((linha) => [...linha.matchAll(VARIAVEL)].every((m) => valor(m[1]) !== ""));

  // Linha de etiqueta sai; e se ela estava entre dois brancos (ou no topo), sai
  // o branco seguinte junto, para o trecho que sumiu não deixar buraco duplo.
  const corpo: string[] = [];
  let pulouEtiqueta = false;
  for (const linha of linhas) {
    if (soMarca(linha)) {
      pulouEtiqueta = true;
      continue;
    }
    const limpa = linha.replaceAll(MARCA, "");
    const branca = limpa.trim() === "";
    if (branca && pulouEtiqueta && (corpo.length === 0 || corpo.at(-1)!.trim() === "")) continue;
    if (!branca) pulouEtiqueta = false;
    corpo.push(limpa);
  }

  return {
    assunto: preencher(resolverBlocos(modelo.assunto).replaceAll(MARCA, ""))
      .replace(/\s{2,}/g, " ")
      .trim(),
    // Uma saudação que dependia de dado vazio ("A/C {aos_cuidados}") não
    // pode deixar o e-mail começando por uma linha em branco.
    corpo: corpo.map(preencher).join("\n").replace(/^\n+/, "").trimEnd(),
  };
}
