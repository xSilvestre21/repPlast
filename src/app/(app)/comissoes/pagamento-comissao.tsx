"use client";

/**
 * "A indústria paga a comissão: no mês do vencimento / no mês seguinte ao
 * faturamento, até o dia __" — a mesma escolha no acerto do pedido inteiro e
 * no editor de parcelas.
 *
 * Há indústria que fatura até um dia do mês e só paga a comissão no mês
 * seguinte. O pedido nasce com o dia dela (`Fornecedor.diaFechamentoComissao`)
 * e a exceção se troca aqui. A conta é `mesDoRecebimento`, a mesma que o
 * servidor faz ao somar o mês.
 */

import { useState } from "react";

import { Campo, Rotulo, Segmentado } from "@/components/ui";

type Pagamento = "vencimento" | "seguinte";

/** "30" → 30; o que não for um dia de 1 a 31 ainda não muda mês nenhum. */
function diaValido(texto: string): number | null {
  const dia = Number(texto);
  return /^\d{1,2}$/.test(texto.trim()) && dia >= 1 && dia <= 31 ? dia : null;
}

/**
 * O estado da escolha e os campos dela, para pôr dentro do formulário que
 * grava (`pagamento` e `diaFechamentoComissao` vão no envio). `fechaNoDia` é o
 * dia valendo agora, ou `null` no mês do vencimento — é por ele que a tela
 * mostra, enquanto se escolhe, em que mês a comissão entra.
 */
export function usePagamentoComissao(inicial: string) {
  const [pagamento, setPagamento] = useState<Pagamento>(inicial ? "seguinte" : "vencimento");
  const [dia, setDia] = useState(inicial || "30");
  const fechaNoDia = pagamento === "seguinte" ? diaValido(dia) : null;

  const campos = (
    <div className="flex flex-wrap items-start gap-3">
      <div>
        <Rotulo>A indústria paga a comissão</Rotulo>
        <div className="flex items-center h-11">
          <Segmentado
            nome="Quando a indústria paga a comissão"
            atual={pagamento}
            aoEscolher={setPagamento}
            opcoes={[
              { valor: "vencimento", rotulo: "no mês do vencimento" },
              { valor: "seguinte", rotulo: "no mês seguinte ao faturamento" },
            ]}
          />
        </div>
        <input type="hidden" name="pagamento" value={pagamento} />
      </div>
      {pagamento === "seguinte" && (
        <Campo
          name="diaFechamentoComissao"
          rotulo="Fatura até o dia"
          value={dia}
          onChange={(e) => setDia(e.currentTarget.value)}
          inputMode="numeric"
          autoComplete="off"
          placeholder="30"
          className="w-36"
        />
      )}
    </div>
  );

  return { fechaNoDia, campos };
}
