import { notFound } from "next/navigation";
import {
  CalendarDays,
  Factory,
  Inbox,
  Link2,
  Mail,
  Percent,
  Phone,
  Pencil,
  ScrollText,
  ShoppingBag,
  UserRoundCheck,
  UserRoundX,
  Users,
  Wallet,
} from "lucide-react";

import { nomeDoMes } from "@/components/navegador-mes";
import { Pagina } from "@/components/pagina";
import { SeloStatus } from "@/components/selo-status";
import {
  Botao,
  BotaoLink,
  Cabecalho,
  CartaoMetrica,
  Cartao,
  CorpoLinha,
  EstadoVazio,
  FaixaMetricas,
  FimDaLinha,
  LinhaLista,
  Placa,
  Selo,
  ValorLinha,
  formatarMoeda,
} from "@/components/ui";
import { escreverNumeroBr } from "@/lib/numero-br";
import { escopoAtual } from "@/lib/sessao";

import { alternarAtivoPreposto, atualizarPreposto, redefinirSenhaPreposto } from "../acoes";
import { AvatarPreposto } from "../avatar-preposto";
import { fichaDoPreposto } from "../consulta";
import { FormularioPreposto } from "../formulario";
import { TrocarSenha } from "./senha";

const DATA = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
const MES_ANO = new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" });

/**
 * A ficha do preposto: quem é, o acordo, a carteira, o que vendeu e o que
 * tem a receber.
 *
 * A comissão aparece resumida — a do mês e o saldo a repassar — com o
 * caminho para o extrato em Comissões, que é onde se lança o repasse. Repetir
 * o extrato aqui seria a mesma tabela em dois lugares, um deles desatualizado
 * no dia em que alguém mudar só o outro.
 */
export default async function PaginaPreposto({
  params,
  searchParams,
}: PageProps<"/prepostos/[id]">) {
  const { id } = await params;
  /*
   * A ficha abre para LEITURA, como a de cliente: editável só quando se clicou
   * em Editar (`?editar=1`). Aí a tela vira o formulário do cadastro, com a
   * troca de senha abaixo, e "Salvar e voltar" devolve à ficha.
   */
  const editavel = (await searchParams).editar === "1";
  const { organizacaoId, db, ehAdmin, plano } = await escopoAtual();

  // O mesmo porteiro da lista: preposto não administra preposto.
  if (!ehAdmin || plano !== "PLUS") notFound();

  const ficha = await fichaDoPreposto(db, organizacaoId, id);
  if (!ficha) notFound();

  const { preposto, competencia, recentes, totalDePedidos, clientes } = ficha;
  const { comissao } = preposto;
  const mes = nomeDoMes(competencia);
  const ticket = comissao.pedidos ? Number(comissao.venda) / comissao.pedidos : null;
  const percentual = preposto.comissaoPercentualPadrao
    ? escreverNumeroBr(preposto.comissaoPercentualPadrao.toString())
    : "";
  const industrias = preposto.fornecedores.map((f) => f.fornecedor.nome).sort();
  const inativos = clientes.filter((c) => !c.ativo).length;

  const selo = preposto.ativo ? <Selo tom="verde">com acesso</Selo> : <Selo tom="cancelado">sem acesso</Selo>;

  if (editavel) {
    // As ativas, e as inativas que ainda estão marcadas para ele: escondê-las
    // faria o vínculo sumir no primeiro "Salvar", sem ninguém ter desmarcado.
    const opcoes = await db.fornecedor.findMany({
      where: {
        organizacaoId,
        OR: [{ ativo: true }, { prepostos: { some: { usuarioId: preposto.id } } }],
      },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true },
    });

    return (
      <Pagina>
        <Cabecalho
          voltar={{ href: `/prepostos/${preposto.id}`, rotulo: preposto.nomeCompleto }}
          icone={Pencil}
          titulo={`Editar ${preposto.nome}`}
          descricao="O percentual novo vale para os próximos pedidos — os já lançados guardam o da época."
          selo={selo}
        />
        <div className="space-y-5">
          <FormularioPreposto
            acao={atualizarPreposto.bind(null, preposto.id)}
            rotuloEnvio="Salvar e voltar"
            valores={{
              nome: preposto.nome,
              sobrenome: preposto.sobrenome ?? "",
              email: preposto.email,
              telefone: preposto.telefone ?? "",
              comissaoPercentual: percentual,
              fornecedorIds: preposto.fornecedores.map((f) => f.fornecedor.id),
            }}
            industrias={opcoes}
          />
          <TrocarSenha acao={redefinirSenhaPreposto.bind(null, preposto.id)} />
        </div>
      </Pagina>
    );
  }

  return (
    <Pagina>
      <Cabecalho
        titulo={preposto.nomeCompleto}
        voltar={{ href: "/prepostos", rotulo: "Prepostos" }}
        selo={selo}
        acao={
          <div className="flex flex-wrap gap-2">
            <BotaoLink href={`/prepostos/${preposto.id}?editar=1`} icone={Pencil}>
              Editar
            </BotaoLink>
            {/* Tirar o acesso, e não excluir: ele aparece em pedido e comissão
                de meses fechados, e o cadastro precisa continuar existindo. */}
            <form action={alternarAtivoPreposto.bind(null, preposto.id)}>
              <Botao
                type="submit"
                variante="secundaria"
                icone={preposto.ativo ? UserRoundX : UserRoundCheck}
              >
                {preposto.ativo ? "Tirar o acesso" : "Devolver o acesso"}
              </Botao>
            </form>
          </div>
        }
      />

      <div className="space-y-5">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          {/* Quem é e o acordo. */}
          <Cartao className="p-5 sm:p-6 flex flex-col gap-5">
            <div className="flex items-center gap-4 min-w-0">
              <AvatarPreposto nome={preposto.nomeCompleto} cor={preposto.cor} grande />
              <div className="min-w-0">
                <div className="text-realce font-semibold truncate">{preposto.nome}</div>
                <div className="text-corpo text-tinta-2 truncate">{preposto.sobrenome ?? ""}</div>
              </div>
            </div>

            <ul className="space-y-3 text-corpo">
              <Dado icone={Mail} rotulo="E-mail">
                <a href={`mailto:${preposto.email}`} className="hover:text-carimbo transition-colors break-all">
                  {preposto.email}
                </a>
              </Dado>
              <Dado icone={Phone} rotulo="Telefone">
                {preposto.telefone ? (
                  <a
                    href={`tel:${preposto.telefone.replace(/[^\d+]/g, "")}`}
                    className="hover:text-carimbo transition-colors numerico"
                  >
                    {preposto.telefone}
                  </a>
                ) : (
                  <a href={`/prepostos/${preposto.id}?editar=1`} className="text-tinta-3 hover:text-carimbo transition-colors">
                    não cadastrado — adicionar
                  </a>
                )}
              </Dado>
              <Dado icone={Percent} rotulo="Comissão">
                {percentual ? (
                  <>
                    <span className="numerico font-semibold">{percentual}%</span>{" "}
                    <span className="text-tinta-3">do que a indústria paga</span>
                  </>
                ) : (
                  <span className="text-tinta-3">sem acordo definido</span>
                )}
              </Dado>
              <Dado icone={Factory} rotulo="Indústrias">
                {industrias.length === 0 ? (
                  <a href={`/prepostos/${preposto.id}?editar=1`} className="text-tinta-3 hover:text-carimbo transition-colors">
                    nenhuma — ele não vê indústria; marcar
                  </a>
                ) : (
                  industrias.join(", ")
                )}
              </Dado>
              <Dado icone={CalendarDays} rotulo="Inscrito em">
                {MES_ANO.format(preposto.criadoEm)}
              </Dado>
            </ul>
          </Cartao>

          {/* Os números do mês e a comissão dele. */}
          <div className="flex flex-col gap-5">
            <FaixaMetricas colunas={2}>
              <CartaoMetrica
                rotulo="Clientes na carteira"
                icone={Users}
                tom="lilas"
                valor={preposto._count.clientes}
                detalhe={
                  inativos === 0
                    ? "todos ativos"
                    : `${inativos} ${inativos === 1 ? "inativo" : "inativos"}`
                }
              />
              <CartaoMetrica
                rotulo={`Vendido em ${mes.toLowerCase()}`}
                icone={ShoppingBag}
                tom="mar"
                valor={formatarMoeda(comissao.venda)}
                detalhe={
                  comissao.pedidos
                    ? `${comissao.pedidos} ${comissao.pedidos === 1 ? "pedido" : "pedidos"} · ticket médio ${formatarMoeda(ticket ?? 0)}`
                    : "nenhum pedido enviado no mês"
                }
              />
            </FaixaMetricas>

            {/* Estica até o fim do cartão ao lado: as duas colunas terminam juntas. */}
            <Cartao className="p-5 sm:p-6 flex-1 flex flex-col justify-center">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
                <div className="titulo-regra">
                  <Placa icone={Wallet} tom="menta" pequena />
                  <h2 className="text-realce font-semibold">Comissão de {mes.toLowerCase()}</h2>
                </div>
                <BotaoLink
                  href={`/comissoes?mes=${competencia}`}
                  variante="secundaria"
                  tamanho="compacto"
                >
                  Ver extrato
                </BotaoLink>
              </div>

              <dl className="grid gap-4 sm:grid-cols-3">
                <Valor rotulo="Prevista" valor={comissao.prevista} nota="a fatia dele no que vendeu" />
                <Valor rotulo="Recebida" valor={comissao.recebida} nota="no que a indústria já acertou" tom="verde" />
                <Valor
                  rotulo="A repassar"
                  valor={comissao.aRepassar}
                  nota="o que o escritório deve a ele"
                  tom={Number(comissao.aRepassar) > 0 ? "sol" : undefined}
                />
              </dl>
            </Cartao>
          </div>
        </div>

        {/* Lista vazia estica até a altura da vizinha; duas listas ficam no tamanho delas. */}
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Pedidos recentes — o mesmo desenho do Painel. */}
          <section className="flex flex-col">
            <Titulo icone={ScrollText} tom="lilas">
              Pedidos recentes
            </Titulo>
            {recentes.length === 0 ? (
              <Cartao className="flex-1 flex items-center justify-center">
                <EstadoVazio icone={Inbox} discreto>
                  Nenhum pedido lançado por ele ainda.
                </EstadoVazio>
              </Cartao>
            ) : (
              <Cartao className="divide-y divide-filete overflow-hidden">
                {recentes.map((pedido) => (
                  <LinhaLista key={pedido.id} href={`/pedidos/${pedido.id}`}>
                    <div className="flex items-center gap-3 min-w-0 basis-full sm:basis-0 sm:flex-1">
                      <span className="font-mono text-mini text-tinta-3 shrink-0 w-12">{pedido.numero}</span>
                      <CorpoLinha titulo={pedido.cliente.apelido} detalhe={pedido.fornecedor.nome} />
                    </div>
                    <FimDaLinha>
                      <ValorLinha
                        className="w-28"
                        riscado={pedido.status === "CANCELADO"}
                        valor={formatarMoeda(pedido.totalGeral.toString())}
                        nota={DATA.format(pedido.criadoEm)}
                      />
                      <div className="w-24 flex justify-end">
                        <SeloStatus status={pedido.status} />
                      </div>
                    </FimDaLinha>
                  </LinhaLista>
                ))}
                <p className="px-4 py-3 text-mini text-tinta-3">
                  {totalDePedidos === recentes.length
                    ? totalDePedidos === 1
                      ? "É o único pedido dele."
                      : `São todos os ${totalDePedidos} pedidos dele.`
                    : `Os ${recentes.length} mais recentes de ${totalDePedidos} pedidos.`}
                </p>
              </Cartao>
            )}
          </section>

          {/* A carteira dele. */}
          <section className="flex flex-col">
            <Titulo
              icone={Users}
              tom="mar"
              acao={
                <BotaoLink
                  href={`/prepostos/${preposto.id}/clientes`}
                  variante="secundaria"
                  tamanho="compacto"
                  icone={Link2}
                >
                  Vincular clientes
                </BotaoLink>
              }
            >
              Clientes
            </Titulo>
            {clientes.length === 0 ? (
              <Cartao className="flex-1 flex items-center justify-center">
                <EstadoVazio icone={Users} discreto>
                  Nenhum cliente vinculado a ele ainda.
                </EstadoVazio>
              </Cartao>
            ) : (
              <Cartao className="divide-y divide-filete overflow-hidden">
                {clientes.slice(0, 10).map((cliente) => (
                  <LinhaLista key={cliente.id} href={`/clientes/${cliente.id}`}>
                    <CorpoLinha
                      titulo={cliente.apelido}
                      detalhe={[cliente.municipio, cliente.uf].filter(Boolean).join(" / ") || "—"}
                    />
                    {!cliente.ativo && (
                      <FimDaLinha>
                        <Selo>inativo</Selo>
                      </FimDaLinha>
                    )}
                  </LinhaLista>
                ))}
                {clientes.length > 10 && (
                  <p className="px-4 py-3 text-mini text-tinta-3">
                    e mais {clientes.length - 10} {clientes.length - 10 === 1 ? "cliente" : "clientes"}
                  </p>
                )}
              </Cartao>
            )}
          </section>
        </div>

      </div>
    </Pagina>
  );
}

function Dado({
  icone: Icone,
  rotulo,
  children,
}: {
  icone: typeof Mail;
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3 min-w-0">
      <Icone size={15} strokeWidth={2} aria-hidden="true" className="mt-0.5 shrink-0 text-tinta-3" />
      <div className="min-w-0">
        <div className="text-mini text-tinta-3">{rotulo}</div>
        <div className="text-tinta min-w-0">{children}</div>
      </div>
    </li>
  );
}

function Valor({
  rotulo,
  valor,
  nota,
  tom,
}: {
  rotulo: string;
  valor: string;
  nota: string;
  tom?: "verde" | "sol";
}) {
  const cor = tom === "verde" ? "text-verde" : tom === "sol" ? "text-destaque" : "text-tinta";
  return (
    <div className="min-w-0">
      <dt className="rotulo">{rotulo}</dt>
      <dd className={`cifra text-forte numerico mt-1.5 ${cor}`}>{formatarMoeda(valor)}</dd>
      <dd className="text-mini text-tinta-3 mt-1">{nota}</dd>
    </div>
  );
}

function Titulo({
  icone,
  tom,
  children,
  acao,
}: {
  icone: typeof Mail;
  tom: "lilas" | "mar";
  children: React.ReactNode;
  acao?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 mb-4 px-1">
      <Placa icone={icone} tom={tom} pequena />
      <h2 className="text-realce font-semibold">{children}</h2>
      {acao && <div className="ml-auto">{acao}</div>}
    </div>
  );
}
