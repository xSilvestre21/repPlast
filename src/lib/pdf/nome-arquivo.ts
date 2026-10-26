/**
 * Nome do arquivo PDF do pedido.
 *
 * Reproduz o padrão dos pedidos reais em `referencia/`:
 *
 *     2253-ORION-PC-228156-09-10-2026.pdf
 *     2256-VEGAPACK-30-09-2026.pdf
 *     133-COSTA-MELO-12-06-2026.pdf
 *
 * Número, apelido do cliente, o pedido de compra dele quando houver, e a data
 * de ENTREGA — não a de emissão. A amostra abre com "AMOSTRA-", para não se
 * confundir na pasta da indústria com o pedido de venda. Isso não é detalhe estético: quem recebe
 * arquiva por esse nome, e mudá-lo atrapalharia quem já tem a pasta organizada.
 *
 * Módulo separado do gerador para poder ser testado sem carregar o renderizador
 * de PDF nem o banco.
 */

export function nomeArquivoPedido(pedido: {
  numero: number;
  apelidoCliente: string;
  pedidoDoCliente: string | null;
  prazoEntrega: Date | null;
  amostra?: boolean;
}): string {
  const data = pedido.prazoEntrega ?? new Date();
  const dia = String(data.getUTCDate()).padStart(2, "0");
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");

  const partes = [
    pedido.amostra ? "AMOSTRA" : null,
    String(pedido.numero),
    normalizar(pedido.apelidoCliente),
    pedido.pedidoDoCliente ? `PC-${normalizar(pedido.pedidoDoCliente)}` : null,
    `${dia}-${mes}-${data.getUTCFullYear()}`,
  ].filter(Boolean);

  return `${partes.join("-")}.pdf`;
}

/** Deixa só letras sem acento, dígitos e hifens — nome de arquivo tem que viajar bem. */
function normalizar(texto: string): string {
  return semAcento(texto).toUpperCase();
}

/** O mesmo, mantendo maiúsculas e minúsculas como foram digitadas. */
function semAcento(texto: string): string {
  return texto
    .normalize("NFD")
    // Remove os acentos que o NFD separou das letras.
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Nome do arquivo do relatório dos gráficos (PDF, HTML e planilha).
 *
 *     Relatorio-Representacao-Modelo-09-2026.pdf   ← período "2026-09"
 *     Relatorio-Representacao-Modelo-2026.xlsx     ← período "2026"
 *
 * O período é uma competência ("AAAA-MM") ou só o ano ("AAAA"), e sai na
 * ordem de leitura: mês antes do ano, como as datas dos outros arquivos.
 *
 * O nome do escritório vai como foi cadastrado, só sem acento e com hífen no
 * lugar do espaço: o nome viaja no `Content-Disposition`, que só aceita ASCII
 * em `filename=` — com "ç" alguns navegadores trocam o nome por "download".
 */
export function nomeArquivoRelatorio(escritorio: string, periodo: string, extensao: string): string {
  const quando = periodo.split("-").reverse().join("-");
  return `Relatorio-${semAcento(escritorio) || "Escritorio"}-${quando}.${extensao}`;
}

/**
 * Nome do arquivo da proposta.
 *
 * Começa com "orcamento" de propósito: o cliente costuma receber os dois
 * documentos, e o do pedido abre com o número puro. Sem a palavra, dois
 * arquivos na mesma pasta de downloads ficariam indistinguíveis.
 */
export function nomeArquivoOrcamento(numero: number, apelidoCliente: string, data: Date): string {
  const dia = String(data.getDate()).padStart(2, "0");
  const mes = String(data.getMonth() + 1).padStart(2, "0");

  const limpo = apelidoCliente
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toUpperCase();

  return `orcamento-${numero}-${limpo}-${dia}-${mes}-${data.getFullYear()}.pdf`;
}
