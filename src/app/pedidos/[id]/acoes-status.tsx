"use client";

import { useFormStatus } from "react-dom";

import { Botao } from "@/components/ui";

type Variante = "primaria" | "secundaria" | "perigo";

function Submissao({
  rotulo,
  rotuloOcupado,
  variante,
}: {
  rotulo: string;
  rotuloOcupado: string;
  variante: Variante;
}) {
  const { pending } = useFormStatus();

  return (
    <Botao type="submit" variante={variante} disabled={pending}>
      {pending ? rotuloOcupado : rotulo}
    </Botao>
  );
}

/**
 * Botão de ação de status.
 *
 * `confirmacao` existe para as ações que o usuário não deveria disparar sem
 * pensar: enviar dispara a comissão, cancelar a estorna, excluir apaga.
 */
export function AcaoPedido({
  rotulo,
  rotuloOcupado,
  variante = "secundaria",
  confirmacao,
  acao,
}: {
  rotulo: string;
  rotuloOcupado: string;
  variante?: Variante;
  confirmacao?: string;
  acao: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form
      action={acao}
      onSubmit={(evento) => {
        if (confirmacao && !confirm(confirmacao)) evento.preventDefault();
      }}
    >
      <Submissao rotulo={rotulo} rotuloOcupado={rotuloOcupado} variante={variante} />
    </form>
  );
}
