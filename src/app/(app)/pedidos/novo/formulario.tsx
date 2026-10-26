"use client";

import { Handshake } from "lucide-react";
import { useActionState } from "react";

import { SelecaoBuscavel } from "@/components/selecao-buscavel";
import { ErroGeral, Formulario } from "@/components/formulario";
import { Botao, SecaoCartao } from "@/components/ui";

import type { EstadoFormulario } from "../acoes";

export type Opcao = { id: string; rotulo: string; detalhe?: string };

/**
 * A pergunta "para quem e de quem", compartilhada pelo pedido e pelo orçamento.
 *
 * É a mesma pergunta nos dois documentos, com as mesmas consequências — um
 * documento por indústria —, então ela mora num componente só. O que muda é
 * apenas o rótulo do botão.
 */
export function FormularioNovoPedido({
  clientes,
  fornecedores,
  acao,
  rotuloEnvio = "Criar pedido",
  comAmostra = false,
}: {
  clientes: Opcao[];
  fornecedores: Opcao[];
  acao: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  rotuloEnvio?: string;
  /** Só o pedido pergunta se é amostra; a proposta é sempre de venda. */
  comAmostra?: boolean;
}) {
  const [estado, enviar, enviando] = useActionState(acao, {});

  return (
    <Formulario estado={estado} action={enviar} className="space-y-5">

      <SecaoCartao
        icone={Handshake}
        titulo="Para quem e de quem"
        descricao="Vai para uma única indústria — é ela que fatura e é dela a comissão. Se o cliente quer produtos de duas, são dois documentos."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <SelecaoBuscavel
            name="clienteId"
            rotulo="Cliente"
            required
            opcoes={clientes}
            defaultValue={clientes.length === 1 ? clientes[0].id : ""}
            placeholder="Digite para achar…"
          />

          <SelecaoBuscavel
            name="fornecedorId"
            rotulo="Indústria"
            required
            opcoes={fornecedores}
            defaultValue={fornecedores.length === 1 ? fornecedores[0].id : ""}
            dica="O IPI e a comissão dela ficam congelados neste pedido."
          />
        </div>

        {comAmostra && (
          <label className="mt-4 flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              name="amostra"
              defaultChecked={estado.valores?.amostra === "on"}
              className="mt-1 size-4 shrink-0 accent-carimbo cursor-pointer"
            />
            <span className="text-corpo">
              <span className="font-medium text-tinta">Pedido de amostra</span>
              <span className="block text-mini text-tinta-2">
                Produto para o cliente testar, sem custo: o PDF sai sem preço, e o pedido fica fora da
                comissão, das metas e dos gráficos.
              </span>
            </span>
          </label>
        )}
      </SecaoCartao>

      <ErroGeral />

      <div className="flex justify-end">
        <Botao type="submit" carregando={enviando}>
          {enviando ? "Criando…" : rotuloEnvio}
        </Botao>
      </div>
    </Formulario>
  );
}
