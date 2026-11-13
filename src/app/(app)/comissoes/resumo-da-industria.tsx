import { formatarMoeda } from "@/components/ui";
import type { ResumoComissao } from "@/lib/comissao";

/**
 * O previsto, o recebido e a diferença da indústria, no alto do cartão dela.
 *
 * Era um número só, o previsto. Para saber qual indústria pagou a menos, era
 * preciso descer até a linha "Total" de cada cartão — ou não saber, no mês de
 * cinco indústrias com o total do topo somando todas juntas.
 *
 * A diferença é a de `resumirComissao`: o recebido contra o previsto SÓ dos
 * pedidos já acertados. Contra o previsto inteiro, o pedido que ainda não foi
 * acertado apareceria como "pagou a menos". O que falta acertar vai embaixo do
 * recebido, para os dois números não serem lidos como a mesma conta.
 *
 * O desenho é o da faixa de totais do topo da página: células coladas, com o
 * fio entre elas. No celular, uma embaixo da outra, com o valor à direita —
 * três cifras lado a lado não cabem num cartão de 360px.
 */
export function ResumoDaIndustria({
  resumo,
  ehAdmin,
}: {
  resumo: ResumoComissao;
  ehAdmin: boolean;
}) {
  const previsto = ehAdmin ? resumo.valor : resumo.previstoDoPreposto;
  const recebido = ehAdmin ? resumo.recebido : resumo.recebidoDoPreposto;
  const diferenca = ehAdmin ? resumo.diferenca : resumo.diferencaDoPreposto;
  const aAcertar = ehAdmin ? resumo.aAcertar : resumo.aAcertarDoPreposto;
  const algumAcerto = resumo.acertados > 0;

  const tomDaDiferenca =
    !algumAcerto || diferenca.isZero() ? undefined : diferenca.isNegative() ? "perigo" : "verde";

  return (
    <dl
      aria-label="Comissão desta indústria"
      // A mesma largura em todos os cartões (até um valor grande pedir mais):
      // as três colunas caem umas embaixo das outras de uma indústria para a
      // seguinte, e a diferença se compara de relance.
      className="grid grid-cols-1 sm:grid-cols-3 gap-px bg-filete border border-filete rounded-suave overflow-hidden
        w-full sm:w-auto sm:min-w-[30rem]"
    >
      <NumeroDaIndustria
        rotulo="Previsto"
        valor={formatarMoeda(previsto.toString())}
        detalhe={ehAdmin ? "comissão do mês" : "sua fatia"}
      />
      <NumeroDaIndustria
        rotulo="Recebido"
        valor={algumAcerto ? formatarMoeda(recebido.toString()) : "—"}
        detalhe={aAcertar.isZero() ? "tudo acertado" : `falta acertar ${formatarMoeda(aAcertar.toString())}`}
      />
      <NumeroDaIndustria
        rotulo="Diferença"
        valor={
          algumAcerto
            ? `${diferenca.isPositive() && !diferenca.isZero() ? "+" : ""}${formatarMoeda(diferenca.toString())}`
            : "—"
        }
        tom={tomDaDiferenca}
        detalhe={
          !algumAcerto
            ? "nada acertado"
            : diferenca.isZero()
              ? "pagou o previsto"
              : diferenca.isNegative()
                ? "pagou a menos"
                : "pagou a mais"
        }
      />
    </dl>
  );
}

function NumeroDaIndustria({
  rotulo,
  valor,
  detalhe,
  tom,
}: {
  rotulo: string;
  valor: string;
  detalhe: string;
  tom?: "perigo" | "verde";
}) {
  const cor = tom === "perigo" ? "text-perigo" : tom === "verde" ? "text-verde" : "text-tinta";

  return (
    <div className="bg-folha px-3.5 py-2.5 flex items-baseline justify-between gap-3 sm:block">
      <dt className="text-mini text-tinta-3">{rotulo}</dt>
      <dd className="text-right sm:text-left sm:mt-1 min-w-0">
        <span className={`block text-realce sm:text-medio font-semibold numerico ${cor}`}>{valor}</span>
        <span className={`block text-mini mt-0.5 ${tom ? cor : "text-tinta-3"}`}>{detalhe}</span>
      </dd>
    </div>
  );
}
