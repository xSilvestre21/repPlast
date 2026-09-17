/**
 * O desfecho da proposta, dito em pílula.
 *
 * ACEITO é verde porque é o único dos quatro que representa trabalho
 * concluído. ABERTO e EXPIRADO ficam neutros: esperar e vencer não são alerta,
 * são estados por onde toda proposta passa.
 *
 * RECUSADO é VERMELHO, e aqui a proposta se afasta do selo do pedido — lá
 * cancelado segue cinza e riscado. A diferença é que o pedido cancelado é um
 * registro que deixou de valer, enquanto a proposta recusada é dinheiro que o
 * escritório perdeu: ela é para ser vista de longe na lista, ao lado do motivo
 * da perda. Foi decisão explícita de quem usa o sistema.
 *
 * A palavra está escrita por extenso nos quatro: quem não distingue as cores
 * continua lendo o estado.
 *
 * O desenho da pílula vem de `Selo`. Aqui ficam só os quatro estados da
 * proposta — antes o mapa de classes estava copiado do selo do pedido, e as
 * duas cópias já tinham começado a divergir.
 */

import { Selo, type TomSelo } from "@/components/ui";

const ESTADOS: Record<string, { rotulo: string; tom: TomSelo }> = {
  ABERTO: { rotulo: "Aberto", tom: "neutro" },
  ACEITO: { rotulo: "Aceito", tom: "verde" },
  RECUSADO: { rotulo: "Recusado", tom: "perigo" },
  EXPIRADO: { rotulo: "Vencido", tom: "neutro" },
};

export function SeloOrcamento({ status }: { status: string }) {
  const estado = ESTADOS[status] ?? ESTADOS.ABERTO;

  return <Selo tom={estado.tom}>{estado.rotulo}</Selo>;
}


/**
 * Para quem a proposta vai — o cliente cadastrado ou o nome que foi digitado.
 *
 * Existe como função porque a pergunta aparece em quatro telas e no PDF, e
 * cada uma resolvendo o `??` por conta própria seria quatro chances de uma
 * delas mostrar "null" para o usuário.
 */
export function destinatario(orcamento: {
  cliente: { apelido: string; razaoSocial?: string } | null;
  clienteAvulsoNome: string | null;
  clienteAvulsoMunicipio?: string | null;
}) {
  if (orcamento.cliente) {
    return {
      nome: orcamento.cliente.apelido,
      razaoSocial: orcamento.cliente.razaoSocial ?? orcamento.cliente.apelido,
      cadastrado: true,
    };
  }

  const nome = orcamento.clienteAvulsoNome ?? "(sem destinatário)";
  return { nome, razaoSocial: nome, cadastrado: false };
}
