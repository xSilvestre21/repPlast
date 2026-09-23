import { BotaoLink, Cabecalho, EstadoVazio } from "@/components/ui";
import { escopoAtual } from "@/lib/sessao";

import { criarProduto, criarProdutoDoItem } from "../acoes";
import { carregarClientes, carregarFornecedores } from "../dados";
import { FormularioProduto } from "../formulario";
import { lerConta } from "../leitura";
import { VALORES_VAZIOS } from "../valores";
import { Factory, PackagePlus } from "lucide-react";
import { Pagina } from "@/components/pagina";

export default async function PaginaNovoProduto({ searchParams }: PageProps<"/produtos/novo">) {
  const { orcamentoItem } = await searchParams;

  const [fornecedores, clientes] = await Promise.all([
    carregarFornecedores(),
    carregarClientes(),
  ]);

  if (fornecedores.length === 0) {
    return (
      <Pagina>
        <Cabecalho
          voltar={{ href: "/produtos", rotulo: "Produtos" }}
          icone={PackagePlus}
          titulo="Novo produto"
          acao={
            <BotaoLink href="/fornecedores/novo" icone={Factory}>
              Cadastrar indústria
            </BotaoLink>
          }
        />
        <EstadoVazio icone={Factory}>
          Não há indústria cadastrada.
          <br />
          Todo produto pertence a uma, e é dela que vêm o IPI, a comissão e os aditivos.
        </EstadoVazio>
      </Pagina>
    );
  }

  /*
   * Vindo de um item de proposta: o formulário nasce com a conta que foi feita
   * lá, já no nome do cliente e da indústria da proposta. Falta o que quem só
   * pediu preço não tinha — os códigos —, e ao salvar o item passa a ser este
   * produto e a página volta para a proposta.
   */
  const { organizacaoId, db } = await escopoAtual();
  const item =
    typeof orcamentoItem === "string"
      ? await db.orcamentoItem.findFirst({
          where: {
            id: orcamentoItem,
            produtoId: null,
            orcamento: { organizacaoId, clienteId: { not: null } },
          },
          select: {
            id: true,
            descricao: true,
            conta: true,
            orcamento: {
              select: { id: true, numero: true, clienteId: true, fornecedorId: true },
            },
          },
        })
      : null;
  const conta = item ? lerConta(item.conta) : null;

  if (item && conta) {
    return (
      <Pagina>
        <Cabecalho
          voltar={{
            href: `/orcamentos/${item.orcamento.id}`,
            rotulo: `Orçamento #${item.orcamento.numero}`,
          }}
          icone={PackagePlus}
          titulo="Novo produto"
          descricao="A conta veio da proposta. Complete os códigos e salve — o item passa a ser este produto."
        />
        <FormularioProduto
          fornecedores={fornecedores}
          clientes={clientes}
          valores={{
            ...VALORES_VAZIOS,
            ...conta,
            fornecedorId: item.orcamento.fornecedorId,
            clienteId: item.orcamento.clienteId ?? "",
            descricao: item.descricao,
          }}
          acao={criarProdutoDoItem.bind(null, item.id)}
          rotuloEnvio="Cadastrar e voltar à proposta"
        />
      </Pagina>
    );
  }

  return (
    <Pagina>
      <Cabecalho
        voltar={{ href: "/produtos", rotulo: "Produtos" }}
        icone={PackagePlus}
        titulo="Novo produto"
        descricao="Digite as medidas e veja a descrição e o preço se montarem."
      />
      <FormularioProduto
        fornecedores={fornecedores}
        clientes={clientes}
        valores={{
          ...VALORES_VAZIOS,
          // Com uma única indústria não faz sentido obrigar a escolha.
          fornecedorId: fornecedores.length === 1 ? fornecedores[0].id : "",
        }}
        acao={criarProduto}
        rotuloEnvio="Cadastrar produto"
      />
    </Pagina>
  );
}
