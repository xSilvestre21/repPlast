import Link from "next/link";
import { Factory, PiggyBank, Send, Users } from "lucide-react";

import {
  Cabecalho,
  Cartao,
  CorpoLinha,
  Emblema,
  EstadoVazio,
  FimDaLinha,
  GradeTotais,
  LinhaDado,
  Painel,
  Placa,
  Total,
  ValorLinha,
  formatarMoeda,
  formatarPercentual,
} from "@/components/ui";
import { competenciaDe, progressoDaMeta } from "@/lib/comissao";
import {
  acertoDoPedido,
  pedidosDaCompetencia,
  percentualDoPedido,
  prepostoDoPedido,
  resumirComissao,
  type PedidoDaComissao,
} from "@/lib/comissao-consulta";
import { ratearComissao } from "@/lib/comissao";
import { escreverNumeroBr } from "@/lib/numero-br";
import { dbAdministrativo } from "@/lib/db";
import { escopoAtual } from "@/lib/sessao";

import { definirMeta, salvarAcerto } from "./acoes";
import { LinhaComissao, type LinhaPedido } from "./acerto";
import { PainelMeta } from "./painel-meta";
import { Pagina } from "@/components/pagina";
import { NavegadorMes } from "@/components/navegador-mes";

const DATA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });

export default async function PaginaComissoes({ searchParams }: PageProps<"/comissoes">) {
  const parametros = await searchParams;
  const competencia =
    typeof parametros.mes === "string" && /^\d{4}-\d{2}$/.test(parametros.mes)
      ? parametros.mes
      : competenciaDe(new Date());

  const { organizacaoId, db, ehAdmin, usuarioId } = await escopoAtual();

  const [organizacao, pedidos] = await Promise.all([
    dbAdministrativo().organizacao.findUnique({
      where: { id: organizacaoId },
      select: { metaComissaoMensal: true },
    }),
    pedidosDaCompetencia(db, organizacaoId, competencia, ehAdmin ? null : usuarioId),
  ]);

  const total = resumirComissao(pedidos);

  /*
   * As mesmas quatro caixas para os dois papéis, com números diferentes: o
   * administrador vê o que a indústria paga ao escritório, o preposto vê o que
   * cabe a ele. Não é a mesma tela com um filtro — são duas leituras do mês, e
   * mostrar ao preposto o total do escritório seria mostrar dinheiro que não é
   * dele.
   */
  const vista = ehAdmin
    ? {
        previsto: total.valor,
        recebido: total.recebido,
        aAcertar: total.aAcertar,
        diferenca: total.diferenca,
      }
    : {
        previsto: total.previstoDoPreposto,
        recebido: total.recebidoDoPreposto,
        aAcertar: total.aAcertarDoPreposto,
        diferenca: total.diferencaDoPreposto,
      };

  // Agrupa por indústria, mantendo a ordem alfabética.
  const porFornecedor = [...Map.groupBy(pedidos, (p) => p.fornecedor.id).entries()]
    .map(([, doFornecedor]) => ({
      fornecedor: doFornecedor[0].fornecedor,
      pedidos: doFornecedor,
      resumo: resumirComissao(doFornecedor),
    }))
    .sort((a, b) => a.fornecedor.nome.localeCompare(b.fornecedor.nome, "pt-BR"));

  // Agrupa por preposto. Pedido da casa (sem preposto) fica de fora: ele já
  // aparece no "fica com o escritório".
  const porPreposto = [
    ...Map.groupBy(
      pedidos.filter((p) => prepostoDoPedido(p)),
      (p) => prepostoDoPedido(p)!.id,
    ).entries(),
  ]
    .map(([, doPreposto]) => ({
      nome: prepostoDoPedido(doPreposto[0])!.nome,
      pedidos: doPreposto.length,
      resumo: resumirComissao(doPreposto),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  const meta = organizacao?.metaComissaoMensal ?? null;
  // A meta acompanha o RECEBIDO: é o que de fato entrou, não o que deve entrar.
  const progresso = progressoDaMeta(meta?.toString() ?? null, vista.recebido);

  return (
    <Pagina>
      <Cabecalho
        icone={PiggyBank}
        titulo="Comissões"
        descricao="Conta a partir do envio do pedido; cancelar tira da conta. A meta é sua — não da indústria."
      />

      {/*
        O mês é a legenda da página inteira, não um controle dentro dela: fica
        centralizado, com as setas discretas de cada lado — como o cabeçalho de
        uma folha de apuração.
      */}
      <NavegadorMes
        competencia={competencia}
        href={(mes) => `/comissoes?mes=${mes}`}
        className="mb-7"
      />

      <PainelMeta
        competencia={competencia}
        meta={meta?.toString() ?? null}
        alcancado={vista.recebido.toNumber()}
        progresso={progresso?.percentual ?? null}
        batida={progresso?.batida ?? false}
        falta={progresso?.falta.toNumber() ?? null}
        definirMeta={definirMeta}
      />

      {/*
        Previsto e recebido lado a lado, com a diferença entre eles.
        Um número só esconderia justamente o que a tela existe para mostrar:
        quanto do mês ainda está em aberto, e quanto o acerto ficou abaixo do
        combinado.
      */}
      {porFornecedor.length > 0 && (
        <div className="mb-5">
          <GradeTotais>
            <Total rotulo="Previsto" valor={formatarMoeda(vista.previsto.toString())} />
            <Total rotulo="Recebido" valor={formatarMoeda(vista.recebido.toString())} />
            <Total
              rotulo="A acertar"
              valor={formatarMoeda(vista.aAcertar.toString())}
              detalhe={`${porFornecedor.reduce((n, f) => n + f.pedidos.length, 0) - total.acertados} pedido(s)`}
            />
            <Total
              rotulo="Diferença"
              valor={formatarMoeda(vista.diferenca.toString())}
              tom={
                vista.diferenca.isZero()
                  ? undefined
                  : vista.diferenca.isNegative()
                    ? "perigo"
                    : "verde"
              }
              detalhe={total.acertados > 0 ? `em ${total.acertados} acertado(s)` : "nada acertado"}
            />
          </GradeTotais>
        </div>
      )}

      {/*
        O que sai para cada preposto no mês — é por esta lista que o
        administrador paga. Só aparece quando há preposto: num escritório de uma
        pessoa só, seria um cartão dizendo que ela deve a si mesma.
      */}
      {ehAdmin && porPreposto.length > 0 && (
        <Cartao className="p-5 sm:p-6 mb-5">
          <div className="titulo-regra mb-5">
            <Placa icone={Users} tom="lilas" pequena />
            <h2 className="text-realce font-semibold">Por preposto</h2>
          </div>

          <Painel>
            {porPreposto.map(({ nome, pedidos: quantos, resumo }) => (
              <LinhaDado key={nome}>
                <CorpoLinha titulo={nome} detalhe={`${quantos} pedido(s)`} />

                <FimDaLinha>
                  <ValorLinha
                    className="w-32"
                    valor={formatarMoeda(resumo.previstoDoPreposto.toString())}
                    nota="a pagar"
                  />
                  <ValorLinha
                    className="w-32"
                    valor={formatarMoeda(resumo.recebidoDoPreposto.toString())}
                    nota="já acertado"
                  />
                </FimDaLinha>
              </LinhaDado>
            ))}

            {/* O resto é do escritório, e cai na MESMA coluna de "a pagar": é
                com esse número que os de cima se comparam. */}
            <LinhaDado className="bg-folha">
              <span className="text-corpo font-medium flex-1">Fica com o escritório</span>
              <FimDaLinha>
                <ValorLinha
                  className="w-32"
                  valor={formatarMoeda(total.previstoDoEscritorio.toString())}
                />
                <div className="w-32" aria-hidden="true" />
              </FimDaLinha>
            </LinhaDado>
          </Painel>
        </Cartao>
      )}

      {porFornecedor.length === 0 ? (
        <EstadoVazio icone={Send}>
          Nenhum pedido enviado neste mês.
          <br />A comissão passa a contar quando você marca o pedido como enviado.
        </EstadoVazio>
      ) : (
        <div className="space-y-5 palco">
          {porFornecedor.map(({ fornecedor, pedidos: doFornecedor, resumo }) => (
            <Cartao key={fornecedor.id} className="p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                <div className="flex items-start gap-3 min-w-0">
                  <Emblema icone={Factory} tom="fraco" className="size-4" />
                  <div className="min-w-0">
                    <Link
                      href={`/fornecedores/${fornecedor.id}`}
                      className="font-semibold hover:text-carimbo transition-colors"
                    >
                      {fornecedor.nome}
                    </Link>
                    <div className="text-corpo text-tinta-2 mt-0.5 numerico">
                      {formatarMoeda(resumo.base.toString())} vendidos ·{" "}
                      {doFornecedor.length} pedido(s)
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="cifra text-forte numerico">
                    {formatarMoeda(
                      (ehAdmin ? resumo.valor : resumo.previstoDoPreposto).toString(),
                    )}
                  </div>
                  <div className="text-mini text-tinta-3 numerico mt-1">
                    {ehAdmin
                      ? `${formatarPercentual(resumo.percentualMedio.toString())} sobre a base`
                      : "sua fatia"}
                  </div>
                  {resumo.acertados > 0 && (
                    <div
                      className={`text-mini numerico mt-0.5 ${
                        resumo.diferenca.isNegative() ? "text-perigo" : "text-verde"
                      }`}
                    >
                      recebido {formatarMoeda(resumo.recebido.toString())}
                    </div>
                  )}
                </div>
              </div>

              <Painel>
                {doFornecedor.map((pedido) => (
                  <LinhaComissao
                    key={pedido.id}
                    pedido={paraLinha(pedido, ehAdmin)}
                    salvar={salvarAcerto.bind(null, pedido.id)}
                  />
                ))}
              </Painel>
            </Cartao>
          ))}
        </div>
      )}
    </Pagina>
  );
}




/** "AAAA-MM-DD" em UTC — é o que o input `date` espera, e a coluna não tem hora. */
function iso(data: Date | null): string | null {
  return data ? data.toISOString().slice(0, 10) : null;
}

/**
 * Achata o pedido no que a linha precisa, já formatado — e já pela visão de
 * quem está olhando.
 *
 * O corte acontece AQUI, montando as props, e não dentro do componente: o que
 * não é colocado neste objeto não entra no payload que o navegador do preposto
 * recebe. Esconder com `if` na tela deixaria o número viajando.
 */
function paraLinha(pedido: PedidoDaComissao, ehAdmin: boolean): LinhaPedido {
  const percentual = percentualDoPedido(pedido);
  const percentualPreposto = pedido.comissaoPercentualPreposto?.toString() ?? null;
  const acerto = acertoDoPedido(pedido);

  const previsto = ratearComissao(pedido.subtotalSemIpi.toString(), percentual, percentualPreposto);
  const recebido = acerto ? ratearComissao(acerto.base, acerto.percentual, percentualPreposto) : null;

  const preposto = prepostoDoPedido(pedido);

  const fatias = (r: ReturnType<typeof ratearComissao> | null) =>
    r && ehAdmin && preposto
      ? { preposto: r.doPreposto.toNumber(), escritorio: r.doEscritorio.toNumber() }
      : null;

  return {
    id: pedido.id,
    numero: pedido.numero,
    status: pedido.status,
    apelidoCliente: pedido.cliente.apelido,
    enviadoEm: pedido.enviadoEm ? DATA.format(pedido.enviadoEm) : null,
    prazoEntrega: iso(pedido.prazoEntrega),
    entregueEm: iso(pedido.entregueEm),
    base: pedido.subtotalSemIpi.toString(),
    // O percentual da indústria é conta do escritório com a indústria.
    percentual: ehAdmin ? percentual : "",
    previsto: (ehAdmin ? previsto.total : previsto.doPreposto).toNumber(),
    valorRecebido: pedido.valorRecebido
      ? escreverNumeroBr(pedido.valorRecebido.toString(), 2)
      : "",
    percentualRecebido: pedido.comissaoPercentualRecebido
      ? escreverNumeroBr(pedido.comissaoPercentualRecebido.toString())
      : "",
    recebido: recebido ? (ehAdmin ? recebido.total : recebido.doPreposto).toNumber() : null,
    preposto: ehAdmin ? (preposto?.nome ?? null) : null,
    rateio: fatias(previsto),
    rateioRecebido: fatias(recebido),
    // Quem recebe da indústria é o escritório; é ele que lança o acerto.
    podeAcertar: ehAdmin,
  };
}


