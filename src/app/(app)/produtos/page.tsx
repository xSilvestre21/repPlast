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
  CorpoLinha,
  Emblema,
  EstadoVazio,
  FimDaLinha,
  LinhaLista,
  Paginacao,
  Selo,
  ValorLinha,
  formatarMoeda,
} from "@/components/ui";
import { lerNumeroBr } from "@/lib/numero-br";
import { precoMilheiroSaco } from "@/lib/precificacao";
import { escopoAtual } from "@/lib/sessao";
import { Pagina } from "@/components/pagina";

import { FiltrosProdutos, type FiltrosProduto } from "./filtros";

const ROTULO_FAMILIA: Record<string, string> = {
  SACO: "Saco plástico",
  FITA: "Fita",
  STRETCH: "Stretch",
  BOBINA: "Bobina",
  AVULSO: "Avulso",
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

/**
 * Quantos por página.
 *
 * Quinze é o número do sistema anterior, e ele acertou: o catálogo real tem 444
 * produtos, e carregar todos de uma vez transformava a tela num rolo infinito
 * onde nada era encontrado — que é o oposto do que um catálogo serve para fazer.
 */
const POR_PAGINA = 15;

const texto = (v: unknown) => (typeof v === "string" ? v.trim() : "");

export default async function PaginaProdutos({ searchParams }: PageProps<"/produtos">) {
  const { organizacaoId, db } = await escopoAtual();
  const parametros = await searchParams;

  const filtros: FiltrosProduto = {
    busca: texto(parametros.busca),
    larguraCm: texto(parametros.l),
    comprimentoCm: texto(parametros.c),
    espessuraMm: texto(parametros.e),
    incluirInativos: parametros.inativos === "1",
  };

  const pagina = Math.max(1, Number(parametros.pagina) || 1);

  /*
   * A medida entra como texto brasileiro ("0,055") e o banco guarda Decimal.
   * `lerNumeroBr` é a mesma função que o formulário usa, então digitar aqui e
   * digitar lá acham o mesmo produto.
   */
  const medida = (valor: string) => {
    if (!valor) return undefined;
    const numero = lerNumeroBr(valor);
    return numero === null ? undefined : numero;
  };

  const termo = filtros.busca;

  const onde = {
    organizacaoId,
    ...(filtros.incluirInativos ? {} : { ativo: true }),
    larguraCm: medida(filtros.larguraCm),
    comprimentoCm: medida(filtros.comprimentoCm),
    espessuraMm: medida(filtros.espessuraMm),
    /*
     * A busca alcança o CLIENTE e a INDÚSTRIA, não só a descrição.
     *
     * É como se procura na prática — "o que eu vendo para a Flexopet?" — e era
     * o comportamento do sistema anterior. Sem isso, um catálogo com quatro
     * linhas `90x160x0,055 SF 12 PEAD` não tem como ser desempatado.
     */
    ...(termo
      ? {
          OR: [
            { descricao: { contains: termo, mode: "insensitive" as const } },
            { material: { contains: termo, mode: "insensitive" as const } },
            { complemento: { contains: termo, mode: "insensitive" as const } },
            { codigoFornecedor: { contains: termo, mode: "insensitive" as const } },
            { cliente: { apelido: { contains: termo, mode: "insensitive" as const } } },
            { cliente: { razaoSocial: { contains: termo, mode: "insensitive" as const } } },
            { fornecedor: { nome: { contains: termo, mode: "insensitive" as const } } },
            { codigosCliente: { some: { codigo: { contains: termo, mode: "insensitive" as const } } } },
          ],
        }
      : {}),
  };

  const [total, produtos] = await Promise.all([
    db.produto.count({ where: onde }),
    db.produto.findMany({
      where: onde,
      // Por DESCRIÇÃO, como no sistema anterior: é ela que a pessoa tem na
      // cabeça. Agrupar por indústria escondia que o mesmo saco existe para
      // três clientes, porque as três linhas caíam longe uma da outra.
      orderBy: [{ descricao: "asc" }, { id: "asc" }],
      take: POR_PAGINA,
      skip: (pagina - 1) * POR_PAGINA,
      include: {
        fornecedor: { select: { nome: true } },
        cliente: { select: { apelido: true } },
        codigosCliente: { select: { codigo: true }, take: 1 },
        aditivos: { include: { aditivo: true } },
      },
    }),
  ]);

  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  /** Mantém os filtros ao trocar de página. */
  const enderecoDaPagina = (destino: number) => {
    const busca = new URLSearchParams();
    if (filtros.busca) busca.set("busca", filtros.busca);
    if (filtros.larguraCm) busca.set("l", filtros.larguraCm);
    if (filtros.comprimentoCm) busca.set("c", filtros.comprimentoCm);
    if (filtros.espessuraMm) busca.set("e", filtros.espessuraMm);
    if (filtros.incluirInativos) busca.set("inativos", "1");
    if (destino > 1) busca.set("pagina", String(destino));

    const consulta = busca.toString();
    return consulta ? `/produtos?${consulta}` : "/produtos";
  };

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
        densidade: produto.densidade ? produto.densidade.toString() : null,
        fatorKg: produto.fatorKg.toString(),
        aditivos: produto.aditivos.map(({ aditivo }) => ({
          nome: aditivo.nome,
          sufixoDescricao: aditivo.sufixoDescricao,
          tipo: aditivo.tipo,
          valor: aditivo.valor.toString(),
        })),
      });

      return { valor: preco.toNumber(), unidade: produto.unidadeRotulo ?? "milheiro" };
    }

    if (produto.familia === "FITA") {
      if (produto.precoCaixa) return { valor: Number(produto.precoCaixa), unidade: "caixa" };
      if (produto.precoUnidade) return { valor: Number(produto.precoUnidade), unidade: "unidade" };
      return null;
    }

    if (produto.familia === "AVULSO") {
      return produto.precoAvulso
        ? { valor: Number(produto.precoAvulso), unidade: produto.unidadeRotulo ?? "unidade" }
        : null;
    }

    return produto.precoKg ? { valor: Number(produto.precoKg), unidade: "kg" } : null;
  }

  const catalogoVazio = total === 0 && !filtros.busca && !filtros.larguraCm;

  return (
    <Pagina>
      <Cabecalho
        icone={Package}
        titulo="Produtos"
        descricao="Cada produto é de um cliente e de uma indústria — o mesmo saco cotado para dois clientes são dois produtos, com preço próprio."
        acao={
          <BotaoLink href="/produtos/novo" icone={Plus}>
            Novo produto
          </BotaoLink>
        }
      />

      <FiltrosProdutos filtros={filtros} />

      {catalogoVazio ? (
        <EstadoVazio icone={PackagePlus} titulo="Nenhum produto cadastrado">
          Cadastre a indústria primeiro, depois volte aqui.
        </EstadoVazio>
      ) : total === 0 ? (
        <EstadoVazio
          icone={Package}
          titulo="Nada encontrado"
          acao={
            <BotaoLink href="/produtos" variante="secundaria" tamanho="compacto">
              Limpar a busca
            </BotaoLink>
          }
        >
          Nenhum produto corresponde ao que você procurou.
        </EstadoVazio>
      ) : (
        <>
          <Cartao className="divide-y divide-filete overflow-hidden palco">
            {produtos.map((produto) => {
              const preco = precoDe(produto);
              const codigoDoCliente = produto.codigosCliente[0]?.codigo;

              return (
                <LinhaLista key={produto.id} href={`/produtos/${produto.id}`}>
                  <Emblema
                    icone={ICONE_FAMILIA[produto.familia] ?? Package}
                    tom="fraco"
                    className="size-4"
                  />

                  <CorpoLinha
                    className="font-mono"
                    titulo={produto.descricao}
                    detalhe={
                      <span className="font-sans">
                        {/* O cliente vem PRIMEIRO: é ele que desempata as
                            linhas de descrição idêntica. */}
                        {produto.cliente?.apelido ?? "sem cliente"}
                        {" · "}
                        {produto.fornecedor.nome}
                        {" · "}
                        {ROTULO_FAMILIA[produto.familia] ?? produto.familia}
                        {produto.codigoFornecedor && ` · cód. ${produto.codigoFornecedor}`}
                        {codigoDoCliente && ` · cli. ${codigoDoCliente}`}
                      </span>
                    }
                  />

                  <FimDaLinha>
                    {!produto.ativo && <Selo tom="cancelado">Inativo</Selo>}
                    {preco && (
                      <ValorLinha
                        className="w-32"
                        valor={formatarMoeda(preco.valor)}
                        nota={`por ${preco.unidade}`}
                      />
                    )}
                  </FimDaLinha>
                </LinhaLista>
              );
            })}
          </Cartao>

          <Paginacao
            pagina={pagina}
            paginas={paginas}
            total={total}
            href={enderecoDaPagina}
            rotuloItem="produto"
          />
        </>
      )}
    </Pagina>
  );
}
