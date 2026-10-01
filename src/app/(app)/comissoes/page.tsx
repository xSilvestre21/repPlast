import Link from "next/link";
import { Factory, PiggyBank, Send, Users } from "lucide-react";

import {
  Cabecalho,
  Cartao,
  Celula,
  CorpoLinha,
  Emblema,
  EstadoVazio,
  FimDaLinha,
  GradeTotais,
  LinhaDado,
  Painel,
  Placa,
  Tabela,
  Total,
  ValorLinha,
  formatarMoeda,
  formatarPercentual,
} from "@/components/ui";
import { competenciaDe, metaVigente, progressoDaMeta } from "@/lib/comissao";
import {
  acertoDoPedido,
  canceladosDaCompetencia,
  contarPedidos,
  mesesComMetaBatida,
  metasDoUsuario,
  pedidosDaCompetencia,
  percentualDoPedido,
  prepostoDoPedido,
  resumirComissao,
  type PedidoDaComissao,
} from "@/lib/comissao-consulta";
import { ratearComissao } from "@/lib/comissao";
import { escreverNumeroBr } from "@/lib/numero-br";
import { escopoAtual } from "@/lib/sessao";

import {
  definirMeta,
  desfazerParcelas,
  salvarAcerto,
  salvarAcertoParcela,
  salvarParcelas,
} from "./acoes";
import { LinhaComissao, type LinhaPedido } from "./acerto";
import { colunasDaComissao } from "./colunas";
import { PainelMeta } from "./painel-meta";
import { Pagina } from "@/components/pagina";
import { NavegadorMes, nomeDoMes } from "@/components/navegador-mes";

/** "1 pedido", "8 pedidos" — no lugar do "pedido(s)" de formulário. */
function plural(n: number, palavra: string): string {
  return `${n} ${palavra}${n === 1 ? "" : "s"}`;
}

export default async function PaginaComissoes({ searchParams }: PageProps<"/comissoes">) {
  const parametros = await searchParams;
  const competencia =
    typeof parametros.mes === "string" && /^\d{4}-\d{2}$/.test(parametros.mes)
      ? parametros.mes
      : competenciaDe(new Date());

  const { organizacaoId, db, ehAdmin, usuarioId } = await escopoAtual();

  const [metas, pedidos, cancelados] = await Promise.all([
    metasDoUsuario(db, usuarioId),
    pedidosDaCompetencia(db, organizacaoId, competencia, ehAdmin ? null : usuarioId),
    canceladosDaCompetencia(db, organizacaoId, competencia, ehAdmin ? null : usuarioId),
  ]);

  /*
   * A soma é dos ENVIADOS, e só deles.
   *
   * O cancelado desce junto para a lista mais abaixo, porque a pergunta "cadê o
   * pedido da FLEXOPET deste mês?" merece a resposta "foi cancelado" em vez do
   * silêncio de uma linha que sumiu. Mas ele não passa por aqui: `resumirComissao`
   * vê apenas `pedidos`, e é esta variável que alimenta as quatro caixas, a meta
   * e o rateio por preposto.
   */
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

  /*
   * Agrupa por indústria, mantendo a ordem alfabética.
   *
   * O cancelado entra na LISTA do grupo e fica de fora do `resumo`: é o mesmo
   * corte do total geral, um nível abaixo. Sem isso, a soma da indústria não
   * bateria com a soma das linhas que ela mostra.
   */
  const porFornecedor = [
    ...Map.groupBy([...pedidos, ...cancelados], (p) => p.fornecedor.id).entries(),
  ]
    .map(([, doFornecedor]) => ({
      fornecedor: doFornecedor[0].fornecedor,
      pedidos: doFornecedor,
      resumo: resumirComissao(doFornecedor.filter((p) => p.status === "ENVIADO")),
    }))
    .sort((a, b) => a.fornecedor.nome.localeCompare(b.fornecedor.nome, "pt-BR"));

  // Agrupa por preposto. Pedido da casa (sem preposto) fica de fora: ele já
  // aparece no "fica com o escritório". Cancelado também não entra — esta
  // tabela é de quanto cada um rendeu, e o cancelado rendeu nada.
  const porPreposto = [
    ...Map.groupBy(
      pedidos.filter((p) => prepostoDoPedido(p)),
      (p) => prepostoDoPedido(p)!.id,
    ).entries(),
  ]
    .map(([, doPreposto]) => ({
      nome: prepostoDoPedido(doPreposto[0])!.nome,
      // Pedidos, não parcelas: duas parcelas do mesmo pedido são um pedido.
      pedidos: contarPedidos(doPreposto),
      resumo: resumirComissao(doPreposto),
    }))
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  /*
   * A meta DESTE mês, de quem está olhando — não a de hoje. É o que deixa
   * conferir um mês antigo contra o alvo que ele tinha na época.
   */
  const vigente = metaVigente(metas, competencia);
  const meta = vigente?.valor ?? null;
  // A meta acompanha o RECEBIDO: é o que de fato entrou, não o que deve entrar.
  const progresso = progressoDaMeta(meta, vista.recebido);

  // A marquinha verde do seletor: os meses batidos, da primeira meta até hoje.
  const batidos = await mesesComMetaBatida(
    db,
    organizacaoId,
    usuarioId,
    ehAdmin,
    metas,
    competenciaDe(new Date()),
  );

  const colunas = colunasDaComissao(ehAdmin);

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
        destaques={batidos}
        rotuloDestaque="meta batida"
        className="mb-7"
      />

      <PainelMeta
        competencia={competencia}
        meta={meta}
        nomeDoMes={nomeDoMes(competencia).toLowerCase()}
        herdadaDe={
          vigente && vigente.desde !== competencia ? nomeDoMes(vigente.desde).toLowerCase() : null
        }
        alcancado={vista.recebido.toNumber()}
        progresso={progresso?.percentual ?? null}
        batida={progresso?.batida ?? false}
        falta={progresso?.falta.toNumber() ?? null}
        definirMeta={definirMeta.bind(null, competencia)}
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
              // Os pedidos com alguma parte ainda sem acerto — o cancelado não
              // entra (não há o que a indústria pague), e duas parcelas
              // pendentes do mesmo pedido contam uma vez.
              detalhe={plural(
                contarPedidos(pedidos.filter((p) => acertoDoPedido(p) === null)),
                "pedido",
              )}
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
              detalhe={
                total.acertados > 0 ? `em ${plural(total.acertados, "acertado")}` : "nada acertado"
              }
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
                <CorpoLinha titulo={nome} detalhe={plural(quantos, "pedido")} />

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
                      {plural(contarPedidos(doFornecedor), "pedido")}
                      {ehAdmin &&
                        ` · ${formatarPercentual(resumo.percentualMedio.toString())} médio`}
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="cifra text-forte numerico">
                    {formatarMoeda(
                      (ehAdmin ? resumo.valor : resumo.previstoDoPreposto).toString(),
                    )}
                  </div>
                  <div className="text-mini text-tinta-3 mt-1">
                    {ehAdmin ? "comissão prevista" : "sua fatia"}
                  </div>
                </div>
              </div>

              <Tabela
                colunas={colunas}
                larguraMinima="min-w-200"
                rodape={<TotalDaIndustria resumo={resumo} ehAdmin={ehAdmin} />}
              >
                {doFornecedor.map((pedido) => (
                  <LinhaComissao
                    key={`${pedido.id}:${pedido.parcela?.id ?? ""}`}
                    pedido={paraLinha(pedido, ehAdmin)}
                    comPercentual={ehAdmin}
                    // Na parcela, o acerto é DELA; no pedido inteiro, dele.
                    salvar={
                      pedido.parcela
                        ? salvarAcertoParcela.bind(null, pedido.parcela.id)
                        : salvarAcerto.bind(null, pedido.id)
                    }
                    salvarParcelas={salvarParcelas.bind(null, pedido.id)}
                    desfazerParcelas={desfazerParcelas.bind(null, pedido.id)}
                  />
                ))}
              </Tabela>
            </Cartao>
          ))}
        </div>
      )}
    </Pagina>
  );
}

/**
 * A linha "Total" da indústria, nas mesmas colunas das linhas de cima.
 *
 * O recebido e a diferença só existem sobre o que já foi acertado — sem
 * nenhum acerto, um "R$ 0,00" ali diria que a indústria pagou zero.
 */
function TotalDaIndustria({
  resumo,
  ehAdmin,
}: {
  resumo: ReturnType<typeof resumirComissao>;
  ehAdmin: boolean;
}) {
  const previsto = ehAdmin ? resumo.valor : resumo.previstoDoPreposto;
  const recebido = ehAdmin ? resumo.recebido : resumo.recebidoDoPreposto;
  const diferenca = ehAdmin ? resumo.diferenca : resumo.diferencaDoPreposto;
  const algumAcerto = resumo.acertados > 0;

  return (
    <tr className="font-semibold">
      {/* Pedido, Cliente, Prazo, Entregue — e o %, quando a coluna existe. */}
      <Celula colSpan={ehAdmin ? 5 : 4}>Total</Celula>
      <Celula alinhamento="numero">{formatarMoeda(previsto.toString())}</Celula>
      <Celula alinhamento="numero">
        {algumAcerto ? formatarMoeda(recebido.toString()) : <span className="text-tinta-3">—</span>}
      </Celula>
      <Celula
        alinhamento="numero"
        className={
          !algumAcerto || diferenca.isZero()
            ? ""
            : diferenca.isNegative()
              ? "text-perigo"
              : "text-verde"
        }
      >
        {algumAcerto ? (
          `${diferenca.isPositive() && !diferenca.isZero() ? "+" : ""}${formatarMoeda(diferenca.toString())}`
        ) : (
          <span className="text-tinta-3">—</span>
        )}
      </Celula>
      <Celula />
    </tr>
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
  /*
   * O cancelado vale ZERO aqui, e não o que valeria se tivesse ido em frente.
   *
   * Ele está na lista para ser visto, não para ser contado — e uma linha
   * exibindo "R$ 1.420,00 previsto" ao lado de um total que não a inclui faria
   * a página parecer que erra a conta. Também não se acerta um pedido
   * cancelado: não há o que a indústria pague.
   */
  const cancelado = pedido.status === "CANCELADO";

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
    motivoCancelamento: cancelado ? (pedido.motivoCancelamento ?? "") : "",
    apelidoCliente: pedido.cliente.apelido,
    prazoEntrega: iso(pedido.prazoEntrega),
    entregueEm: iso(pedido.entregueEm),
    base: pedido.subtotalSemIpi.toString(),
    // O percentual da indústria é conta do escritório com a indústria.
    percentual: ehAdmin && !cancelado ? percentual : "",
    previsto: cancelado ? 0 : (ehAdmin ? previsto.total : previsto.doPreposto).toNumber(),
    // Sempre com duas casas: o campo de dinheiro lê os dígitos como centavos.
    valorRecebido: pedido.valorRecebido
      ? escreverNumeroBr(pedido.valorRecebido.toString(), 2, 2)
      : "",
    percentualRecebido: pedido.comissaoPercentualRecebido
      ? escreverNumeroBr(pedido.comissaoPercentualRecebido.toString())
      : "",
    parcela: pedido.parcela
      ? {
          numero: pedido.parcela.numero,
          total: pedido.parcela.total,
          vencimento: iso(pedido.parcela.vencimento)!,
        }
      : null,
    venda: pedido.vendaDoPedido.toString(),
    prazoPagamento: pedido.prazoPagamento,
    // Os dias das parcelas contam da entrega prevista, como no SICOV; o pedido
    // sem prazo marcado conta do envio, que é o que decide o mês dele também.
    dataBaseParcelas: iso(pedido.prazoEntrega ?? pedido.enviadoEm ?? pedido.criadoEm)!,
    parcelasAtuais: pedido.parcelasDoPedido.map((p) => ({
      vencimento: iso(p.vencimento)!,
      valor: escreverNumeroBr(p.base.toString(), 2, 2),
    })),
    podeParcelar: ehAdmin && !cancelado && !pedido.parcela && !acerto,
    recebido: cancelado
      ? null
      : recebido
        ? (ehAdmin ? recebido.total : recebido.doPreposto).toNumber()
        : null,
    preposto: ehAdmin ? (preposto?.nome ?? null) : null,
    rateio: cancelado ? null : fatias(previsto),
    rateioRecebido: cancelado ? null : fatias(recebido),
    // Quem recebe da indústria é o escritório; é ele que lança o acerto.
    podeAcertar: ehAdmin && !cancelado,
  };
}
