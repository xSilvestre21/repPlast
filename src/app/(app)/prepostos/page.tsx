import { notFound } from "next/navigation";
import { Sparkles, Users } from "lucide-react";

import { Cabecalho, Cartao, Placa } from "@/components/ui";
import { Pagina } from "@/components/pagina";
import { escreverNumeroBr } from "@/lib/numero-br";
import { escopoAtual } from "@/lib/sessao";

import {
  alternarAtivoPreposto,
  atualizarPreposto,
  inscreverPreposto,
  redefinirSenhaPreposto,
} from "./acoes";
import { ListaPrepostos } from "./lista";

export default async function PaginaPrepostos() {
  const { organizacaoId, db, ehAdmin, plano } = await escopoAtual();

  // Preposto não administra preposto. Some da navegação dele, e some daqui.
  if (!ehAdmin) notFound();

  if (plano !== "PLUS") return <ConvitePlus />;

  const prepostos = await db.usuario.findMany({
    where: { organizacaoId, papel: "REPRESENTANTE" },
    orderBy: [{ ativo: "desc" }, { nome: "asc" }],
    select: {
      id: true,
      nome: true,
      email: true,
      ativo: true,
      comissaoPercentualPadrao: true,
      fornecedores: { select: { fornecedor: { select: { nome: true } } } },
      _count: { select: { clientes: true } },
    },
  });

  return (
    <Pagina>
      <Cabecalho
        icone={Users}
        titulo="Prepostos"
        descricao="Quem vende por você. Cada um entra com o próprio login e enxerga apenas a carteira dele — inclusive a comissão."
      />

      <ListaPrepostos
        inscrever={inscreverPreposto}
        fichas={prepostos.map((p) => ({
          preposto: {
            id: p.id,
            nome: p.nome,
            email: p.email,
            ativo: p.ativo,
            comissaoPercentual: p.comissaoPercentualPadrao
              ? escreverNumeroBr(p.comissaoPercentualPadrao.toString())
              : "",
            industrias: p.fornecedores.map((f) => f.fornecedor.nome).sort(),
            clientes: p._count.clientes,
          },
          // Ligadas aqui, no servidor: só a referência da action atravessa.
          salvar: atualizarPreposto.bind(null, p.id),
          trocarSenha: redefinirSenhaPreposto.bind(null, p.id),
          alternarAtivo: alternarAtivoPreposto.bind(null, p.id),
        }))}
      />
    </Pagina>
  );
}

/**
 * O que a pessoa vê quando o escritório está no plano Padrão.
 *
 * Um 404 seria mentira: a seção existe, ela só não está contratada. E o convite
 * fica sem botão de propósito — não há cobrança no sistema, então prometer
 * "assinar agora" levaria a lugar nenhum.
 */
function ConvitePlus() {
  return (
    <Pagina>
      <Cabecalho
        icone={Users}
        titulo="Prepostos"
        descricao="Põe gente para vender por você, com login próprio."
      />

      <Cartao marcada className="p-6 sm:p-8">
        <div className="flex flex-col gap-4 max-w-xl">
          <Placa icone={Sparkles} tom="sol" />
          <h2 className="text-realce font-semibold tracking-[-0.01em]">
            Isto faz parte do plano Plus
          </h2>
          <p className="text-corpo text-tinta-2 leading-relaxed">
            No Plus, você inscreve prepostos e dá acesso a eles. Cada um entra com o próprio
            e-mail e enxerga apenas os clientes, pedidos e comissões que são dele — o que você
            vê continua sendo tudo.
          </p>
          <p className="text-corpo text-tinta-2 leading-relaxed">
            A comissão passa a ser rateada: a indústria paga ao escritório, e cada preposto
            recebe a fatia combinada com ele.
          </p>
          <p className="text-corpo text-tinta-3 leading-relaxed">
            Seu escritório está no plano Padrão. Fale comigo para trocar.
          </p>
        </div>
      </Cartao>
    </Pagina>
  );
}
