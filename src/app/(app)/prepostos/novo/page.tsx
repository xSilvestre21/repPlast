import { notFound, redirect } from "next/navigation";
import { UserPlus } from "lucide-react";

import { Pagina } from "@/components/pagina";
import { Cabecalho, formatarMoeda } from "@/components/ui";
import { PLANOS, valorMensal } from "@/lib/planos";
import { escopoAtual } from "@/lib/sessao";

import { inscreverPreposto } from "../acoes";
import { FormularioPreposto, PREPOSTO_VAZIO } from "../formulario";

export default async function PaginaNovoPreposto() {
  const { ehAdmin, plano, db, organizacaoId } = await escopoAtual();

  // O mesmo porteiro da lista: preposto não inscreve preposto, e fora do Plus
  // a lista é que explica o que falta.
  if (!ehAdmin) notFound();
  if (plano !== "PLUS") redirect("/prepostos");

  const [industrias, ativos, organizacao] = await Promise.all([
    db.fornecedor.findMany({
      where: { organizacaoId, ativo: true },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    }),
    db.usuario.count({ where: { organizacaoId, papel: "REPRESENTANTE", ativo: true } }),
    db.organizacao.findUnique({ where: { id: organizacaoId }, select: { asaasAssinaturaId: true } }),
  ]);

  // Do quarto preposto em diante, cada um soma na mensalidade — dito antes de
  // inscrever, e não descoberto na fatura. `inscreverPreposto` sobe no Asaas.
  const agora = valorMensal(plano, ativos);
  const depois = valorMensal(plano, ativos + 1);
  const aviso =
    organizacao?.asaasAssinaturaId && !agora.equals(depois)
      ? `O escritório já usa os ${PLANOS.PLUS.prepostosInclusos} prepostos inclusos no ${PLANOS.PLUS.nome}. ` +
        `Com este, a mensalidade sobe de ${formatarMoeda(agora.toString())} para ` +
        `${formatarMoeda(depois.toString())}, já na fatura em aberto, sem cobrança proporcional.`
      : null;

  return (
    <Pagina>
      <Cabecalho
        voltar={{ href: "/prepostos", rotulo: "Prepostos" }}
        icone={UserPlus}
        titulo="Novo preposto"
        descricao="Ele entra com o próprio e-mail e senha, e passa a ver apenas os clientes, pedidos e comissões que são dele."
      />
      <FormularioPreposto
        acao={inscreverPreposto}
        valores={PREPOSTO_VAZIO}
        industrias={industrias}
        rotuloEnvio="Inscrever preposto"
        novo
        aviso={aviso}
      />
    </Pagina>
  );
}
