import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, Factory, FileDown, ScrollText } from "lucide-react";

import { SecaoItens } from "@/components/itens-documento";
import { Pagina } from "@/components/pagina";
import {
  BotaoLink,
  Cabecalho,
  Cartao,
  Emblema,
  formatarMoeda,
} from "@/components/ui";
import { escreverNumeroBr } from "@/lib/numero-br";
import { escopoAtual } from "@/lib/sessao";

import { SeloOrcamento, destinatario } from "../selo";
import {
  adicionarItem,
  atualizarItem,
  cadastrarClienteDoOrcamento,
  atualizarOrcamento,
  converterEmPedido,
  definirIpiDeTodosOsItens,
  definirStatus,
  salvarMotivoRecusa,
  removerItem,
} from "../acoes";
import { CadastrarCliente, DesfechoProposta, FichaProposta } from "./ficha";

const DATA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" });

/** Decimal do Prisma para o texto que o componente espera. */
const texto = (v: { toString(): string } | null) => (v === null ? null : v.toString());

/** "AAAA-MM-DD" em UTC — a coluna é `date`, sem hora. */
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function PaginaOrcamento({ params }: PageProps<"/orcamentos/[id]">) {
  const { id } = await params;
  const { organizacaoId, db } = await escopoAtual();

  const orcamento = await db.orcamento.findFirst({
    where: { id, organizacaoId },
    include: {
      cliente: true,
      fornecedor: { select: { id: true, nome: true } },
      itens: { orderBy: { ordem: "asc" } },
      pedidos: { select: { id: true, numero: true }, orderBy: { numero: "asc" } },
    },
  });

  if (!orcamento) notFound();

  // Só produtos da MESMA indústria entram: a proposta é de uma só, e o IPI
  // congelado aqui é o dela.
  const produtos = await db.produto.findMany({
    where: { organizacaoId, fornecedorId: orcamento.fornecedorId, ativo: true },
    orderBy: { descricao: "asc" },
    include: { aditivos: { include: { aditivo: true } } },
  });

  const editavel = orcamento.status === "ABERTO";
  const para = destinatario(orcamento);

  return (
    <Pagina>
      <Cabecalho
        titulo={`Orçamento #${orcamento.numero}`}
        descricao={`${para.nome} · ${orcamento.fornecedor.nome}`}
        acao={
          <div className="flex items-center gap-3">
            <SeloOrcamento status={orcamento.status} />
            <BotaoLink
              href={`/orcamentos/${orcamento.id}/pdf`}
              variante="secundaria"
              icone={FileDown}
            >
              PDF
            </BotaoLink>
          </div>
        }
      />

      <div className="space-y-5 palco">
        <Cartao className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <Emblema icone={Building2} tom="fraco" className="size-4" />
              {orcamento.cliente ? (
                <Link href={`/clientes/${orcamento.cliente.id}`} className="group min-w-0 block">
                  <div className="font-semibold truncate transition-colors group-hover:text-carimbo">
                    {orcamento.cliente.apelido}
                  </div>
                  <div className="text-corpo text-tinta-2 truncate">
                    {orcamento.cliente.razaoSocial}
                  </div>
                </Link>
              ) : (
                <div className="min-w-0">
                  <div className="font-semibold truncate">{para.nome}</div>
                  <div className="text-corpo text-tinta-2 truncate">
                    {orcamento.clienteAvulsoMunicipio ?? "ainda não é cliente"}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-start gap-3 text-corpo text-tinta-2">
              <Emblema icone={Factory} tom="fraco" className="size-4" />
              <div>
                <div>{orcamento.fornecedor.nome}</div>
                <div className="text-mini text-tinta-3 numerico">
                  IPI {escreverNumeroBr(orcamento.ipiPercentual.toString())}%
                  {orcamento.validoAte && ` · vale até ${DATA.format(orcamento.validoAte)}`}
                </div>
              </div>
            </div>
          </div>

          {orcamento.pedidos.length > 0 && (
            <div className="mt-3 pt-3 border-t border-filete text-corpo">
              <span className="text-tinta-2">Virou </span>
              {orcamento.pedidos.map((p, i) => (
                <span key={p.id}>
                  {i > 0 && ", "}
                  <Link
                    href={`/pedidos/${p.id}`}
                    className="text-carimbo hover:underline numerico font-medium"
                  >
                    <ScrollText size={12} className="inline mr-1" aria-hidden="true" />
                    pedido #{p.numero}
                  </Link>
                </span>
              ))}
            </div>
          )}
        </Cartao>

        {!orcamento.cliente && (
          <CadastrarCliente
            nome={orcamento.clienteAvulsoNome ?? ""}
            municipio={orcamento.clienteAvulsoMunicipio ?? ""}
            cadastrar={cadastrarClienteDoOrcamento.bind(null, orcamento.id)}
          />
        )}

        <SecaoItens
          editavel={editavel}
          itens={orcamento.itens.map((item) => ({
            id: item.id,
            familia: item.familia,
            codigoFornecedor: item.codigoFornecedor,
            codigoCliente: item.codigoCliente,
            descricao: item.descricao,
            unidade: item.unidade,
            quantidade: item.quantidade.toString(),
            precoUnitario: item.precoUnitario.toString(),
            comIpi: item.comIpi,
            totalSemIpi: item.totalSemIpi.toString(),
            valorIpi: item.valorIpi.toString(),
            total: item.total.toString(),
          }))}
          produtos={produtos.map((p) => ({
            id: p.id,
            descricao: p.descricao,
            familia: p.familia,
            codigoFornecedor: p.codigoFornecedor,
            larguraCm: texto(p.larguraCm),
            comprimentoCm: texto(p.comprimentoCm),
            espessuraMm: texto(p.espessuraMm),
            fatorKg: texto(p.fatorKg),
            densidade: texto(p.densidade),
            precoUnidade: texto(p.precoUnidade),
            precoCaixa: texto(p.precoCaixa),
            precoKg: texto(p.precoKg),
            unidadeAvulsa: p.unidadeAvulsa,
            precoAvulso: texto(p.precoAvulso),
            unidadesPorCaixa: p.unidadesPorCaixa,
            aditivos: p.aditivos.map(({ aditivo }) => ({
              nome: aditivo.nome,
              sufixoDescricao: aditivo.sufixoDescricao,
              tipo: aditivo.tipo,
              valor: aditivo.valor.toString(),
            })),
          }))}
          totais={{
            subtotalSemIpi: orcamento.subtotalSemIpi.toString(),
            valorIpi: orcamento.valorIpi.toString(),
            totalGeral: orcamento.totalGeral.toString(),
            ipiPercentual: orcamento.ipiPercentual.toString(),
          }}
          adicionar={adicionarItem.bind(null, orcamento.id)}
          atualizar={atualizarItem.bind(null, orcamento.id)}
          remover={removerItem.bind(null, orcamento.id)}
          definirIpiDeTodos={definirIpiDeTodosOsItens.bind(null, orcamento.id)}
        />

        <FichaProposta
          editavel={editavel}
          valores={{
            attn: orcamento.attn ?? "",
            validoAte: iso(orcamento.validoAte),
            prazoPagamento: orcamento.prazoPagamento ?? "",
            vendedor: orcamento.vendedor ?? "",
            observacoes: orcamento.observacoes ?? "",
          }}
          salvar={atualizarOrcamento.bind(null, orcamento.id)}
        />

        <Cartao className="p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="rotulo text-tinta-3">Total da proposta</div>
              <div className="cifra numerico text-forte mt-1 leading-none">
                {formatarMoeda(orcamento.totalGeral.toString())}
              </div>
            </div>

            <DesfechoProposta
              status={orcamento.status}
              temItens={orcamento.itens.length > 0}
              temCliente={orcamento.cliente !== null}
              jaVirouPedido={orcamento.pedidos.length > 0}
              motivoRecusa={orcamento.motivoRecusa ?? ""}
              aceitar={definirStatus.bind(null, orcamento.id, "ACEITO")}
              recusar={definirStatus.bind(null, orcamento.id, "RECUSADO")}
              vencer={definirStatus.bind(null, orcamento.id, "EXPIRADO")}
              reabrir={definirStatus.bind(null, orcamento.id, "ABERTO")}
              virarPedido={converterEmPedido.bind(null, orcamento.id)}
              salvarMotivo={salvarMotivoRecusa.bind(null, orcamento.id)}
            />
          </div>
        </Cartao>
      </div>
    </Pagina>
  );
}
