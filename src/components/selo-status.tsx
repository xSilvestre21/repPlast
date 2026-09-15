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
 *
 * O desenho da pílula vem de `Selo`, e não daqui. Este arquivo decide só o que
 * é do pedido: quais estados existem, como se chamam e qual deles é o alcançado.
 */

import { Selo, type TomSelo } from "@/components/ui";

const ESTADOS: Record<string, { rotulo: string; tom: TomSelo }> = {
  ABERTO: { rotulo: "Aberto", tom: "neutro" },
  ENVIADO: { rotulo: "Enviado", tom: "verde" },
  CANCELADO: { rotulo: "Cancelado", tom: "cancelado" },
};

export function SeloStatus({ status }: { status: string }) {
  const estado = ESTADOS[status] ?? ESTADOS.ABERTO;

  return <Selo tom={estado.tom}>{estado.rotulo}</Selo>;
}
