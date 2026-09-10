"use client";

import { useActionState } from "react";

import { ClipboardList, MessageSquareText, Percent } from "lucide-react";

import { AreaTexto, Botao, Campo, MensagemErro, SecaoCartao, Selecao } from "@/components/ui";

import type { EstadoFormulario } from "../acoes";

export type ValoresCabecalho = {
  pedidoDoCliente: string;
  prazoPagamento: string;
  prazoEntrega: string;
  tipoFrete: string;
  transportadora: string;
  vendedor: string;
  observacoes: string;
  comIpi: boolean;
  ipiPercentual: string;
  comissaoPercentual: string;
};

export function SecaoCabecalho({
  valores,
  editavel,
  acao,
}: {
  valores: ValoresCabecalho;
  editavel: boolean;
  acao: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
}) {
  const [estado, enviar, enviando] = useActionState(acao, {});

  return (
    <form action={enviar} className="space-y-5">
      <MensagemErro>{estado.erro}</MensagemErro>

      <SecaoCartao
        icone={ClipboardList}
        titulo="Condições"
        descricao="Tudo daqui sai impresso no cabeçalho do pedido, menos a comissão."
      >
        <fieldset disabled={!editavel} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Campo
            name="pedidoDoCliente"
            rotulo="Pedido do cliente"
            dica="O número da ordem de compra dele."
            defaultValue={valores.pedidoDoCliente}
          />
          <Campo
            name="prazoPagamento"
            rotulo="Prazo de pagamento"
            placeholder="28/35/42"
            defaultValue={valores.prazoPagamento}
          />
          <Campo
            name="prazoEntrega"
            rotulo="Prazo de entrega"
            type="date"
            defaultValue={valores.prazoEntrega}
          />

          <Selecao name="tipoFrete" rotulo="Frete" defaultValue={valores.tipoFrete}>
            <option value="">Não informar</option>
            <option value="CIF">CIF — a indústria paga</option>
            <option value="FOB">FOB — o cliente paga</option>
          </Selecao>
          <Campo
            name="transportadora"
            rotulo="Transportadora"
            defaultValue={valores.transportadora}
          />
          <Campo
            name="vendedor"
            rotulo="Vendedor"
            dica="Assina o rodapé do PDF."
            defaultValue={valores.vendedor}
          />
        </fieldset>
      </SecaoCartao>

      <SecaoCartao icone={Percent} titulo="Impostos e comissão">
        <fieldset disabled={!editavel} className="grid gap-4 sm:grid-cols-3 items-start">
          <label className="flex items-center gap-2 text-sm sm:pt-8">
            <input
              type="checkbox"
              name="comIpi"
              defaultChecked={valores.comIpi}
              className="accent-acento"
            />
            Cobrar IPI neste pedido
          </label>

          <Campo
            name="ipiPercentual"
            rotulo="IPI"
            sufixo="%"
            inputMode="decimal"
            dica="Veio da indústria e ficou congelado aqui."
            defaultValue={valores.ipiPercentual}
          />

          <Campo
            name="comissaoPercentual"
            rotulo="Comissão"
            sufixo="%"
            inputMode="decimal"
            dica="Não sai no PDF. Vazio usa o percentual da indústria."
            defaultValue={valores.comissaoPercentual}
          />
        </fieldset>
      </SecaoCartao>

      <SecaoCartao
        icone={MessageSquareText}
        titulo="Observações"
        descricao="Recados para a indústria. Vêm preenchidos com as observações do cliente."
      >
        <AreaTexto
          name="observacoes"
          rows={5}
          disabled={!editavel}
          defaultValue={valores.observacoes}
        />
      </SecaoCartao>

      {editavel && (
        <div className="flex justify-end">
          <Botao type="submit" carregando={enviando}>
            {enviando ? "Salvando…" : "Salvar condições"}
          </Botao>
        </div>
      )}
    </form>
  );
}
