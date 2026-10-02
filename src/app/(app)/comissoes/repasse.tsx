"use client";

/**
 * O repasse ao preposto: quanto o escritório deve a ele no mês, quanto já
 * pagou e o que sobra para o mês seguinte.
 *
 * O devido é sobre o RECEBIDO — o escritório só repassa o que a indústria já
 * pagou. O previsto aparece ao lado como expectativa, não como dívida.
 *
 * O extrato e o lançamento abrem DENTRO da linha, como o acerto em
 * `acerto.tsx`: pagar os prepostos no fim do mês é percorrer a lista, e uma
 * janela por preposto tiraria a lista da vista.
 */

import { ChevronDown } from "lucide-react";
import Link from "next/link";
import { useActionState, useId, useState } from "react";

import { CampoMoeda } from "@/components/campo-mascarado";
import {
  Botao,
  BotaoTexto,
  Campo,
  CorpoLinha,
  FimDaLinha,
  LinhaDado,
  MensagemErro,
  Painel,
  ValorLinha,
  formatarMoeda,
} from "@/components/ui";

import type { EstadoFormulario } from "./acoes";

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
  /** A fatia do preposto no previsto e no já acertado. */
  previsto: number;
  recebido: number | null;
};

export type DadosRepasse = {
  nome: string;
  pedidos: number;
  previsto: number;
  devido: number;
  pago: number;
  anterior: number;
  aRepassar: number;
  extrato: ItemExtrato[];
  pagamentos: PagamentoRepasse[];
};

function plural(n: number, palavra: string): string {
  return `${n} ${palavra}${n === 1 ? "" : "s"}`;
}

function tomDoSaldo(saldo: number) {
  if (saldo > 0) return "text-perigo";
  if (saldo === 0) return "text-verde";
  return "text-carimbo";
}

/** O saldo dos meses anteriores, quando há — positivo é dívida, negativo é crédito. */
function NotaAnterior({ anterior, quem }: { anterior: number; quem: "escritorio" | "preposto" }) {
  if (anterior === 0) return null;

  const credito = anterior < 0;
  const texto =
    quem === "escritorio"
      ? credito
        ? `Inclui ${formatarMoeda(-anterior)} pagos a mais nos meses anteriores.`
        : `Inclui ${formatarMoeda(anterior)} que ficaram pendentes dos meses anteriores.`
      : credito
        ? `Inclui ${formatarMoeda(-anterior)} recebidos adiantados nos meses anteriores.`
        : `Inclui ${formatarMoeda(anterior)} pendentes dos meses anteriores.`;

  return <p className="text-mini text-tinta-3">{texto}</p>;
}

function ListaPagamentos({ pagamentos }: { pagamentos: PagamentoRepasse[] }) {
  if (pagamentos.length === 0) {
    return <p className="text-mini text-tinta-3">Nenhum pagamento lançado para este mês.</p>;
  }

  return (
    <Painel>
      {pagamentos.map((p) => (
        <LinhaPagamento key={p.id} pagamento={p} />
      ))}
    </Painel>
  );
}

function LinhaPagamento({ pagamento }: { pagamento: PagamentoRepasse }) {
  return (
    <LinhaDado className="py-2.5">
      <CorpoLinha
        titulo={`Pago em ${DATA.format(new Date(`${pagamento.pagoEm}T00:00:00.000Z`))}`}
        detalhe={pagamento.observacao ?? undefined}
      />
      <FimDaLinha>
        <ValorLinha valor={formatarMoeda(pagamento.valor)} />
        {pagamento.excluir && (
          <ExcluirPagamento valor={pagamento.valor} excluir={pagamento.excluir} />
        )}
      </FimDaLinha>
    </LinhaDado>
  );
}

function ExcluirPagamento({ valor, excluir }: { valor: number; excluir: Acao }) {
  const [estado, enviar, excluindo] = useActionState(excluir, {});

  return (
    <form
      action={enviar}
      onSubmit={(evento) => {
        if (!confirm(`Excluir o pagamento de ${formatarMoeda(valor)}?`)) evento.preventDefault();
      }}
      className="text-right"
    >
      <BotaoTexto type="submit" perigoso disabled={excluindo}>
        {excluindo ? "excluindo…" : "excluir"}
      </BotaoTexto>
      {estado.erro && <MensagemErro>{estado.erro}</MensagemErro>}
    </form>
  );
}

function Extrato({ itens }: { itens: ItemExtrato[] }) {
  if (itens.length === 0) {
    return <p className="text-mini text-tinta-3">Nenhum pedido deste preposto no mês.</p>;
  }

  return (
    <Painel>
      {itens.map((item) => (
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
          />
          <FimDaLinha>
            <ValorLinha className="w-28" valor={formatarMoeda(item.previsto)} nota="previsto" />
            <ValorLinha
              className="w-28"
              valor={item.recebido === null ? "—" : formatarMoeda(item.recebido)}
              nota={item.recebido === null ? "a acertar" : "devido"}
            />
          </FimDaLinha>
        </LinhaDado>
      ))}
    </Painel>
  );
}

/**
 * A linha de um preposto no cartão do administrador, com o extrato e o
 * lançamento do pagamento embutidos.
 */
export function LinhaRepasse({
  dados,
  registrar,
  sugestao,
  hoje,
}: {
  dados: DadosRepasse;
  registrar: Acao;
  /** O saldo a repassar já no padrão brasileiro, para o campo nascer preenchido. */
  sugestao: string;
  /** "AAAA-MM-DD" — o dia do pagamento, quando não se diz outro. */
  hoje: string;
}) {
  const [estado, enviar, salvando] = useActionState(registrar, {});
  const [aberto, setAberto] = useState(false);
  const painel = useId();

  /*
   * Salvou sem erro, limpa o formulário trocando a chave — o valor sugerido
   * muda com o pagamento novo, e o campo precisa renascer com ele.
   */
  const [estadoVisto, setEstadoVisto] = useState(estado);
  const [versao, setVersao] = useState(0);
  if (estado !== estadoVisto) {
    setEstadoVisto(estado);
    if (!estado.erro) setVersao((v) => v + 1);
  }

  return (
    <div>
      <LinhaDado>
        <CorpoLinha titulo={dados.nome} detalhe={plural(dados.pedidos, "pedido")} />

        <FimDaLinha>
          <ValorLinha className="w-28" valor={formatarMoeda(dados.previsto)} nota="previsto" />
          <ValorLinha className="w-28" valor={formatarMoeda(dados.devido)} nota="devido" />
          <ValorLinha className="w-28" valor={formatarMoeda(dados.pago)} nota="pago" />
          <div className="w-28 text-right shrink-0">
            <div className={`text-corpo numerico font-semibold ${tomDoSaldo(dados.aRepassar)}`}>
              {formatarMoeda(dados.aRepassar)}
            </div>
            <div className="text-mini text-tinta-3 mt-0.5">a repassar</div>
          </div>
          <BotaoTexto
            type="button"
            onClick={() => setAberto((a) => !a)}
            aria-expanded={aberto}
            aria-controls={painel}
            aria-label={`Extrato e pagamentos de ${dados.nome}`}
            className="inline-flex items-center"
          >
            <ChevronDown
              size={15}
              strokeWidth={2}
              aria-hidden="true"
              className={`transition-transform duration-200 ${aberto ? "rotate-180" : ""}`}
            />
          </BotaoTexto>
        </FimDaLinha>
      </LinhaDado>

      {/* `hidden`, e não desmontar: o que foi digitado sobrevive a fechar e abrir. */}
      <div id={painel} hidden={!aberto} className="px-4 pb-4 space-y-4">
        <section className="space-y-2">
          <h3 className="rotulo text-tinta-2">Extrato do mês</h3>
          <Extrato itens={dados.extrato} />
        </section>

        <section className="space-y-2">
          <h3 className="rotulo text-tinta-2">Pagamentos</h3>
          <ListaPagamentos pagamentos={dados.pagamentos} />
          <NotaAnterior anterior={dados.anterior} quem="escritorio" />
        </section>

        <form key={versao} action={enviar} className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <CampoMoeda
              name="valor"
              rotulo="Valor pago"
              defaultValue={sugestao}
              className="basis-36 grow"
            />
            <Campo
              type="date"
              name="pagoEm"
              rotulo="Pago em"
              defaultValue={hoje}
              className="basis-40 grow"
            />
            <Campo name="observacao" rotulo="Observação" className="basis-48 grow-[2]" />
            <Botao type="submit" variante="secundaria" carregando={salvando} className="px-4 py-2">
              {salvando ? "Salvando…" : "Registrar pagamento"}
            </Botao>
          </div>
          <MensagemErro>{estado.erro}</MensagemErro>
        </form>
      </div>
    </div>
  );
}

/** O mesmo saldo, na tela do preposto: somente leitura. */
export function ResumoRepasse({ dados }: { dados: DadosRepasse }) {
  return (
    <div className="space-y-3">
      <Painel>
        <LinhaDado>
          <CorpoLinha
            titulo="Do escritório"
            detalhe="sua fatia do que a indústria já pagou"
          />
          <FimDaLinha>
            <ValorLinha className="w-28" valor={formatarMoeda(dados.devido)} nota="devido" />
            <ValorLinha className="w-28" valor={formatarMoeda(dados.pago)} nota="recebido" />
            <div className="w-28 text-right shrink-0">
              <div className={`text-corpo numerico font-semibold ${tomDoSaldo(dados.aRepassar)}`}>
                {formatarMoeda(dados.aRepassar)}
              </div>
              <div className="text-mini text-tinta-3 mt-0.5">a receber</div>
            </div>
          </FimDaLinha>
        </LinhaDado>
      </Painel>
      <NotaAnterior anterior={dados.anterior} quem="preposto" />
      <ListaPagamentos pagamentos={dados.pagamentos} />
    </div>
  );
}
