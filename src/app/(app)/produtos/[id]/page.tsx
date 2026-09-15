import { notFound } from "next/navigation";

import { Cabecalho } from "@/components/ui";
import { escopoAtual } from "@/lib/sessao";

import { atualizarProduto, excluirProduto } from "../acoes";
import { carregarClientes, carregarFornecedores, paraCampo } from "../dados";
import { FormularioProduto } from "../formulario";
import { BotaoExcluir } from "@/components/botao-excluir";
import { Package } from "lucide-react";
import { Pagina } from "@/components/pagina";

export default async function PaginaProduto({ params }: PageProps<"/produtos/[id]">) {
  const { id } = await params;

  const { organizacaoId, db } = await escopoAtual();

  const [produto, fornecedores, clientes] = await Promise.all([
    db.produto.findFirst({
      where: { id, organizacaoId },
      include: { aditivos: { select: { aditivoId: true } } },
    }),
    carregarFornecedores(),
    carregarClientes(),
  ]);

  if (!produto) notFound();

  return (
    <Pagina>
      <Cabecalho
        icone={Package}
        titulo="Produto"
        descricao={produto.descricao}
        acao={
          <BotaoExcluir
            rotulo="Excluir produto"
            nome={produto.descricao}
            acao={excluirProduto.bind(null, produto.id)}
          />
        }
      />

      <FormularioProduto
        fornecedores={fornecedores}
        clientes={clientes}
        acao={atualizarProduto.bind(null, produto.id)}
        rotuloEnvio="Salvar alterações"
        valores={{
          fornecedorId: produto.fornecedorId,
          clienteId: produto.clienteId ?? "",
          familia: produto.familia,
          codigoFornecedor: produto.codigoFornecedor ?? "",
          descricao: produto.descricao,
          material: produto.material ?? "",
          complemento: produto.complemento ?? "",
          unidadeRotulo: produto.unidadeRotulo ?? "",
          larguraCm: paraCampo(produto.larguraCm),
          comprimentoCm: paraCampo(produto.comprimentoCm),
          espessuraMm: paraCampo(produto.espessuraMm),
          densidade: paraCampo(produto.densidade),
          sanfona: produto.sanfona ?? "",
          fatorKg: paraCampo(produto.fatorKg, 2),
          larguraMm: paraCampo(produto.larguraMm),
          metragemM: paraCampo(produto.metragemM),
          micragem: paraCampo(produto.micragem),
          unidadesPorCaixa: produto.unidadesPorCaixa?.toString() ?? "",
          precoUnidade: paraCampo(produto.precoUnidade, 2),
          precoCaixa: paraCampo(produto.precoCaixa, 2),
          precoKg: paraCampo(produto.precoKg, 2),
          unidadeAvulsa: produto.unidadeAvulsa ?? "UN",
          precoAvulso: paraCampo(produto.precoAvulso, 2),
          aditivos: produto.aditivos.map((a) => a.aditivoId),
        }}
      />
    </Pagina>
  );
}
