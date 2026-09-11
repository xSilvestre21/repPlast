import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, FileText } from "lucide-react";

import { SeloStatus } from "@/components/selo-status";
import { BotaoLink, Cartao, Emblema } from "@/components/ui";
import { dbParaOrganizacao } from "@/lib/db";
import { escreverNumeroBr } from "@/lib/numero-br";
import { organizacaoAtual } from "@/lib/sessao";

import {
  adicionarItem,
  atualizarCabecalho,
  definirIpiDeTodosOsItens,
  atualizarItem,
  cancelarPedido,
  desmarcarEnvio,
  duplicarPedido,
  enviarPedidoPorEmail,
  excluirPedido,
  marcarEnviado,
  reabrirPedido,
  removerItem,
} from "../acoes";
import { AcaoPedido } from "./acoes-status";
import { SecaoCabecalho } from "./cabecalho";
import { BotaoEnviarEmail } from "./envio";
import { SecaoItens } from "./itens";
import { Pagina } from "@/components/pagina";

const DATA_HORA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export default async function PaginaPedido({ params }: PageProps<"/pedidos/[id]">) {
  const { id } = await params;

  const organizacaoId = await organizacaoAtual();
  const db = dbParaOrganizacao(organizacaoId);

  const pedido = await db.pedido.findFirst({
    where: { id, organizacaoId },
    include: {
      cliente: true,
      fornecedor: { select: { id: true, nome: true, emailsPedido: true } },
      itens: { orderBy: { ordem: "asc" } },
    },
  });

  if (!pedido) notFound();

  // Só produtos desta indústria: um pedido pertence a uma só.
  const produtos = await db.produto.findMany({
    where: { organizacaoId, fornecedorId: pedido.fornecedorId, ativo: true },
    orderBy: { descricao: "asc" },
    include: { aditivos: { include: { aditivo: true } } },
  });

  const editavel = pedido.status === "ABERTO";
  const temItens = pedido.itens.length > 0;
  const texto = (v: { toString(): string } | null) => (v === null ? null : v.toString());

  return (
    <Pagina>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-serif text-3xl sm:text-[2.375rem] font-medium tracking-tight leading-none">
              Pedido <span className="numerico">{pedido.numero}</span>
            </h1>
            <SeloStatus status={pedido.status} />
          </div>
          <p className="text-sm text-tinta-2 mt-1">
            {pedido.fornecedor.nome} · criado em {DATA_HORA.format(pedido.criadoEm)}
            {pedido.enviadoEm && ` · enviado em ${DATA_HORA.format(pedido.enviadoEm)}`}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 items-start">
          {temItens && (
            <>
              <BotaoLink
                href={`/pedidos/${pedido.id}/pdf?abrir`}
                target="_blank"
                variante="secundaria"
                icone={FileText}
              >
                Ver PDF
              </BotaoLink>

              <BotaoEnviarEmail
                destinatarios={pedido.fornecedor.emailsPedido}
                jaEnviado={pedido.status === "ENVIADO"}
                acao={enviarPedidoPorEmail.bind(null, pedido.id)}
              />
            </>
          )}

          {pedido.status === "ABERTO" && temItens && (
            <AcaoPedido
              rotulo="Marcar como enviado"
              rotuloOcupado="Marcando…"
              variante="secundaria"
              icone="enviar"
              confirmacao="Marcar como enviado trava o pedido e passa a contar a comissão. Confirma?"
              acao={marcarEnviado.bind(null, pedido.id)}
            />
          )}

          {pedido.status === "ENVIADO" && (
            <AcaoPedido
              rotulo="Desmarcar envio"
              rotuloOcupado="Desmarcando…"
              icone="desfazer"
              acao={desmarcarEnvio.bind(null, pedido.id)}
            />
          )}

          <AcaoPedido
            rotulo="Duplicar"
            rotuloOcupado="Duplicando…"
            icone="duplicar"
            acao={duplicarPedido.bind(null, pedido.id)}
          />

          {pedido.status === "CANCELADO" ? (
            <AcaoPedido
              rotulo="Reabrir"
              rotuloOcupado="Reabrindo…"
              icone="reabrir"
              acao={reabrirPedido.bind(null, pedido.id)}
            />
          ) : (
            <AcaoPedido
              rotulo="Cancelar"
              rotuloOcupado="Cancelando…"
              variante="perigo"
              icone="cancelar"
              confirmacao="Cancelar o pedido estorna a comissão dele. Confirma?"
              acao={cancelarPedido.bind(null, pedido.id)}
            />
          )}

          {!pedido.enviadoEm && (
            <AcaoPedido
              rotulo="Apagar"
              rotuloOcupado="Apagando…"
              variante="perigo"
              icone="apagar"
              confirmacao="Apagar remove o pedido de vez. Confirma?"
              acao={excluirPedido.bind(null, pedido.id)}
            />
          )}
        </div>
      </div>

      <div className="space-y-5 palco">
        <Cartao className="p-4 sm:p-5">
          <div className="flex items-start gap-3 mb-3">
            <Emblema icone={Building2} tom="fraco" className="size-4" />
            <Link href={`/clientes/${pedido.cliente.id}`} className="group min-w-0 block">
              <div className="font-semibold truncate transition-colors group-hover:text-carimbo">
                {pedido.cliente.apelido}
              </div>
              <div className="text-sm text-tinta-2 truncate">{pedido.cliente.razaoSocial}</div>
            </Link>
          </div>
          <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3 mt-3 text-sm">
            <Info rotulo="CNPJ" valor={pedido.cliente.cnpj} />
            <Info rotulo="IE" valor={pedido.cliente.ie} />
            <Info
              rotulo="Município"
              valor={
                pedido.cliente.municipio
                  ? `${pedido.cliente.municipio}/${pedido.cliente.uf ?? ""}`
                  : null
              }
            />
            <Info rotulo="Endereço" valor={pedido.cliente.endereco} />
            <Info rotulo="Telefone" valor={pedido.cliente.telefone} />
            <Info rotulo="E-mail da NF-e" valor={pedido.cliente.emailNfe} />
          </dl>
        </Cartao>

        <SecaoItens
          editavel={editavel}
          itens={pedido.itens.map((item) => ({
            id: item.id,
            familia: item.familia,
            codigoFornecedor: item.codigoFornecedor,
            codigoCliente: item.codigoCliente,
            descricao: item.descricao,
            unidade: item.unidade,
            quantidade: item.quantidade.toString(),
            precoUnitario: item.precoUnitario.toString(),
            totalSemIpi: item.totalSemIpi.toString(),
            comIpi: item.comIpi,
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
            precoUnidade: texto(p.precoUnidade),
            precoCaixa: texto(p.precoCaixa),
            precoKg: texto(p.precoKg),
            unidadesPorCaixa: p.unidadesPorCaixa,
            aditivos: p.aditivos.map(({ aditivo }) => ({
              nome: aditivo.nome,
              sufixoDescricao: aditivo.sufixoDescricao,
              tipo: aditivo.tipo,
              valor: aditivo.valor.toString(),
            })),
          }))}
          totais={{
            subtotalSemIpi: pedido.subtotalSemIpi.toString(),
            valorIpi: pedido.valorIpi.toString(),
            totalGeral: pedido.totalGeral.toString(),
            ipiPercentual: pedido.ipiPercentual.toString(),
          }}
          adicionar={adicionarItem.bind(null, pedido.id)}
          atualizar={atualizarItem.bind(null, pedido.id)}
          remover={removerItem.bind(null, pedido.id)}
          definirIpiDeTodos={definirIpiDeTodosOsItens.bind(null, pedido.id)}
        />

        <SecaoCabecalho
          editavel={editavel}
          acao={atualizarCabecalho.bind(null, pedido.id)}
          valores={{
            pedidoDoCliente: pedido.pedidoDoCliente ?? "",
            prazoPagamento: pedido.prazoPagamento ?? "",
            prazoEntrega: pedido.prazoEntrega
              ? pedido.prazoEntrega.toISOString().slice(0, 10)
              : "",
            tipoFrete: pedido.tipoFrete ?? "",
            transportadora: pedido.transportadora ?? "",
            vendedor: pedido.vendedor ?? "",
            observacoes: pedido.observacoes ?? "",
            ipiPercentual: escreverNumeroBr(pedido.ipiPercentual.toString()),
            comissaoPercentual: pedido.comissaoPercentual
              ? escreverNumeroBr(pedido.comissaoPercentual.toString())
              : "",
          }}
        />
      </div>
    </Pagina>
  );
}

function Info({ rotulo, valor }: { rotulo: string; valor: string | null }) {
  if (!valor) return null;

  return (
    <div className="flex gap-2 min-w-0">
      <dt className="text-tinta-3 shrink-0">{rotulo}:</dt>
      <dd className="truncate">{valor}</dd>
    </div>
  );
}
