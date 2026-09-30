import { notFound } from "next/navigation";

import { Botao, Cabecalho, Selo } from "@/components/ui";
import { escopoAtual } from "@/lib/sessao";

import { alternarAtivoProduto, atualizarProduto, excluirProduto } from "../acoes";
import { carregarClientes, carregarFornecedores, paraCampo } from "../dados";
import { FormularioProduto } from "../formulario";
import { BotaoExcluir } from "@/components/botao-excluir";
import { Archive, ArchiveRestore, Package } from "lucide-react";
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
    carregarClientes(id),
  ]);

  if (!produto) notFound();

  return (
    <Pagina>
      <Cabecalho
        voltar={{ href: "/produtos", rotulo: "Produtos" }}
        icone={Package}
        titulo="Produto"
        descricao={produto.descricao}
        selo={!produto.ativo ? <Selo tom="cancelado">Inativo</Selo> : undefined}
        acao={
          <div className="flex flex-wrap gap-2">
            {/* Inativar é o caminho do produto que o cliente deixou de comprar:
                some das escolhas sem apagar nada. Excluir fica para o cadastro
                feito por engano. */}
            <form action={alternarAtivoProduto.bind(null, produto.id)}>
              <Botao
                type="submit"
                variante="secundaria"
                icone={produto.ativo ? Archive : ArchiveRestore}
              >
                {produto.ativo ? "Marcar como inativo" : "Reativar"}
              </Botao>
            </form>
            <BotaoExcluir
              rotulo="Excluir produto"
              nome={produto.descricao}
              acao={excluirProduto.bind(null, produto.id)}
            />
          </div>
        }
      />

      {!produto.ativo && (
        // Neutro, e não vermelho: inativo é situação, não erro.
        <p className="mb-5 rounded-suave border border-filete bg-folha-2 px-4 py-3 text-corpo text-tinta-2">
          Produto inativo: não aparece ao adicionar item em pedido ou proposta, nem na ficha do
          cliente e na lista padrão de produtos. Pedidos e propostas em que ele já entrou
          continuam como estão.
        </p>
      )}

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
          codigoCliente: produto.codigoCliente ?? "",
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
