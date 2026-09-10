/**
 * Nome do arquivo PDF do pedido.
 *
 * Reproduz o padrão dos pedidos reais em `referencia/`:
 *
 *     2253-MARIOL-PC-228156-09-10-2026.pdf
 *     2256-LEMEPACK-30-09-2026.pdf
 *     133-CASTRO-MACHI-12-06-2026.pdf
 *
 * Número, apelido do cliente, o pedido de compra dele quando houver, e a data
 * de ENTREGA — não a de emissão. Isso não é detalhe estético: quem recebe
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
}): string {
  const data = pedido.prazoEntrega ?? new Date();
  const dia = String(data.getUTCDate()).padStart(2, "0");
  const mes = String(data.getUTCMonth() + 1).padStart(2, "0");

  const partes = [
    String(pedido.numero),
    normalizar(pedido.apelidoCliente),
    pedido.pedidoDoCliente ? `PC-${normalizar(pedido.pedidoDoCliente)}` : null,
    `${dia}-${mes}-${data.getUTCFullYear()}`,
  ].filter(Boolean);

  return `${partes.join("-")}.pdf`;
}

/** Deixa só letras sem acento, dígitos e hifens — nome de arquivo tem que viajar bem. */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    // Remove os acentos que o NFD separou das letras.
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase();
}
