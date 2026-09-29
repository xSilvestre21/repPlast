/**
 * As regras do envio do pedido por e-mail, fora da tela e da ação.
 *
 * O diálogo usa para mostrar o total dos anexos e contar os destinatários
 * enquanto a pessoa marca; a ação usa as MESMAS funções para decidir, porque o
 * que o navegador conferiu não vale como garantia. Módulo puro, testável sem
 * servidor nem banco.
 */

/** Soma dos anexos, o PDF incluído. O Gmail aceita 25 MB; o resto é folga. */
export const LIMITE_ANEXOS_BYTES = 20 * 1024 * 1024;

/*
 * Extensões que servidor de e-mail nenhum deixa passar, e que não têm por que
 * estar num pedido. Recusar aqui dá uma mensagem clara; deixar passar daria um
 * "552 message rejected" do Gmail depois do upload inteiro.
 */
const BLOQUEADAS = [
  "exe", "bat", "cmd", "com", "msi", "scr", "js", "vbs", "jar", "ps1", "sh", "dll", "lnk",
];

const FORMATO_EMAIL = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

export function emailValido(email: string): boolean {
  return FORMATO_EMAIL.test(email);
}

/** Separa o que a pessoa digitou no campo de e-mails avulsos: vírgula, ponto e vírgula, espaço ou linha. */
export function lerListaEmails(texto: string): string[] {
  return texto
    .split(/[\s,;]+/)
    .map((e) => e.trim())
    .filter(Boolean);
}

/**
 * Para quem vai, sem repetir ninguém.
 *
 * `para` é a indústria — os contatos marcados e os digitados. `cc` são as
 * cópias: o cliente e a própria pessoa. Quem já está no `para` não entra de
 * novo no `cc`, e a comparação ignora maiúsculas, que é como o e-mail funciona.
 */
export function montarDestinatarios(entrada: {
  contatos: string[];
  avulsos: string[];
  copiaCliente?: string | null;
  copiaParaMim?: string | null;
}): { para: string[]; cc: string[] } {
  const vistos = new Set<string>();
  const unicos = (lista: (string | null | undefined)[]) =>
    lista.flatMap((email) => {
      const limpo = email?.trim();
      if (!limpo || vistos.has(limpo.toLowerCase())) return [];
      vistos.add(limpo.toLowerCase());
      return [limpo];
    });

  const para = unicos([...entrada.contatos, ...entrada.avulsos]);
  const cc = unicos([entrada.copiaCliente, entrada.copiaParaMim]);

  return { para, cc };
}

/** O primeiro problema do pacote, ou `null` quando pode seguir. */
export function problemaNoEnvio(entrada: {
  para: string[];
  cc: string[];
  assunto: string;
  anexos: { nome: string; tamanho: number }[];
}): string | null {
  if (entrada.para.length === 0) return "Escolha pelo menos um destinatário na indústria.";

  const invalido = [...entrada.para, ...entrada.cc].find((e) => !emailValido(e));
  if (invalido) return `E-mail inválido: ${invalido}`;

  if (!entrada.assunto.trim()) return "O assunto não pode ficar vazio.";

  const bloqueado = entrada.anexos.find((a) =>
    BLOQUEADAS.includes(a.nome.split(".").pop()?.toLowerCase() ?? ""),
  );
  if (bloqueado) return `"${bloqueado.nome}" não pode ir anexado — servidores de e-mail recusam esse tipo de arquivo.`;

  const total = entrada.anexos.reduce((soma, a) => soma + a.tamanho, 0);
  if (total > LIMITE_ANEXOS_BYTES) {
    return `Os anexos somam ${formatarTamanho(total)}. O limite é ${formatarTamanho(LIMITE_ANEXOS_BYTES)}.`;
  }

  return null;
}

export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

/* -------------------------------------------------------------------------- */
/* Texto padrão                                                               */
/* -------------------------------------------------------------------------- */

/**
 * O que dá para escrever entre chaves no modelo.
 *
 * O `rotulo` e o `exemplo` são para quem monta o texto em Configurações — a
 * lista de sugestões e a prévia falam a língua de quem vende, não `{cnpj}`.
 * `podeFaltar` avisa que a linha pode sumir. Os exemplos são inventados de
 * propósito: a prévia não é lugar de dado de cliente.
 */
export const VARIAVEIS_ENVIO = {
  numero: { rotulo: "Número do pedido", exemplo: "2278", podeFaltar: false },
  cliente: { rotulo: "Razão social do cliente", exemplo: "EMBALAGENS EXEMPLO LTDA", podeFaltar: false },
  cnpj: { rotulo: "CNPJ do cliente", exemplo: "12.345.678/0001-90", podeFaltar: true },
  pedido_cliente: { rotulo: "Nº do pedido do cliente", exemplo: "PC-4512", podeFaltar: true },
  vendedor: { rotulo: "Vendedor", exemplo: "Ana Souza", podeFaltar: true },
} as const;

/** O pedido que a prévia de Configurações usa, montado dos exemplos acima. */
export const PEDIDO_EXEMPLO: {
  numero: number;
  razaoSocialCliente: string;
  cnpjCliente: string | null;
  pedidoDoCliente: string | null;
  vendedor: string | null;
} = {
  numero: Number(VARIAVEIS_ENVIO.numero.exemplo),
  razaoSocialCliente: VARIAVEIS_ENVIO.cliente.exemplo,
  cnpjCliente: VARIAVEIS_ENVIO.cnpj.exemplo,
  pedidoDoCliente: VARIAVEIS_ENVIO.pedido_cliente.exemplo,
  vendedor: VARIAVEIS_ENVIO.vendedor.exemplo,
};

export type Variavel = keyof typeof VARIAVEIS_ENVIO;

/** O texto que o envio sempre mandou — vale enquanto a pessoa não escreve o seu. */
export const ASSUNTO_ENVIO_PADRAO = "Pedido nº {numero} — {cliente}";
export const MENSAGEM_ENVIO_PADRAO = [
  "Segue em anexo o pedido nº {numero}.",
  "",
  "Cliente: {cliente}",
  "CNPJ: {cnpj}",
  "Pedido do cliente: {pedido_cliente}",
  "",
  "{vendedor}",
].join("\n");

const VARIAVEL = /\{([a-z_]+)\}/g;

/*
 * O trecho condicional: `{se pedido_cliente}…{fim}` só aparece quando o pedido
 * tem o dado. Pode ocupar várias linhas e ter texto sem variável nenhuma
 * ("Favor conferir com o pedido de compra"), que é o que a regra da linha
 * vazia não alcança.
 */
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
export function variaveisDesconhecidas(modelo: string): string[] {
  const nomes = [
    ...[...modelo.matchAll(VARIAVEL)].map((m) => m[1]).filter((nome) => nome !== "fim"),
    ...[...modelo.matchAll(ABRE_BLOCO)].map((m) => m[1]),
  ];
  return [...new Set(nomes.filter((nome) => !(nome in VARIAVEIS_ENVIO)))];
}

/** Os dados que o modelo usa em `{se …}`, sem repetir e na ordem da lista. */
export function condicoesDoModelo(modelo: string): Variavel[] {
  const usados = new Set([...modelo.matchAll(ABRE_BLOCO)].map((m) => m[1]));
  return (Object.keys(VARIAVEIS_ENVIO) as Variavel[]).filter((nome) => usados.has(nome));
}

/**
 * O pedido de exemplo sem os dados pedidos — para a prévia mostrar o que some.
 * `numero` e `cliente` nunca faltam num pedido, então não saem nem aqui.
 */
export function pedidoExemploSem(nomes: Variavel[]): typeof PEDIDO_EXEMPLO {
  const sem = new Set(nomes);
  return {
    ...PEDIDO_EXEMPLO,
    cnpjCliente: sem.has("cnpj") ? null : PEDIDO_EXEMPLO.cnpjCliente,
    pedidoDoCliente: sem.has("pedido_cliente") ? null : PEDIDO_EXEMPLO.pedidoDoCliente,
    vendedor: sem.has("vendedor") ? null : PEDIDO_EXEMPLO.vendedor,
  };
}

/**
 * O primeiro problema do modelo, em português de gente, ou `null`.
 *
 * Variável que não existe, `{se}` sem `{fim}` e `{fim}` sobrando — os três
 * mandariam para a indústria um texto com chaves no meio.
 */
export function problemaNoModelo(modelo: string): string | null {
  const desconhecidas = variaveisDesconhecidas(modelo);
  if (desconhecidas.length > 0) {
    const lista = desconhecidas.map((v) => `{${v}}`).join(", ");
    return desconhecidas.length === 1
      ? `${lista} não é um dado do pedido.`
      : `${lista} não são dados do pedido.`;
  }

  let resto = modelo;
  while (BLOCO_INTERNO.test(resto)) resto = resto.replace(BLOCO_INTERNO, "");

  const aberto = new RegExp(ABRE_BLOCO.source).exec(resto);
  if (aberto) return `Falta o {fim} do trecho que começa em {se ${aberto[1]}}.`;
  if (resto.includes(FIM_BLOCO)) return "Tem um {fim} sobrando, sem o {se …} que ele fecha.";

  return null;
}

/**
 * Assunto e corpo com que o diálogo abre.
 *
 * Parte do modelo da pessoa (ou do texto de sempre) e é só o começo — no
 * diálogo dá para escrever o que o pedido pedir ("urgente, cliente precisa até
 * sexta").
 *
 * Duas regras tiram o que não se aplica: o trecho `{se x}…{fim}` some quando o
 * pedido não tem `x`, e a linha que depende de um campo vazio some inteira —
 * "CNPJ: " sem CNPJ não diz nada à indústria. Variável desconhecida fica como
 * está, para a pessoa ver o erro em vez de um buraco.
 */
export function textoPadraoDoEnvio(
  pedido: {
    numero: number;
    razaoSocialCliente: string;
    cnpjCliente: string | null;
    pedidoDoCliente: string | null;
    vendedor: string | null;
  },
  modelo?: { assunto?: string | null; corpo?: string | null },
): { assunto: string; corpo: string } {
  const valores: Record<Variavel, string> = {
    numero: String(pedido.numero),
    cliente: pedido.razaoSocialCliente,
    cnpj: pedido.cnpjCliente?.trim() ?? "",
    pedido_cliente: pedido.pedidoDoCliente?.trim() ?? "",
    vendedor: pedido.vendedor?.trim() ?? "",
  };

  const valor = (nome: string) => (nome in valores ? valores[nome as Variavel] : null);
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

  const soMarca = (linha: string) => linha.includes(MARCA) && linha.replaceAll(MARCA, "").trim() === "";

  const linhas = resolverBlocos(modelo?.corpo || MENSAGEM_ENVIO_PADRAO)
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
    assunto: preencher(resolverBlocos(modelo?.assunto || ASSUNTO_ENVIO_PADRAO).replaceAll(MARCA, ""))
      .replace(/\s{2,}/g, " ")
      .trim(),
    corpo: corpo.map(preencher).join("\n").trimEnd(),
  };
}
