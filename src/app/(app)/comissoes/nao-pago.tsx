"use client";

/**
 * "Ainda não foi pago": a indústria atrasou a comissão deste pedido, ou desta
 * parcela.
 *
 * Duas respostas, e a tela diz na hora o que cada uma faz com a linha:
 *
 *   - não sei quando — ela fica no mês dela, a acertar, e aparece nos meses
 *     seguintes como pendente;
 *   - vai pagar em um mês — a comissão passa a contar nele, e a linha continua
 *     à vista no mês dela, com o selo, fora da soma.
 *
 * Antes disto, o caminho era fingir um parcelamento: uma parcela de quase nada
 * no mês do pedido e outra, com o resto, no mês em que a indústria pagaria.
 *
 * As regras são as de `lib/adiamento.ts`, as mesmas que o servidor confere.
 */

import { CalendarClock, CircleHelp, Undo2 } from "lucide-react";
import { useActionState, useState } from "react";

import { useAoSalvar } from "@/components/ao-salvar";
import { CampoMes } from "@/components/campo-mes";
import { ErroGeral, Formulario } from "@/components/formulario";
import { Botao, MensagemErro, formatarMoeda } from "@/components/ui";
import {
  mesSugerido,
  mesesParaAdiar,
  nomeCurtoDaCompetencia,
  nomeDaCompetencia,
} from "@/lib/adiamento";

import type { EstadoFormulario } from "./acoes";
import { Escolhas } from "./escolhas";

type Acao = (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;

type Quando = "sem-previsao" | "mes";

export function NaoPago({
  oQue,
  mesNatural,
  hoje,
  atraso,
  acertado,
  previsto,
  marcar,
  desmarcar,
  aoSalvar,
}: {
  /** "o pedido" ou "a parcela" — o sujeito das frases. */
  oQue: "o pedido" | "a parcela";
  /** "AAAA-MM" em que a comissão conta sem atraso nenhum. */
  mesNatural: string;
  /** "AAAA-MM" de hoje: o seletor abre nele. */
  hoje: string;
  atraso: { naoPaga: boolean; para: string | null };
  /** Com acerto lançado só dá para tirar o adiamento — marcar, não. */
  acertado: boolean;
  previsto: number;
  marcar: Acao;
  desmarcar: Acao;
  aoSalvar: () => void;
}) {
  const [estado, enviar, salvando] = useActionState(marcar, {});
  const [estadoDesmarcar, enviarDesmarcar, desmarcando] = useActionState(desmarcar, {});

  const marcado = atraso.naoPaga || atraso.para !== null;
  const [quando, setQuando] = useState<Quando>(atraso.para ? "mes" : "sem-previsao");
  const [mes, setMes] = useState(() => mesSugerido(mesNatural, hoje, atraso.para));

  // Fecha ao salvar sem erro — depois da renderização (`ao-salvar.ts`).
  useAoSalvar(estado, aoSalvar);
  useAoSalvar(estadoDesmarcar, aoSalvar);

  const feminino = oQue === "a parcela";
  const doMes = nomeDaCompetencia(mesNatural);
  const opcoes = mesesParaAdiar(mesNatural, hoje);
  const Sujeito = feminino ? "A parcela" : "O pedido";

  const botaoDesmarcar = (
    <Botao
      type="submit"
      formAction={enviarDesmarcar}
      variante="secundaria"
      tamanho="compacto"
      icone={Undo2}
      carregando={desmarcando}
      className="max-sm:w-full max-sm:py-3"
    >
      {atraso.para
        ? `Voltar a comissão para ${nomeCurtoDaCompetencia(mesNatural, hoje)}`
        : "Tirar o “não pago”"}
    </Botao>
  );

  /*
   * Com acerto lançado não se marca: "não pago" com valor recebido é
   * contradição, e mudar de mês um dinheiro já conferido pede desfazer o acerto
   * de propósito. Se o pagamento tinha sido adiado, isso continua dito — e dá
   * para voltar a comissão ao mês dela.
   */
  if (acertado) {
    return (
      <Formulario estado={estadoDesmarcar} action={enviarDesmarcar} className="space-y-3">
        <p className="text-corpo text-tinta-2 leading-relaxed">
          {atraso.para ? (
            <>
              {Sujeito} é de <strong className="text-tinta">{doMes}</strong>, mas a indústria pagou em{" "}
              <strong className="text-tinta">{nomeDaCompetencia(atraso.para)}</strong> — é nesse mês que a
              comissão conta.
            </>
          ) : (
            <>
              {Sujeito} já tem acerto lançado, então a indústria pagou. Para marcar como{" "}
              {feminino ? "não paga" : "não pago"}, apague antes o acerto: toque em “Voltar”, escolha “
              {feminino ? "Recebi esta parcela" : "Recebi"}” e use o botão “Desfazer acerto”.
            </>
          )}
        </p>
        <MensagemErro>{estadoDesmarcar.erro}</MensagemErro>
        {atraso.para && <div>{botaoDesmarcar}</div>}
      </Formulario>
    );
  }

  return (
    <Formulario estado={estado} action={enviar} className="space-y-4">
      <Escolhas
        nome="Quando a indústria vai pagar"
        atual={quando}
        aoEscolher={setQuando}
        opcoes={[
          {
            valor: "sem-previsao",
            icone: CircleHelp,
            titulo: "Ainda não sei quando",
            descricao: `Fica em ${nomeCurtoDaCompetencia(mesNatural, hoje)} como pendente, até a indústria pagar.`,
          },
          {
            valor: "mes",
            icone: CalendarClock,
            titulo: "Já sei o mês",
            descricao: "A comissão passa a contar no mês em que a indústria vai pagar.",
          },
        ]}
      />
      <input type="hidden" name="quando" value={quando} />

      {/* A grade dos meses, como no topo da tela — era um <select> nativo,
          uma lista cinza de treze linhas. O mês do pedido aparece marcado e
          apagado: a comissão já conta nele, adiar é para depois. */}
      {quando === "mes" && (
        <CampoMes
          name="mes"
          rotulo="A indústria vai pagar em"
          defaultValue={mes}
          onChange={setMes}
          hoje={hoje}
          min={opcoes[0]}
          max={opcoes[opcoes.length - 1]}
          marcas={[{ mes: mesNatural, texto: `mês ${feminino ? "da parcela" : "do pedido"}` }]}
          className="sm:max-w-80"
        />
      )}

      {/* O que a escolha faz, antes de salvar — é o que a pessoa precisa saber
          para não ir procurar o pedido no mês errado depois. */}
      <p
        role="note"
        aria-live="polite"
        className="rounded-suave bg-folha px-4 py-3 text-corpo text-tinta-2 leading-relaxed border border-filete"
      >
        {quando === "mes" ? (
          <>
            {Sujeito} continua aparecendo em <strong className="text-tinta">{doMes}</strong>, com o selo
            “Pagamento adiado”, mas a comissão de{" "}
            <span className="numerico">{formatarMoeda(previsto)}</span> sai da soma desse mês e passa a contar
            em <strong className="text-tinta">{nomeDaCompetencia(mes)}</strong>. É lá que você lança o acerto
            quando a indústria pagar.
          </>
        ) : (
          <>
            {Sujeito} continua em <strong className="text-tinta">{doMes}</strong>, com o selo “
            {feminino ? "Não paga" : "Não pago"}”, somando em “A acertar”. Nos meses seguintes{" "}
            {feminino ? "ela" : "ele"} aparece em “Pendentes de meses anteriores”, até você lançar o acerto
            ou escolher o mês.
          </>
        )}
      </p>

      <ErroGeral />
      <MensagemErro>{estadoDesmarcar.erro}</MensagemErro>

      <div className="flex flex-wrap items-center gap-3 max-sm:flex-col max-sm:items-stretch">
        <Botao
          type="submit"
          variante="secundaria"
          carregando={salvando}
          className="max-sm:w-full max-sm:py-3"
        >
          {salvando
            ? "Salvando…"
            : marcado
              ? "Salvar a mudança"
              : feminino
                ? "Marcar como não paga"
                : "Marcar como não pago"}
        </Botao>
        {marcado && botaoDesmarcar}
      </div>
    </Formulario>
  );
}
