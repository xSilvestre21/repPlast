/**
 * O status do pedido, dito em pílula.
 *
 * ENVIADO é VERDE: é o único dos três que representa trabalho concluído, e o
 * verde é a cor que este sistema reserva para o que foi alcançado.
 *
 * CANCELADO é riscado e sem cor — um pedido cancelado não é um alerta, é um
 * registro que deixou de valer. ABERTO é neutro, porque ainda não aconteceu
 * nada que mereça cor.
 *
 * Cor sozinha não bastaria: quem não distingue verde de cinza continua lendo a
 * palavra, que está escrita por extenso nos três.
 */
const ESTILOS: Record<string, { rotulo: string; classe: string }> = {
  ABERTO: {
    rotulo: "Aberto",
    classe: "carimbo carimbo-apagado",
  },
  ENVIADO: {
    rotulo: "Enviado",
    classe: "carimbo carimbo-verde",
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
