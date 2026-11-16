"use client";

/**
 * O repasse ao preposto: quanto o escritório deve a ele no mês, quanto já
 * pagou e o que sobra para o mês seguinte.
 *
 * O LIBERADO é sobre o RECEBIDO — o escritório só repassa o que a indústria já
 * pagou. O previsto aparece ao lado como expectativa, não como dívida. (No
 * código, `devido`; na tela era "devido", ao lado de "a repassar", e as duas
 * palavras pareciam a mesma coisa. "Liberado" e "falta pagar" dizem a ordem:
 * primeiro a indústria libera, depois o escritório paga.)
 *
 * O extrato e o lançamento abriam DENTRO da linha; agora abrem numa janela por
 * cima (`janela-da-linha.tsx`), como o acerto em `acerto.tsx` — o painel
 * embaixo da linha ficava aberto depois do serviço feito, e quem usa pouco o
 * computador se perdia. Quem abre veio pagar: o resumo e o formulário vêm
 * primeiro, o extrato depois; registrar fecha a janela e deixa "✓ Pagamento
 * registrado" na linha.
 */

import { CalendarCheck, MessageSquareText, Trash2 } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useActionState, useId, useRef, useState } from "react";

import { CampoData } from "@/components/campo-data";
import { CampoMoeda } from "@/components/campo-mascarado";
import {
  Botao,
  Campo,
  CorpoLinha,
  LinhaDado,
  Painel,
  ValorLinha,
  formatarMoeda,
} from "@/components/ui";
import { ErroGeral, Formulario } from "@/components/formulario";
import { usePerguntaAntes } from "@/components/pergunta-antes";
import { useAoSalvar } from "@/components/ao-salvar";

import { lerNumeroBr } from "@/lib/numero-br";

import type { EstadoFormulario } from "./acoes";
import { JanelaDaLinha } from "./janela-da-linha";
import { PagamentoRealizado, type ResumoDoPagamento } from "./pagamento-realizado";
import { BolinhaPreposto } from "@/components/bolinha-preposto";

const DATA = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" });

type Acao = (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;

export type PagamentoRepasse = {
  id: string;
  /** "AAAA-MM-DD". */
  pagoEm: string;
  valor: number;
  observacao: string | null;
  /** Só na tela do administrador; o preposto não exclui nada. */
  excluir: Acao | null;
};

export type ItemExtrato = {
  chave: string;
  pedidoId: string;
  numero: number;
  /** "1/3" quando a linha é uma parcela. */
  parcela: string | null;
  cliente: string;
  industria: string;
  /** A fatia do preposto no previsto e no já acertado. */
  previsto: number;
  recebido: number | null;
};

/** Um mês anterior em que sobrou ou faltou repasse — e o porquê. */
export type MesAnteriorRepasse = {
  /** "AAAA-MM". */
  mes: string;
  /** "setembro de 2026". */
  nome: string;
  liberado: number;
  pago: number;
  /** `liberado - pago`: positivo ficou faltando, negativo foi pago a mais. */
  ficou: number;
  /** Os pedidos que a indústria pagou naquele mês — os que formam o liberado. */
  pedidos: ItemExtrato[];
  pagamentos: PagamentoRepasse[];
};

export type DadosRepasse = {
  nome: string;
  /** A cor do preposto (`corDoPreposto`). Nula na tela do próprio preposto. */
  cor: string | null;
  pedidos: number;
  previsto: number;
  devido: number;
  pago: number;
  anterior: number;
  aRepassar: number;
  extrato: ItemExtrato[];
  pagamentos: PagamentoRepasse[];
  /** De onde vem o `anterior`, mês a mês. Vazio quando ele é zero. */
  anteriores: MesAnteriorRepasse[];
};

function plural(n: number, palavra: string): string {
  return `${n} ${palavra}${n === 1 ? "" : "s"}`;
}

function tomDoSaldo(saldo: number) {
  if (saldo > 0) return "text-perigo";
  if (saldo === 0) return "text-verde";
  return "text-carimbo";
}

/**
 * O saldo, dito com palavras: "falta pagar", "tudo pago" ou "pago a mais" —
 * e o valor sem sinal, porque a palavra já diz o lado. Um "-R$ 50,00" em azul
 * pedia para a pessoa saber que negativo era crédito.
 */
function Saldo({ valor, quem }: { valor: number; quem: "escritorio" | "preposto" }) {
  const nota =
    valor > 0
      ? quem === "escritorio"
        ? "falta pagar"
        : "falta receber"
      : valor === 0
        ? quem === "escritorio"
          ? "tudo pago"
          : "tudo recebido"
        : quem === "escritorio"
          ? "pago a mais"
          : "recebido a mais";

  return (
    <div className="sm:w-28 text-right shrink-0">
      <div className={`text-corpo numerico font-semibold ${tomDoSaldo(valor)}`}>
        {formatarMoeda(Math.abs(valor))}
      </div>
      <div className={`text-mini mt-0.5 font-medium ${tomDoSaldo(valor)}`}>{nota}</div>
    </div>
  );
}

/** O saldo dos meses anteriores, quando há — positivo é dívida, negativo é crédito. */
function NotaAnterior({ anterior, quem }: { anterior: number; quem: "escritorio" | "preposto" }) {
  if (anterior === 0) return null;

  const credito = anterior < 0;
  const texto =
    quem === "escritorio"
      ? credito
        ? `Já desconta ${formatarMoeda(-anterior)} pagos a mais nos meses anteriores.`
        : `Inclui ${formatarMoeda(anterior)} que ficaram faltando nos meses anteriores.`
      : credito
        ? `Já desconta ${formatarMoeda(-anterior)} recebidos adiantados nos meses anteriores.`
        : `Inclui ${formatarMoeda(anterior)} que ficaram faltando nos meses anteriores.`;

  // Em letra de leitura: é o que explica por que "falta pagar" não é
  // "liberado − pago", e em 12px cinza ninguém achava.
  return <p className="text-corpo text-tinta-2">{texto}</p>;
}

function ListaPagamentos({ pagamentos, vazio }: { pagamentos: PagamentoRepasse[]; vazio?: string }) {
  if (pagamentos.length === 0) {
    return <p className="text-rotulo text-tinta-2">{vazio ?? "Nenhum pagamento lançado para este mês."}</p>;
  }

  const total = Math.round(pagamentos.reduce((acc, p) => acc + p.valor, 0) * 100) / 100;

  return (
    <div className="space-y-2">
      {pagamentos.map((p) => (
        <LinhaPagamento key={p.id} pagamento={p} />
      ))}
      {pagamentos.length > 1 && (
        <p className="text-right text-corpo text-tinta-2 numerico">
          {pagamentos.length} pagamentos ·{" "}
          <strong className="font-semibold text-tinta">{formatarMoeda(total)}</strong> no total
        </p>
      )}
    </div>
  );
}

/**
 * Um pagamento ao preposto, em destaque: o valor grande e verde, a data com o
 * calendário e a observação inteira, entre aspas.
 *
 * Era uma linha de lista como outra qualquer — a data em letra comum, o valor
 * à direita e a observação em 12px cinza, cortada no fim. É por aqui que se
 * confere "paguei a Maria no dia 30?", e o que se escreveu ao pagar ("PIX
 * Itaú", "cheque 123") é justamente o que se procura.
 */
function LinhaPagamento({ pagamento }: { pagamento: PagamentoRepasse }) {
  const observacao = pagamento.observacao?.trim();

  return (
    <div className="rounded-suave border border-filete border-l-4 border-l-verde bg-folha px-4 py-3">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-corpo font-semibold text-tinta numerico">
            <CalendarCheck size={16} strokeWidth={2} aria-hidden="true" className="shrink-0 text-verde" />
            Pago em {DATA.format(new Date(`${pagamento.pagoEm}T00:00:00.000Z`))}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-medio font-semibold text-verde numerico">{formatarMoeda(pagamento.valor)}</p>
            <p className="text-mini text-tinta-2">pago</p>
          </div>
          {pagamento.excluir && <ExcluirPagamento valor={pagamento.valor} excluir={pagamento.excluir} />}
        </div>
      </div>
      {observacao && (
        <p className="mt-2 flex items-start gap-2 rounded-suave bg-folha-2 px-3 py-2 text-corpo text-tinta break-words">
          <MessageSquareText size={16} strokeWidth={2} aria-hidden="true" className="mt-0.5 shrink-0 text-tinta-2" />
          <span className="min-w-0 italic">“{observacao}”</span>
        </p>
      )}
    </div>
  );
}

function ExcluirPagamento({ valor, excluir }: { valor: number; excluir: Acao }) {
  const [estado, enviar, excluindo] = useActionState(excluir, {});
  const pergunta = usePerguntaAntes({
    titulo: `Excluir o pagamento de ${formatarMoeda(valor)}?`,
    texto:
      `O pagamento sai do extrato e o "falta pagar" do mês volta a contar ${formatarMoeda(valor)} ` +
      "para o preposto. Use para corrigir um lançamento errado. Esta ação não pode ser desfeita.",
    rotulo: "Excluir",
  });

  return (
    <form action={enviar} onSubmit={pergunta.aoEnviar} className="text-right">
      {pergunta.janela}
      {/*
        Botão de verdade, com a lixeira e a borda vermelha do "perigo". Era a
        palavra "excluir" sublinhada, em 12px cinza: quem precisava corrigir
        um pagamento lançado errado não achava onde.
      */}
      <Botao
        type="submit"
        variante="perigo"
        tamanho="compacto"
        icone={Trash2}
        carregando={excluindo}
        aria-label={`Excluir o pagamento de ${formatarMoeda(valor)}`}
      >
        <span className="text-rotulo">{excluindo ? "Excluindo…" : "Excluir"}</span>
      </Botao>
      {/* A recusa em texto miúdo, embaixo do botão — um alerta inteiro
          dentro da linha do pagamento empurrava a lista toda. */}
      {estado.erro && (
        <p role="alert" className="surgir mt-1 ml-auto max-w-xs text-mini text-perigo">
          {estado.erro}
        </p>
      )}
    </form>
  );
}

/** O liberado menos o previsto de um pedido, em centavos certos; nulo enquanto a indústria não pagou. */
function diferencaDoItem(item: ItemExtrato): number | null {
  return item.recebido === null ? null : Math.round((item.recebido - item.previsto) * 100) / 100;
}

/** "+R$ 8,40" / "-R$ 3,10" / "R$ 0,00". */
function comSinal(valor: number): string {
  return `${valor > 0 ? "+" : ""}${formatarMoeda(valor)}`;
}

/**
 * Os pedidos do preposto: o previsto, o liberado e a diferença entre os dois.
 *
 * A diferença está aqui para o "liberado passou do previsto" lá em cima ter
 * onde se conferir: o pedido que a indústria pagou a mais aparece em verde, o
 * que pagou a menos em vermelho.
 */
function Extrato({ itens, vazio }: { itens: ItemExtrato[]; vazio?: string }) {
  if (itens.length === 0) {
    return <p className="text-rotulo text-tinta-2">{vazio ?? "Nenhum pedido deste preposto no mês."}</p>;
  }

  return (
    <Painel>
      {itens.map((item) => {
        const diferenca = diferencaDoItem(item);
        return (
          <LinhaDado key={item.chave} className="py-2.5">
            <CorpoLinha
              titulo={
                <>
                  <Link
                    href={`/pedidos/${item.pedidoId}`}
                    className="numerico text-tinta-2 hover:text-carimbo transition-colors"
                  >
                    #{item.numero}
                  </Link>
                  {item.parcela && (
                    <span className="ml-1.5 text-mini text-tinta-3 numerico">{item.parcela}</span>
                  )}{" "}
                  {item.cliente}
                </>
              }
              detalhe={item.industria}
            />
            <ValoresDaLinha colunas={3}>
              <ValorLinha className="sm:w-28" valor={formatarMoeda(item.previsto)} nota="previsto" />
              <ValorLinha
                className="sm:w-28"
                valor={item.recebido === null ? "—" : formatarMoeda(item.recebido)}
                nota={item.recebido === null ? "indústria não pagou" : "liberado"}
              />
              <div className="sm:w-28 text-right shrink-0">
                <div
                  className={`text-corpo numerico font-semibold ${
                    diferenca === null || diferenca === 0
                      ? "text-tinta-3"
                      : diferenca > 0
                        ? "text-verde"
                        : "text-perigo"
                  }`}
                >
                  {diferenca === null ? "—" : comSinal(diferenca)}
                </div>
                <div
                  className={`text-mini mt-0.5 ${
                    diferenca !== null && diferenca > 0
                      ? "text-verde font-medium"
                      : diferenca !== null && diferenca < 0
                        ? "text-perigo font-medium"
                        : "text-tinta-3"
                  }`}
                >
                  {diferenca === null
                    ? "diferença"
                    : diferenca > 0
                      ? "pago a mais"
                      : diferenca < 0
                        ? "pago a menos"
                        : "igual"}
                </div>
              </div>
            </ValoresDaLinha>
          </LinhaDado>
        );
      })}
    </Painel>
  );
}

/**
 * "O liberado passou do previsto": só acontece quando a indústria pagou a
 * mais em algum pedido — e a frase diz quais, para a pessoa não achar que o
 * sistema errou a conta. A lista completa, com a diferença de cada um, está
 * no extrato embaixo.
 */
function LiberadoAcimaDoPrevisto({ dados }: { dados: DadosRepasse }) {
  if (dados.devido <= dados.previsto) return null;

  const aMais = dados.extrato
    .map((item) => ({ item, diferenca: diferencaDoItem(item) }))
    .filter((d): d is { item: ItemExtrato; diferenca: number } => d.diferenca !== null && d.diferenca > 0)
    .sort((a, b) => b.diferenca - a.diferenca);
  const total = aMais.reduce((acc, d) => acc + d.diferenca, 0);
  const mostrados = aMais.slice(0, 5);
  const resto = aMais.length - mostrados.length;

  return (
    <div role="note" className="rounded-suave border border-verde/30 bg-verde-fraco px-4 py-3 space-y-1.5">
      <p className="text-corpo text-tinta leading-relaxed">
        <strong className="font-semibold">O liberado passou do previsto</strong> porque a indústria pagou a mais
        {aMais.length === 1 ? " em 1 pedido" : ` em ${aMais.length} pedidos`} — somando{" "}
        <strong className="font-semibold text-verde numerico">{formatarMoeda(Math.round(total * 100) / 100)}</strong>{" "}
        a mais na parte de {dados.nome.split(/\s+/)[0]}:
      </p>
      <ul className="text-corpo text-tinta-2 numerico space-y-0.5">
        {mostrados.map(({ item, diferenca }) => (
          <li key={item.chave}>
            #{item.numero}
            {item.parcela && ` (parcela ${item.parcela})`} · {item.cliente} ·{" "}
            <span className="font-semibold text-verde">{comSinal(diferenca)}</span>
          </li>
        ))}
      </ul>
      {resto > 0 && (
        <p className="text-rotulo text-tinta-2">
          E mais {resto === 1 ? "1 pedido" : `${resto} pedidos`} — todos no extrato, embaixo, em verde.
        </p>
      )}
    </div>
  );
}

/**
 * De onde vem o saldo de meses anteriores: mês a mês, o que foi liberado, o
 * que foi pago e o que ficou — e, aberto, os pedidos que formaram o liberado
 * daquele mês e os pagamentos lançados para ele.
 *
 * Era só a frase "inclui R$ 200,00 que ficaram faltando nos meses anteriores",
 * sem dizer que mês nem por quê.
 */
function DeOndeVemOAnterior({ dados, quem }: { dados: DadosRepasse; quem: "escritorio" | "preposto" }) {
  if (dados.anteriores.length === 0) return null;

  const nome = dados.nome.split(/\s+/)[0];
  const devendo = dados.anterior > 0;

  return (
    <section className="space-y-2">
      <h3 className="text-corpo font-semibold text-tinta">
        {devendo
          ? `De onde vêm os ${formatarMoeda(dados.anterior)} de meses anteriores`
          : `De onde vêm os ${formatarMoeda(-dados.anterior)} pagos a mais antes`}
      </h3>
      <p className="text-rotulo text-tinta-2 leading-relaxed">
        {devendo
          ? quem === "escritorio"
            ? `Nos meses abaixo, o que foi pago a ${nome} não cobriu tudo o que a indústria liberou. Essa sobra soma no "falta pagar" deste mês.`
            : "Nos meses abaixo, o que o escritório pagou não cobriu tudo o que a indústria liberou. Essa sobra soma no que falta receber."
          : quem === "escritorio"
            ? `Nos meses abaixo, ${nome} recebeu mais do que a indústria tinha liberado. A sobra desconta do "falta pagar" deste mês.`
            : "Nos meses abaixo, você recebeu mais do que a indústria tinha liberado. A sobra desconta do que falta receber."}
      </p>

      <div className="space-y-2">
        {dados.anteriores.map((m) => (
          <details key={m.mes} className="group rounded-suave border border-filete bg-folha">
            <summary className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 cursor-pointer list-none">
              <span className="flex-1 min-w-40">
                <span className="block text-corpo font-semibold text-tinta first-letter:uppercase">{m.nome}</span>
                <span className="block text-rotulo text-tinta-2 numerico">
                  liberados {formatarMoeda(m.liberado)} · pagos {formatarMoeda(m.pago)}
                </span>
              </span>
              <span className="text-right">
                <span
                  className={`block text-corpo font-semibold numerico ${m.ficou > 0 ? "text-perigo" : "text-carimbo"}`}
                >
                  {formatarMoeda(Math.abs(m.ficou))}
                </span>
                <span className={`block text-mini font-medium ${m.ficou > 0 ? "text-perigo" : "text-carimbo"}`}>
                  {m.ficou > 0 ? "ficou faltando" : "pago a mais"}
                </span>
              </span>
              <span className="w-full text-rotulo font-medium text-carimbo underline underline-offset-2 decoration-carimbo/35">
                <span className="group-open:hidden">Ver os pedidos e os pagamentos de {m.nome}</span>
                <span className="hidden group-open:inline">Esconder os pedidos de {m.nome}</span>
              </span>
            </summary>

            <div className="px-4 pb-4 space-y-3">
              <div className="space-y-1.5">
                <h4 className="text-rotulo font-semibold text-tinta-2">
                  Pedidos que a indústria pagou em {m.nome} — somam os {formatarMoeda(m.liberado)} liberados
                </h4>
                <Extrato itens={m.pedidos} vazio={`Nenhum pedido pago em ${m.nome}.`} />
              </div>
              <div className="space-y-1.5">
                <h4 className="text-rotulo font-semibold text-tinta-2">
                  Pagamentos lançados para {m.nome} — somam {formatarMoeda(m.pago)}
                </h4>
                <ListaPagamentos pagamentos={m.pagamentos} vazio={`Nenhum pagamento lançado para ${m.nome}.`} />
              </div>
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}

/**
 * A largura do botão da linha no computador. A linha "Fica com o escritório",
 * na página, guarda o mesmo espaço vazio (`w-32`) para os valores dela caírem
 * embaixo dos das linhas de cima — escrito lá à mão: constante exportada daqui
 * chegaria ao Server Component como referência, não como texto.
 */
const LARGURA_DO_BOTAO = "sm:w-32";

/**
 * A linha de um preposto no cartão do administrador. O botão dela abre a
 * janela do pagamento: o resumo do mês, o formulário e o extrato.
 */
export function LinhaRepasse({
  dados,
  registrar,
  sugestao,
  hoje,
  nomeDoMes,
}: {
  dados: DadosRepasse;
  registrar: Acao;
  /** O saldo a repassar já no padrão brasileiro, para o campo nascer preenchido. */
  sugestao: string;
  /** "AAAA-MM-DD" — o dia do pagamento, quando não se diz outro. */
  hoje: string;
  /** "Novembro de 2026" — o mês da tela, no alto da janela. */
  nomeDoMes: string;
}) {
  const [aberto, setAberto] = useState(false);
  const painel = useId();
  /*
   * O pagamento que acabou de ser registrado: abre o "Pagamento realizado com
   * sucesso", com o caminhão (`pagamento-realizado.tsx`), até a pessoa tocar
   * em "Ok". Era um "✓ Pagamento registrado" miúdo na linha.
   */
  const [realizado, setRealizado] = useState<ResumoDoPagamento | null>(null);
  /*
   * Registrou: o formulário renasce na próxima abertura (a chave muda) — o
   * valor sugerido muda com o pagamento novo. No computador a janela já o
   * desmonta ao fechar; no celular a folha o guardaria.
   */
  const [versao, setVersao] = useState(0);

  // O botão diz o que vai acontecer. Era uma setinha de 15px sem texto, e
  // quem não sabia que dava para clicar não achava onde pagar o preposto.
  const rotulo = dados.aRepassar > 0 ? "Pagar" : "Ver extrato";

  return (
    <div>
      <LinhaDado>
        <CorpoLinha
          titulo={
            <span className="flex items-center gap-2 min-w-0">
              {dados.cor && <BolinhaPreposto cor={dados.cor} />}
              <span className="truncate">{dados.nome}</span>
            </span>
          }
          detalhe={plural(dados.pedidos, "pedido")}
        />

        <ValoresDaLinha>
          <ValorLinha className="sm:w-28" valor={formatarMoeda(dados.previsto)} nota="previsto" />
          <ValorLinha className="sm:w-28" valor={formatarMoeda(dados.devido)} nota="liberado" />
          <ValorLinha className="sm:w-28" valor={formatarMoeda(dados.pago)} nota="já pago" />
          <Saldo valor={dados.aRepassar} quem="escritorio" />
        </ValoresDaLinha>
        {/* Depois dos valores no computador; no celular, na linha do nome —
            embaixo da grade de valores ele ficaria sozinho numa linha. */}
        <div className={`order-2 sm:order-3 text-right ${LARGURA_DO_BOTAO}`}>
          <Botao
            type="button"
            variante="secundaria"
            tamanho="compacto"
            onClick={() => setAberto(true)}
            aria-haspopup="dialog"
            aria-label={`${rotulo} — ${dados.nome}`}
            className="px-3 w-full"
          >
            {/* 13px, e não os 12px do botão compacto: é a ação da linha. */}
            <span className="text-rotulo">{rotulo}</span>
          </Botao>
        </div>
      </LinhaDado>

      {realizado && (
        <PagamentoRealizado
          resumo={realizado}
          nome={dados.nome.split(/\s+/)[0]}
          mes={nomeDoMes.toLowerCase()}
          fechar={() => setRealizado(null)}
        />
      )}

      <JanelaDaLinha
        id={painel}
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo={`Pagamento a ${dados.nome}`}
        descricao={nomeDoMes}
      >
        <div className="space-y-5">
          <ResumoDoRepasse dados={dados} />
          <LiberadoAcimaDoPrevisto dados={dados} />
          <DeOndeVemOAnterior dados={dados} quem="escritorio" />

          <PagamentoAoPreposto
            key={versao}
            dados={dados}
            registrar={registrar}
            sugestao={sugestao}
            hoje={hoje}
            aoRegistrar={(resumo) => {
              setAberto(false);
              setVersao((v) => v + 1);
              setRealizado(resumo);
            }}
          />

          <section className="space-y-2">
            <h3 className="text-corpo font-semibold text-tinta">Pagamentos deste mês</h3>
            <ListaPagamentos pagamentos={dados.pagamentos} />
          </section>

          <section className="space-y-2">
            <h3 className="text-corpo font-semibold text-tinta">Extrato do mês — previsto, liberado e a diferença</h3>
            <Extrato itens={dados.extrato} />
          </section>
        </div>
      </JanelaDaLinha>
    </div>
  );
}

/**
 * O mês do preposto, em poucas linhas, no alto da janela: o que ele deve
 * ganhar, o que a indústria já liberou, o que já foi pago e o que falta.
 */
function ResumoDoRepasse({ dados }: { dados: DadosRepasse }) {
  const nome = dados.nome.split(/\s+/)[0];
  const itens: { rotulo: string; valor: ReactNode; nota: string }[] = [
    {
      rotulo: "Previsto no mês",
      valor: formatarMoeda(dados.previsto),
      nota: `a parte de ${nome} em todos os pedidos do mês`,
    },
    {
      rotulo: "Liberado",
      valor: formatarMoeda(dados.devido),
      nota: `a parte de ${nome} no que a indústria já pagou`,
    },
    { rotulo: "Já pago neste mês", valor: formatarMoeda(dados.pago), nota: "os pagamentos lançados abaixo" },
    ...(dados.anterior !== 0
      ? [
          {
            rotulo: "De meses anteriores",
            valor: formatarMoeda(Math.abs(dados.anterior)),
            nota:
              dados.anterior > 0
                ? "ficaram faltando — somam aqui (veja o mês logo abaixo)"
                : "pagos a mais — descontam aqui (veja o mês logo abaixo)",
          },
        ]
      : []),
  ];

  return (
    <div className="rounded-suave border border-filete bg-folha-2 px-4 py-3.5 space-y-3">
      <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
        {itens.map(({ rotulo, valor, nota }) => (
          <div key={rotulo} className="min-w-0">
            <dt className="text-rotulo text-tinta-2">{rotulo}</dt>
            <dd className="text-corpo font-semibold text-tinta numerico">
              {valor}
              <span className="block text-rotulo font-normal text-tinta-2">{nota}</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="border-t border-filete pt-3 text-realce font-semibold text-tinta">
        {dados.aRepassar > 0 ? (
          <>
            Falta pagar a {nome}:{" "}
            <span className="numerico text-perigo">{formatarMoeda(dados.aRepassar)}</span>
          </>
        ) : dados.aRepassar === 0 ? (
          <span className="text-verde">{nome} já recebeu tudo deste mês</span>
        ) : (
          <>
            {nome} recebeu <span className="numerico text-carimbo">{formatarMoeda(-dados.aRepassar)}</span> a
            mais — desconta no mês seguinte
          </>
        )}
      </p>
    </div>
  );
}

/**
 * O formulário do pagamento, com "Ao registrar, fica assim:" logo acima do
 * botão — mudando enquanto se digita o valor e a data.
 *
 * O estado da ação mora aqui dentro, e não na linha: no computador a janela
 * desmonta ao fechar, e um erro de antes não reaparece na próxima abertura.
 */
function PagamentoAoPreposto({
  dados,
  registrar,
  sugestao,
  hoje,
  aoRegistrar,
}: {
  dados: DadosRepasse;
  registrar: Acao;
  sugestao: string;
  hoje: string;
  /** Registrou: o resumo do que foi pago, para o "Pagamento realizado com sucesso". */
  aoRegistrar: (resumo: ResumoDoPagamento) => void;
}) {
  const [estado, enviar, salvando] = useActionState(registrar, {});

  const [valor, setValor] = useState(sugestao);
  const [data, setData] = useState(hoje);
  const [observacao, setObservacao] = useState("");
  const nome = dados.nome.split(/\s+/)[0];

  const pago = lerNumeroBr(valor);
  const restante = pago === null ? null : Math.round((dados.aRepassar - pago) * 100) / 100;
  const dataValida = /^\d{4}-\d{2}-\d{2}$/.test(data);

  /*
   * O resumo é guardado NO ENVIO, com o saldo de antes — a mesma conta do "Ao
   * registrar, fica assim". Depois de salvar, `dados` já chega do servidor com
   * o saldo novo, e refazer a conta ali descontaria o pagamento duas vezes.
   */
  const enviado = useRef<ResumoDoPagamento | null>(null);
  useAoSalvar(estado, () => {
    if (enviado.current) aoRegistrar(enviado.current);
  });

  return (
    <Formulario
      estado={estado}
      action={enviar}
      onSubmit={() => {
        enviado.current = { valor: pago ?? 0, data, observacao, restante: restante ?? dados.aRepassar };
      }}
      className="space-y-4"
    >
      {/* Pelo topo: o erro de um campo aparece embaixo dele, e pela base os
          vizinhos desceriam junto. */}
      <div className="flex flex-wrap items-start gap-3">
        <CampoMoeda
          name="valor"
          rotulo="Valor que você pagou"
          defaultValue={sugestao}
          onChange={(e) => setValor(e.currentTarget.value)}
          className="basis-36 grow"
        />
        <CampoData
          name="pagoEm"
          rotulo="Data do pagamento"
          defaultValue={hoje}
          onChange={setData}
          atalhos={[]}
          atalhosUteis={[]}
          className="basis-40 grow"
        />
        <Campo
          name="observacao"
          rotulo="Observação (opcional)"
          placeholder="Ex.: PIX, transferência, cheque"
          onChange={(e) => setObservacao(e.currentTarget.value)}
          className="basis-48 grow-[2]"
        />
      </div>

      {/* O que o "Registrar" vai fazer, dito antes do clique. */}
      <div aria-live="polite" className="rounded-suave border border-filete bg-folha px-4 py-3.5 space-y-2">
        {pago === null || pago <= 0 ? (
          <p className="text-corpo text-tinta-2 leading-relaxed">
            Digite o valor que você pagou a {nome}. O campo já vem com o que falta pagar.
          </p>
        ) : (
          <>
            <p className="text-rotulo font-semibold uppercase tracking-wide text-tinta-2">
              Ao registrar, fica assim:
            </p>
            <ul className="space-y-1.5 text-corpo text-tinta-2 leading-relaxed">
              <li>
                {nome} recebe <strong className="font-semibold text-tinta numerico">{formatarMoeda(pago)}</strong>
                {dataValida && (
                  <>
                    {" "}
                    em <strong className="font-semibold text-tinta numerico">{DATA.format(new Date(`${data}T00:00:00.000Z`))}</strong>
                  </>
                )}
                .
              </li>
              {observacao.trim() && (
                <li>
                  Com a observação <span className="font-semibold text-tinta italic">“{observacao.trim()}”</span>.
                </li>
              )}
              <li>
                {restante! > 0 ? (
                  <>
                    Falta pagar passa a{" "}
                    <strong className="font-semibold text-perigo numerico">{formatarMoeda(restante!)}</strong>.
                  </>
                ) : restante === 0 ? (
                  <span className="font-semibold text-verde">Fica tudo pago neste mês.</span>
                ) : (
                  <>
                    Fica <strong className="font-semibold text-carimbo numerico">{formatarMoeda(-restante!)}</strong>{" "}
                    pago a mais, que desconta no mês seguinte.
                  </>
                )}
              </li>
            </ul>
          </>
        )}
      </div>

      <ErroGeral />

      <Botao type="submit" carregando={salvando} className="max-sm:w-full max-sm:py-3">
        {salvando ? "Salvando…" : "Registrar pagamento"}
      </Botao>
    </Formulario>
  );
}

/**
 * Os valores de uma linha de repasse.
 *
 * No computador, a fileira de colunas fixas de `FimDaLinha` — é o que alinha
 * previsto, liberado, pago e saldo de um preposto com os do seguinte. No
 * celular, quatro colunas de 112px não cabem em 375: a fileira (que não pode
 * encolher) passava da borda e o cartão cortava o "pago" e o "falta pagar".
 * Ali eles viram uma grade, dois ou três por linha.
 */
export function ValoresDaLinha({
  colunas = 2,
  children,
}: {
  colunas?: 2 | 3;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`grid ${colunas === 3 ? "grid-cols-3" : "grid-cols-2"} gap-x-4 gap-y-2.5 basis-full order-3
        sm:order-2 sm:flex sm:items-center sm:justify-end sm:gap-4 sm:basis-auto sm:ml-auto sm:shrink-0`}
    >
      {children}
    </div>
  );
}

/** O mesmo saldo, na tela do preposto: somente leitura. */
export function ResumoRepasse({ dados }: { dados: DadosRepasse }) {
  return (
    <div className="space-y-3">
      <Painel>
        <LinhaDado>
          <CorpoLinha titulo="Do escritório" detalhe="sua parte do que a indústria já pagou" />
          <ValoresDaLinha colunas={3}>
            <ValorLinha className="sm:w-28" valor={formatarMoeda(dados.devido)} nota="liberado" />
            <ValorLinha className="sm:w-28" valor={formatarMoeda(dados.pago)} nota="já recebido" />
            <Saldo valor={dados.aRepassar} quem="preposto" />
          </ValoresDaLinha>
        </LinhaDado>
      </Painel>
      <NotaAnterior anterior={dados.anterior} quem="preposto" />
      <DeOndeVemOAnterior dados={dados} quem="preposto" />
      <ListaPagamentos pagamentos={dados.pagamentos} />
    </div>
  );
}
