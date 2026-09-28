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

/**
 * Assunto e corpo com que o diálogo abre.
 *
 * É o texto que o envio sempre mandou; agora ele é só o começo — a pessoa
 * pode escrever o que o pedido pedir ("urgente, cliente precisa até sexta").
 */
export function textoPadraoDoEnvio(pedido: {
  numero: number;
  razaoSocialCliente: string;
  cnpjCliente: string | null;
  pedidoDoCliente: string | null;
  vendedor: string | null;
}): { assunto: string; corpo: string } {
  return {
    assunto: `Pedido nº ${pedido.numero} — ${pedido.razaoSocialCliente}`,
    corpo: [
      `Segue em anexo o pedido nº ${pedido.numero}.`,
      "",
      `Cliente: ${pedido.razaoSocialCliente}`,
      pedido.cnpjCliente ? `CNPJ: ${pedido.cnpjCliente}` : null,
      pedido.pedidoDoCliente ? `Pedido do cliente: ${pedido.pedidoDoCliente}` : null,
      "",
      pedido.vendedor ?? "",
    ]
      .filter((linha) => linha !== null)
      .join("\n"),
  };
}
