import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, Factory, FileDown, Mail, Pencil, ScrollText } from "lucide-react";

import { BotaoExcluir } from "@/components/botao-excluir";
import { type ContatoEnvio, EnvioPorEmail } from "@/components/envio-email";
import { SecaoItens } from "@/components/itens-documento";
import { Pagina } from "@/components/pagina";
import {
  BotaoLink,
  Cabecalho,
  Cartao,
  Emblema,
  formatarMoeda,
  Painel,
  SecaoCartao,
} from "@/components/ui";
import { CONTATO_EMAIL, CONTATO_NFE, textoPadraoDoOrcamento } from "@/lib/envio-orcamento";
import { escreverNumeroBr } from "@/lib/numero-br";
import { unidadeDoRotulo } from "@/lib/produto-preco";
import { nomeArquivoOrcamento } from "@/lib/pdf/nome-arquivo";
import { escopoAtual } from "@/lib/sessao";
import { nomeCompleto } from "@/lib/nome-usuario";

import { SeloOrcamento, destinatario } from "../selo";
import {
  adicionarItem,
  adicionarItemPorConta,
  atualizarItem,
  atualizarOrcamento,
  cadastrarProdutosDaProposta,
  converterEmPedido,
  definirIpiDeTodosOsItens,
  definirStatus,
  enviarOrcamentoPorEmail,
  excluirOrcamento,
  salvarMotivoRecusa,
  removerItem,
} from "../acoes";
import { ContaItem } from "./conta-item";
import { DesfechoProposta, FichaProposta, PendenciasDoPedido } from "./ficha";

const DATA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" });
const DATA_HORA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

/** Decimal do Prisma para o texto que o componente espera. */
const texto = (v: { toString(): string } | null) => (v === null ? null : v.toString());

/** "AAAA-MM-DD" em UTC — a coluna é `date`, sem hora. */
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export default async function PaginaOrcamento({
  params,
  searchParams,
}: PageProps<"/orcamentos/[id]">) {
  const { id } = await params;
  const parametros = await searchParams;
  const { organizacaoId, usuarioId, db } = await escopoAtual();

  const orcamento = await db.orcamento.findFirst({
    where: { id, organizacaoId },
    include: {
      cliente: true,
      fornecedor: { select: { id: true, nome: true } },
      itens: { orderBy: { ordem: "asc" } },
      pedidos: { select: { id: true, numero: true }, orderBy: { numero: "asc" } },
      edicoes: {
        orderBy: { editadoEm: "desc" },
        select: { id: true, editadoEm: true, usuario: { select: { nome: true, sobrenome: true } } },
      },
      envios: {
        orderBy: { enviadoEm: "desc" },
        select: { id: true, de: true, para: true, cc: true, anexos: true, enviadoEm: true },
      },
    },
  });

  if (!orcamento) notFound();

  // As caixas e o texto de QUEM ESTÁ OLHANDO, como no pedido: quem envia assina.
  const [contas, modeloEnvio] = await Promise.all([
    db.contaEmail.findMany({
      where: { usuarioId },
      orderBy: [{ padrao: "desc" }, { criadoEm: "asc" }],
      select: { id: true, email: true, nomeExibicao: true, padrao: true },
    }),
    db.usuario.findUnique({
      where: { id: usuarioId },
      select: { assuntoOrcamentoPadrao: true, mensagemOrcamentoPadrao: true },
    }),
  ]);

  /*
   * O que dá para lançar aqui: produto DESTE cliente E DESTA indústria.
   *
   * As duas condições valem juntas — produto que o cliente compra, mas de outra
   * indústria, não entra, porque a proposta é de uma indústria só e o IPI
   * congelado é o dela.
   *
   * O dono do produto é `clienteId`, no próprio produto. É ele que responde
   * também por que o produto de outro cliente não entra: cada um carrega o
   * preço negociado do seu dono, e oferecê-lo aqui levaria esse preço para
   * dentro da proposta de quem não o negociou.
   *
   * Sem cliente cadastrado não há produto a oferecer, e aí o item nasce da
   * CONTA (`ContaItem`): família, medidas, fator, aditivos — com os materiais
   * e aditivos da indústria da proposta para a conta sair da tabela dela.
   */
  const produtos = orcamento.clienteId
    ? await db.produto.findMany({
        where: {
          organizacaoId,
          fornecedorId: orcamento.fornecedorId,
          ativo: true,
          clienteId: orcamento.clienteId,
        },
        orderBy: { descricao: "asc" },
        include: { aditivos: { include: { aditivo: true } } },
      })
    : [];

  const industria = orcamento.clienteId
    ? null
    : await db.fornecedor.findFirst({
        where: { id: orcamento.fornecedorId, organizacaoId },
        select: {
          aditivos: { where: { ativo: true }, orderBy: { nome: "asc" } },
          materiais: { where: { ativo: true }, orderBy: { nome: "asc" } },
        },
      });

  /** Linhas feitas de conta que ainda não são produto — o que segura o pedido. */
  const itensSemProduto = orcamento.itens.filter((i) => i.produtoId === null).length;
  const viraPedido = orcamento.cliente !== null && itensSemProduto === 0;

  /*
   * A proposta abre para LEITURA, e é assim de propósito: depois de gravada ela
   * é o que o cliente recebeu, e uma tela que já chega editável convida a mexer
   * sem querer no documento que está valendo.
   *
   * Duas exceções, e as duas são o mesmo caso — ninguém deu a proposta por
   * pronta ainda: a que acabou de nascer (`emElaboracao`), e aquela em que se
   * clicou em editar de propósito (`?editar=1`).
   */
  const aberto = orcamento.status === "ABERTO";
  const editavel = aberto && (orcamento.emElaboracao || parametros.editar === "1");
  const para = destinatario(orcamento);

  /*
   * Descartar só vale para a proposta sem desfecho — a mesma guarda de
   * `excluirOrcamento`, repetida aqui para o botão nem aparecer onde ele
   * falharia. Aceita e recusada são história; quem quiser jogar fora reabre
   * antes. Um já virado pedido some da mesma forma: o pedido é quem manda.
   */
  const descartavel =
    (aberto || orcamento.status === "EXPIRADO") && orcamento.pedidos.length === 0;

  /*
   * Para quem a proposta vai: os e-mails do cadastro do cliente, os dois já
   * marcados. O da NF-e só aparece se for outro endereço. Proposta de quem
   * ainda não é cliente não tem nenhum — a pessoa digita.
   */
  const contatosDoCliente: ContatoEnvio[] = [
    { id: CONTATO_EMAIL, nome: "E-mail", setor: null, email: orcamento.cliente?.email ?? "", padrao: true },
    {
      id: CONTATO_NFE,
      nome: "E-mail da NF-e",
      setor: null,
      email: orcamento.cliente?.emailNfe ?? "",
      padrao: true,
    },
  ].filter(
    (contato, i, todos) =>
      contato.email && todos.findIndex((outro) => outro.email === contato.email) === i,
  );
  const ultimoEnvio = orcamento.envios[0]?.enviadoEm;

  return (
    <Pagina>
      <Cabecalho
        voltar={{ href: "/orcamentos", rotulo: "Orçamentos" }}
        titulo={`Orçamento #${orcamento.numero}`}
        descricao={
          `${para.nome} · ${orcamento.fornecedor.nome}` +
          (ultimoEnvio ? ` · enviada em ${DATA_HORA.format(ultimoEnvio)}` : "")
        }
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
            {orcamento.itens.length > 0 && (
              <EnvioPorEmail
                jaEnviado={orcamento.envios.length > 0}
                acao={enviarOrcamentoPorEmail.bind(null, orcamento.id)}
                contas={contas}
                contatos={contatosDoCliente}
                textoPadrao={textoPadraoDoOrcamento(
                  {
                    numero: orcamento.numero,
                    cliente: para.razaoSocial,
                    attn: orcamento.attn,
                    validoAte: orcamento.validoAte,
                    prazoPagamento: orcamento.prazoPagamento,
                    vendedor: orcamento.vendedor,
                  },
                  {
                    assunto: modeloEnvio?.assuntoOrcamentoPadrao,
                    corpo: modeloEnvio?.mensagemOrcamentoPadrao,
                  },
                )}
                nomeArquivoPdf={nomeArquivoOrcamento(
                  orcamento.numero,
                  orcamento.cliente?.apelido ?? orcamento.clienteAvulsoNome ?? "proposta",
                  orcamento.criadoEm,
                )}
                documento={{
                  titulo:
                    orcamento.envios.length > 0
                      ? "Reenviar proposta por e-mail"
                      : "Enviar proposta por e-mail",
                  descricao: `Para ${para.nome}. A proposta passa a abrir em leitura; aceite e recusa continuam com você.`,
                  rotuloPara: `Para — ${para.nome}`,
                  semContatos: para.cadastrado
                    ? `A ${para.nome} não tem e-mail no cadastro. Digite o endereço abaixo.`
                    : "Quem ainda não é cliente não tem e-mail guardado. Digite o endereço abaixo.",
                  placeholderAvulsos: "compras@cliente.com.br",
                  faltaDestinatario: "Escolha ou digite pelo menos um e-mail do cliente",
                  tituloEntrega: `Proposta enviada para ${para.nome}`,
                  este: "esta proposta",
                }}
              />
            )}
            {aberto && !editavel && (
              <BotaoLink href={`/orcamentos/${orcamento.id}?editar=1`} icone={Pencil}>
                Editar
              </BotaoLink>
            )}
            {descartavel && (
              <BotaoExcluir
                rotulo="Apagar"
                nome={`Orçamento #${orcamento.numero}`}
                aviso="Some de vez. Se for a última proposta criada, o número volta para a próxima."
                acao={excluirOrcamento.bind(null, orcamento.id)}
              />
            )}
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

        {!viraPedido && (
          <PendenciasDoPedido
            cadastrarClienteEm={`/clientes/novo?orcamento=${orcamento.id}`}
            cliente={orcamento.cliente?.apelido ?? null}
            itens={orcamento.itens.length}
            itensSemProduto={itensSemProduto}
            cadastrarTodos={cadastrarProdutosDaProposta.bind(null, orcamento.id)}
          />
        )}

        <SecaoItens
          editavel={editavel}
          motivoTravado={
            aberto
              ? "Em leitura. Para lançar ou mexer em item, use Editar no alto da página."
              : "Proposta fechada: os itens são os que o cliente recebeu."
          }
          semProdutos={
            orcamento.cliente && (
              <p className="text-corpo text-tinta-2 leading-relaxed">
                Nenhum produto da {orcamento.fornecedor.nome} é da{" "}
                {orcamento.cliente.apelido}. Na{" "}
                <Link href="/produtos" className="text-carimbo hover:underline font-medium">
                  ficha do produto
                </Link>{" "}
                escolha-a no campo Cliente — é lá que mora o preço dela, e é por isso que o
                produto é de um cliente só.
              </p>
            )
          }
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
            cadastrarEm:
              orcamento.cliente && item.produtoId === null
                ? `/produtos/novo?orcamentoItem=${item.id}`
                : undefined,
          }))}
          adicao={
            industria ? (
              <ContaItem
                materiais={industria.materiais.map((m) => ({
                  nome: m.nome,
                  precoKg: m.precoKg.toString(),
                  precoMinimoKg: m.precoMinimoKg ? m.precoMinimoKg.toString() : null,
                  densidade: m.densidade ? m.densidade.toString() : null,
                }))}
                aditivos={industria.aditivos.map((a) => ({
                  id: a.id,
                  nome: a.nome,
                  sufixoDescricao: a.sufixoDescricao,
                  tipo: a.tipo,
                  valor: a.valor.toString(),
                }))}
                adicionar={adicionarItemPorConta.bind(null, orcamento.id)}
              />
            ) : undefined
          }
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
          fechada={!aberto}
          valores={{
            attn: orcamento.attn ?? "",
            validoAte: iso(orcamento.validoAte),
            prazoPagamento: orcamento.prazoPagamento ?? "",
            vendedor: orcamento.vendedor ?? "",
            cidade: orcamento.cidade ?? "",
            observacoes: orcamento.observacoes ?? "",
          }}
          edicoes={orcamento.edicoes.map((edicao) => ({
            id: edicao.id,
            quem: edicao.usuario ? nomeCompleto(edicao.usuario) : "usuário removido",
            quando: DATA_HORA.format(edicao.editadoEm),
          }))}
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
              viraPedido={viraPedido}
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

        {orcamento.envios.length > 0 && (
          <SecaoCartao
            icone={Mail}
            titulo="Envios por e-mail"
            descricao="Cada vez que a proposta saiu, e para quem."
          >
            <Painel>
              {orcamento.envios.map((envio) => (
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
