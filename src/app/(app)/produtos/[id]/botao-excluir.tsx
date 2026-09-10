"use client";

import { useFormStatus } from "react-dom";

import { Botao } from "@/components/ui";

function Submissao() {
  const { pending } = useFormStatus();

  return (
    <Botao type="submit" variante="perigo" disabled={pending}>
      {pending ? "Excluindo…" : "Excluir produto"}
    </Botao>
  );
}

export function BotaoExcluirProduto({
  descricao,
  acao,
}: {
  descricao: string;
  acao: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form
      action={acao}
      onSubmit={(evento) => {
        if (!confirm(`Excluir "${descricao}"?`)) evento.preventDefault();
      }}
    >
      <Submissao />
    </form>
  );
}
