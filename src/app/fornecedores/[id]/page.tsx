import { notFound } from "next/navigation";

import { Cabecalho } from "@/components/ui";
import { dbParaOrganizacao } from "@/lib/db";
import { escreverNumeroBr } from "@/lib/numero-br";
import { organizacaoAtual } from "@/lib/sessao";

import {
  adicionarAditivo,
  atualizarFornecedor,
  excluirFornecedor,
  removerAditivo,
  removerLogo,
  salvarLogo,
} from "../acoes";
import { FormularioFornecedor } from "../formulario";
import { SecaoAditivos } from "./aditivos";
import { BotaoExcluir } from "./botao-excluir";
import { SecaoLogo } from "./logo-industria";

export default async function PaginaFornecedor({ params }: PageProps<"/fornecedores/[id]">) {
  const { id } = await params;

  const organizacaoId = await organizacaoAtual();
  const db = dbParaOrganizacao(organizacaoId);

  const fornecedor = await db.fornecedor.findFirst({
    where: { id, organizacaoId },
    // `omit` do logo: são bytes que não têm uso nesta página, e trazê-los a
    // cada carregamento seria desperdício. A imagem vem pela rota própria.
    omit: { logo: true },
    include: {
      aditivos: { orderBy: { nome: "asc" } },
    },
  });

  if (!fornecedor) notFound();

  return (
    <>
      <Cabecalho
        titulo={fornecedor.nome}
        descricao="Condições comerciais, logo e aditivos desta indústria."
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
            fatorKgPadrao: fornecedor.fatorKgPadrao
              ? escreverNumeroBr(fornecedor.fatorKgPadrao.toString(), 2)
              : "",
          }}
        />

        <SecaoLogo
          fornecedorId={fornecedor.id}
          nome={fornecedor.nome}
          temLogo={fornecedor.logoTipo !== null}
          versao={String(fornecedor.atualizadoEm.getTime())}
          salvar={salvarLogo.bind(null, fornecedor.id)}
          remover={removerLogo.bind(null, fornecedor.id)}
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
