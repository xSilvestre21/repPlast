/**
 * O status do pedido, dito em pílula.
 *
 * ENVIADO é VERDE: é o único dos três que representa trabalho concluído, e o
 * verde é a cor que este sistema reserva para o que foi alcançado.
 *
 * CANCELADO é VERMELHO e riscado. Já foi só riscado, sem cor, com o argumento de
 * que um pedido cancelado não é alerta e sim um registro que deixou de valer —
 * mas o cancelado é venda que não aconteceu e comissão que não entra, e some
 * demais no cinza em meio a uma lista de enviados. Fica como a proposta
 * recusada, que sempre foi vermelha pelo mesmo motivo (ver `orcamentos/selo.tsx`).
 *
 * O risco FICA junto da cor: cor sozinha não carrega estado, e quem não
 * distingue vermelho de verde continua vendo o risco — e a palavra.
 *
 * ABERTO é neutro, porque ainda não aconteceu nada que mereça cor.
 *
 * Cor sozinha não bastaria: quem não distingue verde de cinza continua lendo a
 * palavra, que está escrita por extenso nos três.
 *
 * O desenho da pílula vem de `Selo`, e não daqui. Este arquivo decide só o que
 * é do pedido: quais estados existem, como se chamam e qual deles é o alcançado.
 */

import { Selo, type TomSelo } from "@/components/ui";

const ESTADOS: Record<string, { rotulo: string; tom: TomSelo; riscado?: boolean }> = {
  ABERTO: { rotulo: "Aberto", tom: "neutro" },
  ENVIADO: { rotulo: "Enviado", tom: "verde" },
  /*
   * `perigo` mais o risco por fora, e não o tom `cancelado`: aquele é cinza
   * riscado e continua certo onde está — veste "Inativo" no catálogo de
   * produtos, e produto inativo não é perda de dinheiro nenhuma.
   */
  CANCELADO: { rotulo: "Cancelado", tom: "perigo", riscado: true },
};

export function SeloStatus({ status }: { status: string }) {
  const estado = ESTADOS[status] ?? ESTADOS.ABERTO;

  return (
    <Selo tom={estado.tom} className={estado.riscado ? "line-through decoration-1" : ""}>
      {estado.rotulo}
    </Selo>
  );
}
