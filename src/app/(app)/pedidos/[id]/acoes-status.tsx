"use client";

import { Ban, Copy, RotateCcw, Send, Trash2, Undo2, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { useFormStatus } from "react-dom";

import { Botao, BotaoTexto, Campo } from "@/components/ui";
import { LIMITE_DO_MOTIVO } from "@/lib/motivo";

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

/**
 * Cancelar, em dois tempos — o clique abre o campo, o segundo botão cancela.
 *
 * Era um `confirm()` do navegador: uma pergunta de sim ou não, e a resposta se
 * perdia. O motivo se sabe JUSTO neste instante, e quem acabou de ouvir "o
 * cliente desistiu" é quem consegue escrever isso — perguntar depois é
 * perguntar quando já esqueceu.
 *
 * O aviso que estava na caixa de diálogo ("estorna a comissão") não se perdeu:
 * virou a dica do campo, onde fica visível enquanto a pessoa decide, em vez de
 * sumir junto com o diálogo.
 *
 * Mesma forma do "Recusou" da proposta (`orcamentos/[id]/ficha.tsx`).
 */
export function CancelarPedido({
  acao,
}: {
  acao: (formData: FormData) => void | Promise<void>;
}) {
  const [escrevendo, setEscrevendo] = useState(false);

  if (!escrevendo) {
    return (
      <Botao
        type="button"
        variante="perigo"
        icone={ICONES.cancelar}
        onClick={() => setEscrevendo(true)}
      >
        Cancelar
      </Botao>
    );
  }

  return (
    /*
      `basis-full` SEM `max-w` junto: a barra de ações é uma fileira que quebra, e
      o flex decide a quebra pelo tamanho hipotético — que o `max-w` limitava a
      576px, tamanho que cabia ENTRE "Duplicar" e "Apagar" e espremia os dois. A
      base cheia sem teto manda a form para uma linha só dela; o teto do campo
      mora na div de dentro.
    */
    <form action={acao} className="basis-full space-y-3">
      <div className="max-w-xl space-y-3">
      <Campo
        name="motivoCancelamento"
        rotulo="Por que o pedido foi cancelado?"
        placeholder="Cliente desistiu, indústria não entregou, erro de lançamento…"
        maxLength={LIMITE_DO_MOTIVO}
        autoFocus
        dica="Opcional. Cancelar estorna a comissão — o pedido some da soma do mês e fica na lista como cancelado."
      />
      <div className="flex flex-wrap items-center gap-3">
        <Submissao
          rotulo="Cancelar o pedido"
          rotuloOcupado="Cancelando…"
          variante="perigo"
          icone="cancelar"
        />
        <BotaoTexto type="button" onClick={() => setEscrevendo(false)}>
          voltar
        </BotaoTexto>
        </div>
      </div>
    </form>
  );
}

/** Escrever o motivo depois, ou corrigir o que foi escrito na hora. */
export function MotivoDoCancelamento({
  motivo,
  acao,
}: {
  motivo: string;
  acao: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <form action={acao} className="w-full max-w-xl space-y-3">
      <Campo
        name="motivoCancelamento"
        rotulo="Por que o pedido foi cancelado?"
        defaultValue={motivo}
        placeholder="Cliente desistiu, indústria não entregou, erro de lançamento…"
        maxLength={LIMITE_DO_MOTIVO}
        dica="Fica visível na lista de pedidos e na apuração do mês."
      />
      <Submissao rotulo="Salvar motivo" rotuloOcupado="Salvando…" variante="secundaria" />
    </form>
  );
}
