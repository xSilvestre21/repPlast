"use client";

import { Handshake } from "lucide-react";
import { useActionState } from "react";

import { Botao, MensagemErro, SecaoCartao, Selecao } from "@/components/ui";

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
}: {
  clientes: Opcao[];
  fornecedores: Opcao[];
  acao: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  rotuloEnvio?: string;
}) {
  const [estado, enviar, enviando] = useActionState(acao, {});

  return (
    <form action={enviar} className="space-y-5">
      <MensagemErro>{estado.erro}</MensagemErro>

      <SecaoCartao
        icone={Handshake}
        titulo="Para quem e de quem"
        descricao="Vai para uma única indústria — é ela que fatura e é dela a comissão. Se o cliente quer produtos de duas, são dois documentos."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Selecao
            name="clienteId"
            rotulo="Cliente"
            required
            defaultValue={clientes.length === 1 ? clientes[0].id : ""}
          >
            <option value="">Escolha…</option>
            {clientes.map((cliente) => (
              <option key={cliente.id} value={cliente.id}>
                {cliente.rotulo}
                {cliente.detalhe ? ` — ${cliente.detalhe}` : ""}
              </option>
            ))}
          </Selecao>

          <Selecao
            name="fornecedorId"
            rotulo="Indústria"
            required
            defaultValue={fornecedores.length === 1 ? fornecedores[0].id : ""}
            dica="O IPI e a comissão dela ficam congelados neste pedido."
          >
            <option value="">Escolha…</option>
            {fornecedores.map((fornecedor) => (
              <option key={fornecedor.id} value={fornecedor.id}>
                {fornecedor.rotulo}
                {fornecedor.detalhe ? ` — ${fornecedor.detalhe}` : ""}
              </option>
            ))}
          </Selecao>
        </div>
      </SecaoCartao>

      <div className="flex justify-end">
        <Botao type="submit" carregando={enviando}>
          {enviando ? "Criando…" : rotuloEnvio}
        </Botao>
      </div>
    </form>
  );
}
