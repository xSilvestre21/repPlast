/**
 * O status do pedido, dito como um documento diria.
 *
 * ENVIADO é um CARIMBO: contorno grosso, caixa alta, levemente torto — tinta
 * aplicada por cima do papel depois de ele estar pronto. É o único lugar da
 * tela, junto da aba ativa, onde o vermelho aparece por bem.
 *
 * CANCELADO não ganha cor nenhuma: um documento cancelado é riscado, não
 * pintado. ABERTO é contorno apagado, porque ainda não aconteceu nada.
 *
 * Cor sozinha não bastaria: quem não distingue vermelho de cinza continua
 * lendo a palavra, que está escrita por extenso em todos os três.
 */
const ESTILOS: Record<string, { rotulo: string; classe: string }> = {
  ABERTO: {
    rotulo: "Aberto",
    classe: "carimbo carimbo-apagado",
  },
  ENVIADO: {
    rotulo: "Enviado",
    classe: "carimbo",
  },
  CANCELADO: {
    rotulo: "Cancelado",
    classe: "carimbo carimbo-apagado line-through decoration-1",
  },
};

export function SeloStatus({ status }: { status: string }) {
  const estilo = ESTILOS[status] ?? ESTILOS.ABERTO;

  return <span className={estilo.classe}>{estilo.rotulo}</span>;
}
