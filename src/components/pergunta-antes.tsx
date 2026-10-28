"use client";

/**
 * "Tem certeza?" antes de uma ação que não volta atrás.
 *
 * Era o `confirm()` do navegador: uma caixa cinza, com o endereço do site no
 * título e "OK" no lugar do nome da ação — e que alguns navegadores deixam
 * desligar com "não mostrar mais", depois do que o clique em Excluir apagava
 * sem perguntar nada. Agora é a mesma janela do resto do sistema, com o botão
 * dizendo o que vai acontecer ("Excluir", "Remover") e o Enter distraído sem
 * apagar nada: no teclado o foco vem no Cancelar; no toque, fica na caixa
 * (`modal.ts`), sem o anel de Tab aceso num botão que ninguém escolheu.
 *
 * Funciona por cima do formulário que já existe: o envio é segurado, a janela
 * abre e, confirmado, o MESMO envio é refeito com `requestSubmit` — o botão que
 * foi clicado, os campos escondidos e a ação do React seguem iguais. Por isso
 * dá para pôr a pergunta em qualquer botão de excluir sem mexer na ação dele.
 */

import { type FormEvent, type MouseEvent, type ReactNode, useRef, useState } from "react";

import { Dialogo } from "@/components/dialogo";
import { Botao } from "@/components/ui";

export type Pergunta = {
  /** "Excluir “SIGMA PACK”?" — com o nome, para a pessoa conferir que é este. */
  titulo: string;
  /** O que mais acontece. Sem ele, avisa que não dá para desfazer. */
  texto?: string;
  /** O botão que confirma: "Excluir", "Remover", "Apagar". */
  rotulo: string;
  /** Falso para a confirmação que não apaga nada (marcar como enviado). */
  perigo?: boolean;
  /**
   * Por que a ação não pode acontecer ("tem 12 produtos"). Com ele, a janela
   * não oferece o botão: diz o motivo e o caminho, e só fecha. É melhor do que
   * perguntar "tem certeza?" e recusar depois do sim.
   */
  impedimento?: string | null;
};

const SEM_VOLTA = "Esta ação não pode ser desfeita.";

/**
 * A pergunta e a janela dela. `aoEnviar` vai no `onSubmit` do formulário;
 * `aoClicar`, no botão que envia por `formAction` dentro de um formulário que
 * também tem outro envio (só esse botão pergunta). Sem `pergunta`, os dois
 * deixam passar.
 */
export function usePerguntaAntes(pergunta: Pergunta | undefined, aoConfirmar?: () => void) {
  const [aberta, setAberta] = useState(false);
  const liberado = useRef(false);
  const segurado = useRef<{ formulario: HTMLFormElement; botao: HTMLElement | null } | null>(null);

  function aoEnviar(evento: FormEvent<HTMLFormElement>) {
    if (!pergunta || liberado.current) return;
    evento.preventDefault();
    segurado.current = {
      formulario: evento.currentTarget,
      botao: (evento.nativeEvent as SubmitEvent).submitter,
    };
    setAberta(true);
  }

  function aoClicar(evento: MouseEvent<HTMLButtonElement>) {
    const formulario = evento.currentTarget.form;
    if (!pergunta || !formulario) return;
    evento.preventDefault();
    segurado.current = { formulario, botao: evento.currentTarget };
    setAberta(true);
  }

  function confirmar() {
    setAberta(false);
    const envio = segurado.current;
    segurado.current = null;
    if (!envio) return;

    aoConfirmar?.();
    // O `submit` que o `requestSubmit` dispara é síncrono: o `onSubmit` acima
    // o vê liberado, deixa passar, e a trava volta logo em seguida.
    liberado.current = true;
    try {
      envio.formulario.requestSubmit(envio.botao instanceof HTMLButtonElement ? envio.botao : undefined);
    } finally {
      liberado.current = false;
    }
  }

  const janela: ReactNode = !pergunta ? null : pergunta.impedimento ? (
    <Dialogo
      aberto={aberta}
      aoFechar={() => setAberta(false)}
      // "Excluir “GAMAPACK”?" vira "Não é possível excluir “GAMAPACK”".
      titulo={`Não é possível ${pergunta.titulo.charAt(0).toLowerCase()}${pergunta.titulo.slice(1).replace(/\?$/, "")}`}
      estreito
    >
      <p className="text-corpo text-tinta-2 leading-relaxed whitespace-pre-line">
        {pergunta.impedimento}
      </p>
      <div className="mt-6 flex justify-end">
        <Botao type="button" variante="secundaria" onClick={() => setAberta(false)} data-autofocus>
          Entendi
        </Botao>
      </div>
    </Dialogo>
  ) : (
    <Dialogo aberto={aberta} aoFechar={() => setAberta(false)} titulo={pergunta.titulo} estreito>
      <p className="text-corpo text-tinta-2 leading-relaxed whitespace-pre-line">
        {pergunta.texto ?? SEM_VOLTA}
      </p>
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Botao type="button" variante="secundaria" onClick={() => setAberta(false)} data-autofocus>
          Cancelar
        </Botao>
        <Botao
          type="button"
          variante={pergunta.perigo === false ? "primaria" : "perigo"}
          onClick={confirmar}
        >
          {pergunta.rotulo}
        </Botao>
      </div>
    </Dialogo>
  );

  return { aoEnviar, aoClicar, janela };
}
