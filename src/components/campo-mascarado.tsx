"use client";

/**
 * Campos que se pontuam sozinhos enquanto a pessoa digita: documento, telefone,
 * CEP e dinheiro.
 *
 * Mora fora de `ui.tsx` porque aquele arquivo NÃO é `"use client"` — ele é
 * importado tanto por página de servidor quanto por formulário de cliente, e
 * um `"use client"` lá em cima arrastaria a biblioteca inteira para o bundle do
 * navegador. Aqui o estado de digitação é inevitável, então o limite fica neste
 * arquivo.
 *
 * O campo continua NÃO CONTROLADO, como os outros do formulário: a máscara é
 * escrita direto no nó do DOM. Isso mantém `defaultValue` funcionando e, mais
 * importante, mantém o envio sem JavaScript inteiro — a máscara é um conforto
 * de digitação, e quem garante o formato gravado é `normalizarDocumento` /
 * `normalizarTelefone` no servidor.
 */

import type { ChangeEvent, ComponentProps, KeyboardEvent } from "react";

import { Campo } from "@/components/ui";
import { mascararCep, mascararDocumento, mascararMoeda, mascararTelefone } from "@/lib/mascara";

type PropsCampo = ComponentProps<typeof Campo>;

const EH_DIGITO = /\d/;

function contarDigitos(texto: string): number {
  let total = 0;
  for (const caractere of texto) {
    if (EH_DIGITO.test(caractere)) total++;
  }
  return total;
}

/** Posição logo depois do n-ésimo dígito do texto. */
function posicaoAposDigitos(texto: string, quantidade: number): number {
  if (quantidade === 0) return 0;

  let vistos = 0;
  for (let i = 0; i < texto.length; i++) {
    if (!EH_DIGITO.test(texto[i])) continue;

    vistos++;
    if (vistos === quantidade) return i + 1;
  }
  return texto.length;
}

function CampoMascarado({
  mascara,
  defaultValue,
  onChange,
  onKeyDown,
  cursorNoFim = false,
  ...props
}: PropsCampo & {
  mascara: (valor: string) => string;
  /**
   * Para a máscara que preenche pela direita (dinheiro). Ela INVENTA dígitos —
   * o "1" vira "0,01" —, e contar dígitos até o cursor o deixaria depois do
   * primeiro zero, com a próxima tecla entrando no meio do número.
   */
  cursorNoFim?: boolean;
}) {
  /**
   * Remonta a máscara e recoloca o cursor.
   *
   * O cursor é guardado em DÍGITOS, não em posição de caractere. Reescrever o
   * texto muda onde a pontuação cai, e uma posição bruta jogaria o cursor para
   * o fim a cada tecla — o defeito clássico de campo com máscara, que impede
   * corrigir um número no meio.
   */
  function aoDigitar(evento: ChangeEvent<HTMLInputElement>) {
    const alvo = evento.currentTarget;
    const posicao = alvo.selectionStart ?? alvo.value.length;
    const digitosAteOCursor = contarDigitos(alvo.value.slice(0, posicao));

    alvo.value = mascara(alvo.value);

    const destino = cursorNoFim
      ? alvo.value.length
      : posicaoAposDigitos(alvo.value, digitosAteOCursor);
    alvo.setSelectionRange(destino, destino);

    onChange?.(evento);
  }

  /**
   * Apagar por cima da pontuação.
   *
   * Sem isto, o backspace em cima do "-" apagaria só o traço — que a máscara
   * repõe em seguida, e a tecla pareceria não fazer nada. Recuar o cursor até o
   * dígito anterior antes de deixar o navegador apagar faz a tecla apagar o que
   * a pessoa está vendo.
   */
  function aoTeclar(evento: KeyboardEvent<HTMLInputElement>) {
    onKeyDown?.(evento);
    if (evento.defaultPrevented) return;

    const alvo = evento.currentTarget;
    const { selectionStart, selectionEnd, value } = alvo;

    // Com trecho selecionado quem manda é a seleção, não o cursor.
    if (selectionStart === null || selectionStart !== selectionEnd) return;

    /*
     * No dinheiro, digitar e apagar agem sempre no fim — é onde os centavos
     * entram e saem. Um dígito posto no meio de "1.234,56" não tem leitura
     * que a pessoa espere. Setas e atalhos seguem livres.
     */
    const editaTexto =
      evento.key === "Backspace" ||
      evento.key === "Delete" ||
      (evento.key.length === 1 && !evento.ctrlKey && !evento.metaKey);
    if (cursorNoFim && editaTexto) {
      alvo.setSelectionRange(value.length, value.length);
      return;
    }

    if (evento.key !== "Backspace") return;

    let posicao = selectionStart;
    while (posicao > 0 && !EH_DIGITO.test(value[posicao - 1])) posicao--;

    if (posicao !== selectionStart) alvo.setSelectionRange(posicao, posicao);
  }

  return (
    <Campo
      {...props}
      /*
       * O valor que vem do banco também passa pela máscara: cadastro antigo,
       * gravado antes dela existir, aparece pontuado do mesmo jeito.
       */
      defaultValue={typeof defaultValue === "string" ? mascara(defaultValue) : defaultValue}
      onChange={aoDigitar}
      onKeyDown={aoTeclar}
    />
  );
}

/** CNPJ ou CPF — a forma troca sozinha conforme a quantidade de dígitos. */
export function CampoDocumento(props: PropsCampo) {
  return (
    <CampoMascarado
      inputMode="numeric"
      autoComplete="off"
      placeholder="09.507.378/0001-50"
      {...props}
      mascara={mascararDocumento}
    />
  );
}

export function CampoTelefone(props: PropsCampo) {
  return (
    <CampoMascarado
      inputMode="tel"
      autoComplete="tel"
      placeholder="(17) 3321-5900"
      {...props}
      mascara={mascararTelefone}
    />
  );
}

/**
 * Dinheiro, com os dígitos entrando como centavos ("5.000,00").
 *
 * O `defaultValue` precisa chegar com as duas casas — ver `mascararMoeda`.
 * `numeric`, e não `decimal`: a vírgula nunca é digitada, então o teclado do
 * celular só precisa dos números.
 */
export function CampoMoeda(props: PropsCampo) {
  return (
    <CampoMascarado
      inputMode="numeric"
      autoComplete="off"
      sufixo="R$"
      placeholder="0,00"
      {...props}
      mascara={mascararMoeda}
      cursorNoFim
    />
  );
}

export function CampoCep(props: PropsCampo) {
  return (
    <CampoMascarado
      inputMode="numeric"
      autoComplete="postal-code"
      placeholder="14781-160"
      {...props}
      mascara={mascararCep}
    />
  );
}
