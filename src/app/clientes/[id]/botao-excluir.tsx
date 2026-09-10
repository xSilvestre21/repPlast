"use client";

import { useFormStatus } from "react-dom";

import { Botao } from "@/components/ui";

function Submissao() {
  const { pending } = useFormStatus();

  return (
    <Botao type="submit" variante="perigo" disabled={pending}>
      {pending ? "Excluindo…" : "Excluir cliente"}
    </Botao>
  );
}

export function BotaoExcluirCliente({
  apelido,
  acao,
}: {
  apelido: string;
  acao: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form
      action={acao}
      onSubmit={(evento) => {
        if (!confirm(`Excluir "${apelido}"?`)) evento.preventDefault();
      }}
    >
      <Submissao />
    </form>
  );
}
