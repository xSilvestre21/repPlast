"use client";

import { useFormStatus } from "react-dom";

import { Botao } from "@/components/ui";

function Submissao() {
  const { pending } = useFormStatus();

  return (
    <Botao type="submit" variante="perigo" disabled={pending}>
      {pending ? "Excluindo…" : "Excluir indústria"}
    </Botao>
  );
}

export function BotaoExcluir({
  nome,
  acao,
}: {
  nome: string;
  acao: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form
      action={acao}
      onSubmit={(evento) => {
        // Exclusão de fornecedor derruba faixas e aditivos junto; vale confirmar.
        if (!confirm(`Excluir "${nome}"? As faixas e os aditivos serão removidos junto.`)) {
          evento.preventDefault();
        }
      }}
    >
      <Submissao />
    </form>
  );
}
