import { notFound } from "next/navigation";

import { Cabecalho } from "@/components/ui";
import { dbParaOrganizacao } from "@/lib/db";
import { organizacaoAtual } from "@/lib/sessao";

import { atualizarProduto, excluirProduto } from "../acoes";
import { carregarFornecedores, paraCampo } from "../dados";
import { FormularioProduto } from "../formulario";
import { BotaoExcluirProduto } from "./botao-excluir";
import { Package } from "lucide-react";
import { Pagina } from "@/components/pagina";

export default async function PaginaProduto({ params }: PageProps<"/produtos/[id]">) {
  const { id } = await params;

  const organizacaoId = await organizacaoAtual();
  const db = dbParaOrganizacao(organizacaoId);

  const [produto, fornecedores] = await Promise.all([
    db.produto.findFirst({
      where: { id, organizacaoId },
      include: { aditivos: { select: { aditivoId: true } } },
    }),
    carregarFornecedores(),
  ]);

  if (!produto) notFound();

  return (
    <Pagina>
      <Cabecalho
        icone={Package}
        titulo="Produto"
        descricao={produto.descricao}
        acao={
          <BotaoExcluirProduto
            descricao={produto.descricao}
            acao={excluirProduto.bind(null, produto.id)}
          />
        }
      />

      <FormularioProduto
        fornecedores={fornecedores}
        acao={atualizarProduto.bind(null, produto.id)}
        rotuloEnvio="Salvar alterações"
        valores={{
          fornecedorId: produto.fornecedorId,
          familia: produto.familia,
          codigoFornecedor: produto.codigoFornecedor ?? "",
          descricao: produto.descricao,
          material: produto.material ?? "",
          complemento: produto.complemento ?? "",
          larguraCm: paraCampo(produto.larguraCm),
          comprimentoCm: paraCampo(produto.comprimentoCm),
          espessuraMm: paraCampo(produto.espessuraMm),
          sanfona: produto.sanfona ?? "",
          fatorKg: paraCampo(produto.fatorKg, 2),
          larguraMm: paraCampo(produto.larguraMm),
          metragemM: paraCampo(produto.metragemM),
          micragem: paraCampo(produto.micragem),
          unidadesPorCaixa: produto.unidadesPorCaixa?.toString() ?? "",
          precoUnidade: paraCampo(produto.precoUnidade, 2),
          precoCaixa: paraCampo(produto.precoCaixa, 2),
          precoKg: paraCampo(produto.precoKg, 2),
          aditivos: produto.aditivos.map((a) => a.aditivoId),
        }}
      />
    </Pagina>
  );
}
