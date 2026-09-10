import { notFound } from "next/navigation";

import { Cabecalho } from "@/components/ui";
import { dbParaOrganizacao } from "@/lib/db";
import { escreverNumeroBr } from "@/lib/numero-br";
import { organizacaoAtual } from "@/lib/sessao";

import {
  adicionarAditivo,
  adicionarFaixa,
  atualizarFornecedor,
  excluirFornecedor,
  removerAditivo,
  removerFaixa,
} from "../acoes";
import { FormularioFornecedor } from "../formulario";
import { SecaoAditivos } from "./aditivos";
import { BotaoExcluir } from "./botao-excluir";
import { SecaoFaixas } from "./faixas";

export default async function PaginaFornecedor({ params }: PageProps<"/fornecedores/[id]">) {
  const { id } = await params;

  const organizacaoId = await organizacaoAtual();
  const db = dbParaOrganizacao(organizacaoId);

  const fornecedor = await db.fornecedor.findFirst({
    where: { id, organizacaoId },
    include: {
      faixas: { orderBy: { minimo: "asc" } },
      aditivos: { orderBy: { nome: "asc" } },
    },
  });

  if (!fornecedor) notFound();

  return (
    <>
      <Cabecalho
        titulo={fornecedor.nome}
        descricao="Condições comerciais, faixas de comissão e aditivos desta indústria."
        acao={
          <BotaoExcluir
            nome={fornecedor.nome}
            acao={excluirFornecedor.bind(null, fornecedor.id)}
          />
        }
      />

      <div className="space-y-5">
        <FormularioFornecedor
          acao={atualizarFornecedor.bind(null, fornecedor.id)}
          rotuloEnvio="Salvar alterações"
          valores={{
            nome: fornecedor.nome,
            razaoSocial: fornecedor.razaoSocial ?? "",
            cnpj: fornecedor.cnpj ?? "",
            emailsPedido: fornecedor.emailsPedido.join(", "),
            ipiPercentual: escreverNumeroBr(fornecedor.ipiPercentual.toString()),
            comissaoPercentual: escreverNumeroBr(fornecedor.comissaoPercentual.toString()),
            unidadeMeta: fornecedor.unidadeMeta,
            modoFaixa: fornecedor.modoFaixa,
            fatorKgPadrao: fornecedor.fatorKgPadrao
              ? escreverNumeroBr(fornecedor.fatorKgPadrao.toString(), 2)
              : "",
          }}
        />

        <SecaoFaixas
          unidadeMeta={fornecedor.unidadeMeta}
          modoFaixa={fornecedor.modoFaixa}
          comissaoBase={fornecedor.comissaoPercentual.toString()}
          faixas={fornecedor.faixas.map((f) => ({
            id: f.id,
            minimo: f.minimo.toString(),
            percentual: f.percentual.toString(),
          }))}
          adicionar={adicionarFaixa.bind(null, fornecedor.id)}
          remover={removerFaixa.bind(null, fornecedor.id)}
        />

        <SecaoAditivos
          aditivos={fornecedor.aditivos.map((a) => ({
            id: a.id,
            nome: a.nome,
            sufixoDescricao: a.sufixoDescricao,
            tipo: a.tipo,
            valor: a.valor.toString(),
          }))}
          adicionar={adicionarAditivo.bind(null, fornecedor.id)}
          remover={removerAditivo.bind(null, fornecedor.id)}
        />
      </div>
    </>
  );
}
