"use client";

/**
 * Excluir um registro, com a pergunta antes.
 *
 * Existia três vezes — clientes, produtos e indústrias —, com trinta e quatro
 * linhas idênticas em cada e diferindo só no rótulo do botão. A terceira cópia
 * ainda tinha ganhado uma frase de aviso que as outras duas não tinham, que é
 * exatamente como uma cópia vira três comportamentos diferentes sem ninguém
 * decidir isso.
 *
 * `useFormStatus` precisa estar DENTRO do `<form>`, e é por isso que a submissão
 * é um componente à parte em vez de uma linha aqui.
 */

import { useFormStatus } from "react-dom";

import { Botao } from "@/components/ui";

function Submissao({ rotulo }: { rotulo: string }) {
  const { pending } = useFormStatus();

  return (
    <Botao type="submit" variante="perigo" disabled={pending}>
      {pending ? "Excluindo…" : rotulo}
    </Botao>
  );
}

export function BotaoExcluir({
  rotulo,
  nome,
  aviso,
  acao,
}: {
  /** O que o botão diz: "Excluir cliente", "Excluir indústria". */
  rotulo: string;
  /** Aparece entre aspas na pergunta, para a pessoa conferir que é este mesmo. */
  nome: string;
  /** O que mais vai junto. Só onde a exclusão leva outra coisa embora. */
  aviso?: string;
  acao: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form
      action={acao}
      onSubmit={(evento) => {
        const pergunta = aviso ? `Excluir "${nome}"? ${aviso}` : `Excluir "${nome}"?`;
        if (!confirm(pergunta)) evento.preventDefault();
      }}
    >
      <Submissao rotulo={rotulo} />
    </form>
  );
}
