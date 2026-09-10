"use client";

import { Ban, Copy, RotateCcw, Send, Trash2, Undo2, type LucideIcon } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Botao } from "@/components/ui";

type Variante = "primaria" | "secundaria" | "perigo";

/**
 * O ícone é escolhido por NOME, não passado como componente.
 *
 * Este é um componente de cliente, e a página que o usa é de servidor — pela
 * fronteira só passam dados. Uma função de componente não é dado: o React
 * recusa com "Only plain objects can be passed to Client Components". Um nome
 * atravessa, e a tabela abaixo o resolve deste lado.
 */
const ICONES = {
  enviar: Send,
  desfazer: Undo2,
  duplicar: Copy,
  reabrir: RotateCcw,
  cancelar: Ban,
  apagar: Trash2,
} satisfies Record<string, LucideIcon>;

export type NomeDeIcone = keyof typeof ICONES;

function Submissao({
  rotulo,
  rotuloOcupado,
  variante,
  icone,
}: {
  rotulo: string;
  rotuloOcupado: string;
  variante: Variante;
  icone?: NomeDeIcone;
}) {
  const { pending } = useFormStatus();

  return (
    <Botao
      type="submit"
      variante={variante}
      icone={icone ? ICONES[icone] : undefined}
      carregando={pending}
    >
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
  icone,
  acao,
}: {
  rotulo: string;
  rotuloOcupado: string;
  variante?: Variante;
  confirmacao?: string;
  icone?: NomeDeIcone;
  acao: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form
      action={acao}
      onSubmit={(evento) => {
        if (confirmacao && !confirm(confirmacao)) evento.preventDefault();
      }}
    >
      <Submissao
        rotulo={rotulo}
        rotuloOcupado={rotuloOcupado}
        variante={variante}
        icone={icone}
      />
    </form>
  );
}
