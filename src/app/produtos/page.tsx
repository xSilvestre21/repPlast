import Link from "next/link";

import { BotaoLink, Cabecalho, Cartao, EstadoVazio, formatarMoeda } from "@/components/ui";
import { dbParaOrganizacao } from "@/lib/db";
import { precoMilheiroSaco } from "@/lib/precificacao";
import { organizacaoAtual } from "@/lib/sessao";

const ROTULO_FAMILIA: Record<string, string> = {
  SACO: "Saco plástico",
  FITA: "Fita",
  STRETCH: "Stretch",
  BOBINA: "Bobina",
};

export default async function PaginaProdutos() {
  const organizacaoId = await organizacaoAtual();
  const db = dbParaOrganizacao(organizacaoId);

  const produtos = await db.produto.findMany({
    where: { organizacaoId, ativo: true },
    orderBy: [{ fornecedor: { nome: "asc" } }, { descricao: "asc" }],
    include: {
      fornecedor: { select: { nome: true } },
      aditivos: { include: { aditivo: true } },
    },
  });

  /** Preço de referência do produto, na unidade em que ele é vendido. */
  function precoDe(produto: (typeof produtos)[number]) {
    if (produto.familia === "SACO") {
      if (!produto.larguraCm || !produto.comprimentoCm || !produto.espessuraMm || !produto.fatorKg) {
        return null;
      }

      const preco = precoMilheiroSaco({
        larguraCm: produto.larguraCm.toString(),
        comprimentoCm: produto.comprimentoCm.toString(),
        espessuraMm: produto.espessuraMm.toString(),
        fatorKg: produto.fatorKg.toString(),
        aditivos: produto.aditivos.map(({ aditivo }) => ({
          nome: aditivo.nome,
          sufixoDescricao: aditivo.sufixoDescricao,
          tipo: aditivo.tipo,
          valor: aditivo.valor.toString(),
        })),
      });

      return { valor: preco.toNumber(), unidade: "milheiro" };
    }

    if (produto.familia === "FITA") {
      if (produto.precoUnidade) return { valor: Number(produto.precoUnidade), unidade: "unidade" };
      if (produto.precoCaixa) return { valor: Number(produto.precoCaixa), unidade: "caixa" };
      return null;
    }

    return produto.precoKg ? { valor: Number(produto.precoKg), unidade: "kg" } : null;
  }

  return (
    <>
      <Cabecalho
        titulo="Produtos"
        descricao="O preço do saco é calculado pelas medidas; as demais famílias usam preço de tabela."
        acao={<BotaoLink href="/produtos/novo">Novo produto</BotaoLink>}
      />

      {produtos.length === 0 ? (
        <EstadoVazio>
          Nenhum produto cadastrado.
          <br />
          Cadastre a indústria primeiro, depois volte aqui.
        </EstadoVazio>
      ) : (
        <Cartao className="divide-y divide-borda">
          {produtos.map((produto) => {
            const preco = precoDe(produto);

            return (
              <Link
                key={produto.id}
                href={`/produtos/${produto.id}`}
                className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4 hover:bg-superficie-alta/60 transition-colors first:rounded-t-lg last:rounded-b-lg"
              >
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-sm truncate">{produto.descricao}</div>
                  <div className="text-xs text-texto-suave truncate mt-0.5">
                    {produto.fornecedor.nome}
                    {" · "}
                    {ROTULO_FAMILIA[produto.familia] ?? produto.familia}
                    {produto.codigoFornecedor && ` · cód. ${produto.codigoFornecedor}`}
                  </div>
                </div>

                {preco && (
                  <div className="text-right">
                    <div className="numerico text-acento">{formatarMoeda(preco.valor)}</div>
                    <div className="text-xs text-texto-fraco">por {preco.unidade}</div>
                  </div>
                )}
              </Link>
            );
          })}
        </Cartao>
      )}
    </>
  );
}
