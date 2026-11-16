import { formatarMoeda } from "@/components/ui";
import type { ResumoComissao } from "@/lib/comissao";

/**
 * O previsto, o recebido e a diferença da indústria, no alto do cartão dela.
 *
 * Era um número só, o previsto. Para saber qual indústria pagou a menos, era
 * preciso descer até a linha "Total" de cada cartão — ou não saber, no mês de
 * cinco indústrias com o total do topo somando todas juntas.
 *
 * A diferença é a de `resumirComissao`: recebido − previsto, do mês inteiro — a
 * mesma do topo da página, que é a soma destes cartões. Enquanto falta pagar,
 * ela carrega o que falta, e por isso o detalhe embaixo dela a divide em duas
 * partes: o que ainda não foi pago, em cinza, e o que a indústria pagou a mais
 * ou a menos no que já pagou, em cor. O número leva vermelho ou verde pelo
 * sinal, o padrão do app; o detalhe diz quanto dele é só espera.
 *
 * O desenho é o da faixa de totais do topo da página: células coladas, com o
 * fio entre elas. No celular, uma embaixo da outra, com o valor à direita —
 * três cifras lado a lado não cabem num cartão de 360px.
 */
export function ResumoDaIndustria({
  resumo,
  ehAdmin,
  pendentes,
  pagos,
}: {
  resumo: ResumoComissao;
  ehAdmin: boolean;
  /** Pedidos da indústria com alguma parte ainda sem acerto. */
  pendentes: number;
  /** Pedidos da indústria com acerto lançado. */
  pagos: number;
}) {
  const previsto = ehAdmin ? resumo.valor : resumo.previstoDoPreposto;
  const recebido = ehAdmin ? resumo.recebido : resumo.recebidoDoPreposto;
  const diferenca = ehAdmin ? resumo.diferenca : resumo.diferencaDoPreposto;
  const aAcertar = ehAdmin ? resumo.aAcertar : resumo.aAcertarDoPreposto;
  const nosPagos = ehAdmin ? resumo.diferencaNosAcertados : resumo.diferencaNosAcertadosDoPreposto;
  const algumAcerto = resumo.acertados > 0;

  // Vermelho abaixo do previsto, verde acima — como no topo e no resto do app.
  const tomDaDiferenca = diferenca.isZero() ? undefined : diferenca.isNegative() ? "perigo" : "verde";
  const tomDosPagos = nosPagos.isNegative() ? "perigo" : "verde";

  return (
    <dl
      aria-label="Comissão desta indústria"
      // A mesma largura em todos os cartões (até um valor grande pedir mais):
      // as três colunas caem umas embaixo das outras de uma indústria para a
      // seguinte, e a diferença se compara de relance.
      className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-filete border border-filete rounded-suave overflow-hidden
        w-full sm:w-auto sm:min-w-[30rem]"
    >
      <NumeroDaIndustria rotulo="Previsto" valor={formatarMoeda(previsto.toString())}>
        <Detalhe>{ehAdmin ? "comissão do mês" : "sua fatia"}</Detalhe>
      </NumeroDaIndustria>

      <NumeroDaIndustria rotulo="Recebido" valor={algumAcerto ? formatarMoeda(recebido.toString()) : "—"}>
        <Detalhe>
          {pendentes === 0
            ? "tudo pago"
            : pagos === 0
              ? "nada pago ainda"
              : pagos === 1
                ? "1 pedido pago"
                : `${pagos} pedidos pagos`}
        </Detalhe>
      </NumeroDaIndustria>

      <NumeroDaIndustria
        rotulo="Diferença"
        valor={`${diferenca.isPositive() && !diferenca.isZero() ? "+" : ""}${formatarMoeda(diferenca.toString())}`}
        tom={tomDaDiferenca}
      >
        {!aAcertar.isZero() && (
          <Detalhe>{formatarMoeda(aAcertar.toString())} ainda não pagos</Detalhe>
        )}
        {!nosPagos.isZero() && (
          <Detalhe tom={tomDosPagos}>
            pagou {formatarMoeda(nosPagos.abs().toString())} {nosPagos.isNegative() ? "a menos" : "a mais"}
          </Detalhe>
        )}
        {aAcertar.isZero() && nosPagos.isZero() && <Detalhe>pagou o previsto</Detalhe>}
      </NumeroDaIndustria>
    </dl>
  );
}

const CORES = { perigo: "text-perigo", verde: "text-verde" } as const;

function Detalhe({ tom, children }: { tom?: "perigo" | "verde"; children: React.ReactNode }) {
  return <span className={`block text-mini mt-0.5 numerico ${tom ? CORES[tom] : "text-tinta-2"}`}>{children}</span>;
}

function NumeroDaIndustria({
  rotulo,
  valor,
  tom,
  children,
}: {
  rotulo: string;
  valor: string;
  tom?: "perigo" | "verde";
  children: React.ReactNode;
}) {
  return (
    <div className="bg-folha px-3.5 py-2.5 flex items-baseline justify-between gap-3 sm:block">
      <dt className="text-rotulo text-tinta-2">{rotulo}</dt>
      <dd className="text-right sm:text-left sm:mt-1 min-w-0">
        <span className={`block text-realce sm:text-medio font-semibold numerico ${tom ? CORES[tom] : "text-tinta"}`}>
          {valor}
        </span>
        {children}
      </dd>
    </div>
  );
}
