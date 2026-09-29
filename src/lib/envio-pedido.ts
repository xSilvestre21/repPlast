/**
 * As regras do envio do pedido por e-mail, fora da tela e da ação.
 *
 * O diálogo usa para mostrar o total dos anexos e contar os destinatários
 * enquanto a pessoa marca; a ação usa as MESMAS funções para decidir, porque o
 * que o navegador conferiu não vale como garantia. Módulo puro, testável sem
 * servidor nem banco.
 */

import * as nucleo from "./modelo-email";

/** O envio fecha o diálogo quando dá certo, e pode voltar com um aviso. */
export type EstadoEnvio = { erro?: string; enviado?: boolean; aviso?: string };

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
  /** A frase quando não há destinatário; a proposta vai para o cliente, não para a indústria. */
  faltaDestinatario?: string;
}): string | null {
  if (entrada.para.length === 0) {
    return entrada.faltaDestinatario ?? "Escolha pelo menos um destinatário na indústria.";
  }

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

/** As variáveis do modelo que não existem — `{clinte}` digitado errado, por exemplo. */
export function variaveisDesconhecidas(modelo: string): string[] {
  return nucleo.variaveisDesconhecidas(modelo, VARIAVEIS_ENVIO);
}

/** Os dados que o modelo usa em `{se …}`, sem repetir e na ordem da lista. */
export function condicoesDoModelo(modelo: string): Variavel[] {
  return nucleo.condicoesDoModelo(modelo, VARIAVEIS_ENVIO) as Variavel[];
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

/** O primeiro problema do modelo, em português de gente, ou `null`. */
export function problemaNoModelo(modelo: string): string | null {
  return nucleo.problemaNoModelo(modelo, VARIAVEIS_ENVIO, "do pedido");
}

/**
 * Assunto e corpo com que o diálogo abre.
 *
 * Parte do modelo da pessoa (ou do texto de sempre) e é só o começo — no
 * diálogo dá para escrever o que o pedido pedir ("urgente, cliente precisa até
 * sexta"). As regras de preenchimento são as de `lib/modelo-email.ts`.
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
    cnpj: pedido.cnpjCliente ?? "",
    pedido_cliente: pedido.pedidoDoCliente ?? "",
    vendedor: pedido.vendedor ?? "",
  };

  return nucleo.preencherModelo(
    {
      assunto: modelo?.assunto || ASSUNTO_ENVIO_PADRAO,
      corpo: modelo?.corpo || MENSAGEM_ENVIO_PADRAO,
    },
    valores,
  );
}
