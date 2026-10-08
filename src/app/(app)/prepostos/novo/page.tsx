import { notFound, redirect } from "next/navigation";
import { UserPlus } from "lucide-react";

import { Pagina } from "@/components/pagina";
import { Cabecalho } from "@/components/ui";
import { escopoAtual } from "@/lib/sessao";

import { inscreverPreposto } from "../acoes";
import { FormularioPreposto, PREPOSTO_VAZIO } from "../formulario";

export default async function PaginaNovoPreposto() {
  const { ehAdmin, plano, db, organizacaoId } = await escopoAtual();

  // O mesmo porteiro da lista: preposto não inscreve preposto, e fora do Plus
  // a lista é que explica o que falta.
  if (!ehAdmin) notFound();
  if (plano !== "PLUS") redirect("/prepostos");

  const industrias = await db.fornecedor.findMany({
    where: { organizacaoId, ativo: true },
    orderBy: { nome: "asc" },
    select: { id: true, nome: true },
  });

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
      />
    </Pagina>
  );
}
