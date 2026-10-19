"use client";

/**
 * Excluir um registro, com a pergunta antes (`usePerguntaAntes`).
 *
 * Existia três vezes — clientes, produtos e indústrias —, com trinta e quatro
 * linhas idênticas em cada e diferindo só no rótulo do botão. A terceira cópia
 * ainda tinha ganhado uma frase de aviso que as outras duas não tinham, que é
 * exatamente como uma cópia vira três comportamentos diferentes sem ninguém
 * decidir isso.
 *
 * A exclusão pode ser recusada ("tem pedidos", "já virou pedido"), e o motivo
 * aparece logo embaixo do botão — ver `AcaoComRecusa`.
 *
 * `useFormStatus` precisa estar DENTRO do `<form>`, e é por isso que a submissão
 * é um componente à parte em vez de uma linha aqui.
 */

import { useFormStatus } from "react-dom";

import { AcaoComRecusa } from "@/components/acao-com-recusa";
import { Botao } from "@/components/ui";
import type { EstadoFormulario } from "@/lib/erro-formulario";

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
  impedimento,
  acao,
}: {
  /** O que o botão diz: "Excluir cliente", "Excluir indústria". */
  rotulo: string;
  /** Aparece entre aspas na pergunta, para a pessoa conferir que é este mesmo. */
  nome: string;
  /** O que mais vai junto. Só onde a exclusão leva outra coisa embora. */
  aviso?: string;
  /** Por que não dá para excluir — a janela diz isso em vez de perguntar. */
  impedimento?: string | null;
  acao: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
}) {
  // "Excluir cliente" pergunta "Excluir…?"; "Apagar" pergunta "Apagar…?".
  const verbo = rotulo.split(" ")[0];

  return (
    <AcaoComRecusa
      acao={acao}
      confirmar={{
        titulo: `${verbo} “${nome}”?`,
        texto: aviso ? `${aviso} Esta ação não pode ser desfeita.` : undefined,
        rotulo: verbo,
        impedimento,
      }}
    >
      <Submissao rotulo={rotulo} />
    </AcaoComRecusa>
  );
}
