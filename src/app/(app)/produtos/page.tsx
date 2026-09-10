import {
  CircleDot,
  Disc3,
  Layers,
  Package,
  PackagePlus,
  Plus,
  ShoppingBag,
  type LucideIcon,
} from "lucide-react";

import {
  BotaoLink,
  Cabecalho,
  Cartao,
  Emblema,
  EstadoVazio,
  LinhaLista,
  formatarMoeda,
} from "@/components/ui";
import { dbParaOrganizacao } from "@/lib/db";
import { precoMilheiroSaco } from "@/lib/precificacao";
import { organizacaoAtual } from "@/lib/sessao";
import { Pagina } from "@/components/pagina";

const ROTULO_FAMILIA: Record<string, string> = {
  SACO: "Saco plástico",
  FITA: "Fita",
  STRETCH: "Stretch",
  BOBINA: "Bobina",
};

/**
 * Um ícone por família.
 *
 * A descrição gerada é uma sequência de medidas, e num catálogo longo todas se
 * parecem. O ícone dá à linha uma forma reconhecível antes de o olho começar a
 * ler números.
 */
const ICONE_FAMILIA: Record<string, LucideIcon> = {
  SACO: ShoppingBag,
  FITA: CircleDot,
  STRETCH: Layers,
  BOBINA: Disc3,
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
    <Pagina>
      <Cabecalho
        icone={Package}
        titulo="Produtos"
        descricao="O preço do saco é calculado pelas medidas; as demais famílias usam preço de tabela."
        acao={
          <BotaoLink href="/produtos/novo" icone={Plus}>
            Novo produto
          </BotaoLink>
        }
      />

      {produtos.length === 0 ? (
        <EstadoVazio icone={PackagePlus}>
          Nenhum produto cadastrado.
          <br />
          Cadastre a indústria primeiro, depois volte aqui.
        </EstadoVazio>
      ) : (
        <Cartao className="divide-y divide-filete overflow-hidden palco">
          {produtos.map((produto) => {
            const preco = precoDe(produto);

            return (
              <LinhaLista key={produto.id} href={`/produtos/${produto.id}`}>
                <Emblema
                  icone={ICONE_FAMILIA[produto.familia] ?? Package}
                  tom="fraco"
                  className="size-4"
                />

                <div className="min-w-0 flex-1">
                  <div className="font-mono text-sm truncate">{produto.descricao}</div>
                  <div className="text-xs text-tinta-2 truncate mt-0.5">
                    {produto.fornecedor.nome}
                    {" · "}
                    {ROTULO_FAMILIA[produto.familia] ?? produto.familia}
                    {produto.codigoFornecedor && ` · cód. ${produto.codigoFornecedor}`}
                  </div>
                </div>

                {preco && (
                  <div className="text-right">
                    <div className="numerico cifra font-semibold">
                      {formatarMoeda(preco.valor)}
                    </div>
                    <div className="text-xs text-tinta-3">por {preco.unidade}</div>
                  </div>
                )}
              </LinhaLista>
            );
          })}
        </Cartao>
      )}
    </Pagina>
  );
}
