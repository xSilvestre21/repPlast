import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, FileDown, History, Mail, Pencil, ScrollText } from "lucide-react";

import { SeloStatus } from "@/components/selo-status";
import { BotaoLink, Cabecalho, Cartao, Emblema, Painel, SecaoCartao } from "@/components/ui";
import { textoPadraoDoEnvio } from "@/lib/envio-pedido";
import { escreverNumeroBr } from "@/lib/numero-br";
import { unidadeDoRotulo } from "@/lib/produto-preco";
import { nomeArquivoPedido } from "@/lib/pdf/nome-arquivo";
import { escopoAtual } from "@/lib/sessao";

import {
  adicionarItem,
  atualizarCabecalho,
  definirIpiDeTodosOsItens,
  atualizarItem,
  cancelarPedido,
  salvarMotivoCancelamento,
  desmarcarEnvio,
  duplicarPedido,
  enviarPedidoPorEmail,
  excluirPedido,
  marcarEnviado,
  reabrirPedido,
  removerItem,
} from "../acoes";
import { AcaoPedido, CancelarPedido, MotivoDoCancelamento } from "./acoes-status";
import { SecaoCabecalho } from "./cabecalho";
import { BotaoEnviarEmail } from "./envio";
import { SecaoItens } from "@/components/itens-documento";
import { Pagina } from "@/components/pagina";
import { nomeCompleto } from "@/lib/nome-usuario";

const DATA_HORA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

export default async function PaginaPedido({
  params,
  searchParams,
}: PageProps<"/pedidos/[id]">) {
  const { id } = await params;
  const parametros = await searchParams;

  const { organizacaoId, usuarioId, ehAdmin, db } = await escopoAtual();

  const pedido = await db.pedido.findFirst({
    where: { id, organizacaoId },
    include: {
      cliente: true,
      fornecedor: {
        select: {
          id: true,
          nome: true,
          contatos: {
            orderBy: { ordem: "asc" },
            select: { id: true, nome: true, setor: true, email: true, padrao: true },
          },
        },
      },
      itens: { orderBy: { ordem: "asc" } },
      envios: {
        orderBy: { enviadoEm: "desc" },
        select: { id: true, de: true, para: true, cc: true, anexos: true, enviadoEm: true },
      },
      edicoes: {
        orderBy: { editadoEm: "desc" },
        select: {
          id: true,
          editadoEm: true,
          usuario: { select: { nome: true, sobrenome: true, papel: true } },
        },
      },
    },
  });

  if (!pedido) notFound();

  // As caixas de QUEM ESTÁ OLHANDO, não do dono do pedido: a administradora que
  // manda o pedido do preposto manda do e-mail dela.
  const [contas, modeloEnvio] = await Promise.all([
    db.contaEmail.findMany({
      where: { usuarioId },
      orderBy: [{ padrao: "desc" }, { criadoEm: "asc" }],
      select: { id: true, email: true, nomeExibicao: true, padrao: true },
    }),
    // O texto também é de quem envia, pelo mesmo motivo.
    db.usuario.findUnique({
      where: { id: usuarioId },
      select: { assuntoEnvioPadrao: true, mensagemEnvioPadrao: true },
    }),
  ]);

  /*
   * O que dá para lançar aqui: produto DESTE cliente E DESTA indústria.
   *
   * As duas condições valem juntas — produto que o cliente compra, mas de outra
   * indústria, não entra, porque o pedido é dirigido a uma indústria só.
   *
   * O dono do produto é `clienteId`, no próprio produto — mesma consulta da
   * proposta, e pelo mesmo motivo: cada produto carrega o preço negociado do
   * seu dono, e o de outro cliente não tem o que fazer aqui.
   */
  const produtos = await db.produto.findMany({
    where: {
      organizacaoId,
      fornecedorId: pedido.fornecedorId,
      ativo: true,
      clienteId: pedido.clienteId,
    },
    orderBy: { descricao: "asc" },
    include: { aditivos: { include: { aditivo: true } } },
  });

  /*
   * Mesma regra do orçamento: o pedido abre para LEITURA depois de pronto.
   * Uma tela que já chega editável convida a mexer sem querer no que está
   * prestes a ir para a indústria. Editável só enquanto ele está sendo montado
   * (`emElaboracao`) ou quando se clicou em Editar de propósito (`?editar=1`).
   */
  const aberto = pedido.status === "ABERTO";
  const editavel = aberto && (pedido.emElaboracao || parametros.editar === "1");
  const temItens = pedido.itens.length > 0;

  /*
   * O que o administrador ainda precisa conferir antes de mandar: edições de
   * preposto depois da última conferência. Só ele vê — é ele quem envia pelo
   * escritório, e é para ele que o aviso existe.
   */
  const conferidoEm = pedido.edicoesConferidasEm;
  const aConferir = ehAdmin
    ? pedido.edicoes
        .filter((e) => e.usuario && e.usuario.papel !== "ADMIN")
        .filter((e) => !conferidoEm || e.editadoEm > conferidoEm)
        .reverse()
        .map((e) => ({ id: e.id, quem: e.usuario!.nome, quando: DATA_HORA.format(e.editadoEm) }))
    : [];
  const listaAConferir = aConferir.map((e) => `${e.quem} em ${e.quando}`).join("; ");
  const texto = (v: { toString(): string } | null) => (v === null ? null : v.toString());

  return (
    <Pagina>
      <Cabecalho
        voltar={{ href: "/pedidos", rotulo: "Pedidos" }}
        icone={ScrollText}
        titulo={`Pedido ${pedido.numero}`}
        selo={<SeloStatus status={pedido.status} />}
        descricao={
          `${pedido.fornecedor.nome} · criado em ${DATA_HORA.format(pedido.criadoEm)}` +
          (pedido.enviadoEm ? ` · enviado em ${DATA_HORA.format(pedido.enviadoEm)}` : "")
        }
        acao={
          <div className="flex flex-wrap gap-2 items-start">
          {temItens && (
            <>
              {/*
                Baixa direto, com o nome que a rota já monta (`2276-AKILAH-…pdf`),
                como no orçamento. O `download` faz o Link deixar o clique com o
                navegador em vez de tentar navegar para a rota do arquivo.
              */}
              <BotaoLink
                href={`/pedidos/${pedido.id}/pdf`}
                download
                prefetch={false}
                variante="secundaria"
                icone={FileDown}
              >
                Baixar PDF
              </BotaoLink>

              {pedido.status !== "CANCELADO" && (
                <BotaoEnviarEmail
                  jaEnviado={pedido.status === "ENVIADO"}
                  aConferir={aConferir}
                  acao={enviarPedidoPorEmail.bind(null, pedido.id)}
                  contas={contas}
                  contatos={pedido.fornecedor.contatos}
                  fornecedor={{ id: pedido.fornecedor.id, nome: pedido.fornecedor.nome }}
                  cliente={{
                    apelido: pedido.cliente.apelido,
                    email: pedido.cliente.email ?? pedido.cliente.emailNfe,
                  }}
                  textoPadrao={textoPadraoDoEnvio(
                    {
                      numero: pedido.numero,
                      razaoSocialCliente: pedido.cliente.razaoSocial,
                      cnpjCliente: pedido.cliente.cnpj,
                      pedidoDoCliente: pedido.pedidoDoCliente,
                      vendedor: pedido.vendedor,
                    },
                    {
                      assunto: modeloEnvio?.assuntoEnvioPadrao,
                      corpo: modeloEnvio?.mensagemEnvioPadrao,
                    },
                  )}
                  nomeArquivoPdf={nomeArquivoPedido({
                    numero: pedido.numero,
                    apelidoCliente: pedido.cliente.apelido,
                    pedidoDoCliente: pedido.pedidoDoCliente,
                    prazoEntrega: pedido.prazoEntrega,
                  })}
                />
              )}
            </>
          )}

          {aberto && !editavel && (
            <BotaoLink
              href={`/pedidos/${pedido.id}?editar=1`}
              variante="secundaria"
              icone={Pencil}
            >
              Editar
            </BotaoLink>
          )}

          {pedido.status === "ABERTO" && temItens && (
            <AcaoPedido
              rotulo="Marcar como enviado"
              rotuloOcupado="Marcando…"
              variante="secundaria"
              icone="enviar"
              confirmacao={
                (aConferir.length > 0
                  ? `Atenção: um preposto editou este pedido (${listaAConferir}). ` +
                    "Confira as alterações antes de continuar.\n\n"
                  : "") +
                "Marcar como enviado trava o pedido e passa a contar a comissão. Confirma?"
              }
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
            <CancelarPedido acao={cancelarPedido.bind(null, pedido.id)} />
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
        }
      />

      <div className="space-y-5 palco">
        {/*
          O motivo abre a página quando o pedido está cancelado.
          É o fato mais importante sobre ele: tudo o mais na tela descreve uma
          venda que não aconteceu.
        */}
        {pedido.status === "CANCELADO" && (
          <Cartao className="p-5 sm:p-6">
            <MotivoDoCancelamento
              motivo={pedido.motivoCancelamento ?? ""}
              acao={salvarMotivoCancelamento.bind(null, pedido.id)}
            />
          </Cartao>
        )}

        <Cartao className="p-5 sm:p-6">
          <div className="flex items-start gap-3 mb-3">
            <Emblema icone={Building2} tom="fraco" className="size-4" />
            <Link href={`/clientes/${pedido.cliente.id}`} className="group min-w-0 block">
              <div className="font-semibold truncate transition-colors group-hover:text-carimbo">
                {pedido.cliente.apelido}
              </div>
              <div className="text-corpo text-tinta-2 truncate">{pedido.cliente.razaoSocial}</div>
            </Link>
          </div>
          <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2 lg:grid-cols-3 mt-3 text-corpo">
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
          motivoTravado={
            aberto
              ? "Em leitura. Para lançar ou mexer em item, use Editar no alto da página."
              : undefined
          }
          semProdutos={
            <p className="text-corpo text-tinta-2 leading-relaxed">
              Nenhum produto da {pedido.fornecedor.nome} é da {pedido.cliente.apelido}. Na{" "}
              <Link href="/produtos" className="text-carimbo hover:underline font-medium">
                ficha do produto
              </Link>{" "}
              escolha-a no campo Cliente — é lá que mora o preço dela, e é por isso que o
              produto é de um cliente só.
            </p>
          }
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
            densidade: texto(p.densidade),
            precoUnidade: texto(p.precoUnidade),
            precoCaixa: texto(p.precoCaixa),
            precoKg: texto(p.precoKg),
            unidadeAvulsa: p.unidadeAvulsa,
            precoAvulso: texto(p.precoAvulso),
            unidadesPorCaixa: p.unidadesPorCaixa,
            unidadePadrao: unidadeDoRotulo(p.unidadeRotulo),
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
          emLeitura={aberto && !editavel}
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

        {pedido.edicoes.length > 0 && (
          <SecaoCartao
            icone={History}
            titulo="Edições"
            descricao="Quem mexeu no pedido depois de ele ficar pronto."
          >
            <ul className="space-y-1">
              {pedido.edicoes.map((edicao) => (
                <li key={edicao.id} className="text-mini text-tinta-2">
                  {edicao.usuario ? nomeCompleto(edicao.usuario) : "usuário removido"}
                  {edicao.usuario && edicao.usuario.papel !== "ADMIN" && (
                    <span className="text-tinta-3"> (preposto)</span>
                  )}{" "}
                  · <span className="numerico">{DATA_HORA.format(edicao.editadoEm)}</span>
                </li>
              ))}
            </ul>
          </SecaoCartao>
        )}

        {pedido.envios.length > 0 && (
          <SecaoCartao
            icone={Mail}
            titulo="Envios por e-mail"
            descricao="Cada vez que o pedido saiu daqui, e para quem."
          >
            <Painel>
              {pedido.envios.map((envio) => (
                <div key={envio.id} className="px-4 py-3 text-corpo space-y-0.5">
                  <div className="flex flex-wrap justify-between gap-x-4">
                    <span className="font-medium">{envio.para.join(", ")}</span>
                    <span className="text-mini text-tinta-3 numerico">
                      {DATA_HORA.format(envio.enviadoEm)}
                    </span>
                  </div>
                  <div className="text-mini text-tinta-3">
                    de {envio.de}
                    {envio.cc.length > 0 && ` · cópia para ${envio.cc.join(", ")}`}
                    {envio.anexos.length > 1 && ` · ${envio.anexos.length} anexos`}
                  </div>
                </div>
              ))}
            </Painel>
          </SecaoCartao>
        )}
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
