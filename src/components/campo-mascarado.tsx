"use client";

/**
 * Campos que se pontuam sozinhos enquanto a pessoa digita: documento, telefone,
 * CEP, dinheiro, agência e conta.
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
import {
  mascararAgencia,
  mascararCep,
  mascararConta,
  mascararDocumento,
  mascararDocumentoCobranca,
  mascararMoeda,
  mascararTelefone,
} from "@/lib/mascara";

type PropsCampo = ComponentProps<typeof Campo>;

const EH_DIGITO = /\d/;
/** No CNPJ alfanumérico a letra conta como o dígito: é conteúdo, não pontuação. */
const EH_LETRA_OU_DIGITO = /[0-9a-z]/i;

function contarDigitos(texto: string, conteudo: RegExp): number {
  let total = 0;
  for (const caractere of texto) {
    if (conteudo.test(caractere)) total++;
  }
  return total;
}

/** Posição logo depois do n-ésimo dígito do texto. */
function posicaoAposDigitos(texto: string, quantidade: number, conteudo: RegExp): number {
  if (quantidade === 0) return 0;

  let vistos = 0;
  for (let i = 0; i < texto.length; i++) {
    if (!conteudo.test(texto[i])) continue;

    vistos++;
    if (vistos === quantidade) return i + 1;
  }
  return texto.length;
}

export function CampoMascarado({
  mascara,
  defaultValue,
  onChange,
  onKeyDown,
  cursorNoFim = false,
  conteudo = EH_DIGITO,
  ...props
}: PropsCampo & {
  mascara: (valor: string) => string;
  /**
   * Para a máscara que preenche pela direita (dinheiro). Ela INVENTA dígitos —
   * o "1" vira "0,01" —, e contar dígitos até o cursor o deixaria depois do
   * primeiro zero, com a próxima tecla entrando no meio do número.
   */
  cursorNoFim?: boolean;
  /** O que é conteúdo — o resto é pontuação da máscara. Dígitos, salvo no CNPJ com letras. */
  conteudo?: RegExp;
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
    const digitosAteOCursor = contarDigitos(alvo.value.slice(0, posicao), conteudo);

    const mascarado = mascara(alvo.value);
    // A máscara não mudou nada: o cursor já está onde o navegador o deixou, e
    // recontar dígitos o levaria para longe num texto que não é só número.
    if (mascarado === alvo.value) {
      onChange?.(evento);
      return;
    }
    alvo.value = mascarado;

    const destino = cursorNoFim
      ? alvo.value.length
      : posicaoAposDigitos(alvo.value, digitosAteOCursor, conteudo);
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
    while (posicao > 0 && !conteudo.test(value[posicao - 1])) posicao--;

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
      placeholder="12.345.678/0001-95"
      {...props}
      mascara={mascararDocumento}
    />
  );
}

/**
 * CPF ou CNPJ de quem paga a assinatura — aceita o CNPJ com letras. Só no
 * cadastro do escritório; ver `mascararDocumentoCobranca`.
 */
export function CampoDocumentoCobranca(props: PropsCampo) {
  return (
    <CampoMascarado
      inputMode="text"
      autoCapitalize="characters"
      autoComplete="off"
      spellCheck={false}
      placeholder="123.456.789-09"
      {...props}
      mascara={mascararDocumentoCobranca}
      conteudo={EH_LETRA_OU_DIGITO}
    />
  );
}

export function CampoTelefone(props: PropsCampo) {
  return (
    <CampoMascarado
      inputMode="tel"
      autoComplete="tel"
      placeholder="(11) 3456-7890"
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

/** O X é dígito verificador em alguns bancos: conta como conteúdo, não pontuação. */
const EH_DIGITO_OU_X = /[0-9x]/i;

/**
 * Agência e conta bancária ("1234-5", "56789-0").
 *
 * Teclado de texto, e não o numérico, pelo mesmo motivo do CNPJ com letras: o
 * dígito verificador do Banco do Brasil pode ser X, e o teclado numérico do
 * celular não tem como digitá-lo.
 */
export function CampoAgencia(props: PropsCampo) {
  return (
    <CampoMascarado
      inputMode="text"
      autoCapitalize="characters"
      autoComplete="off"
      spellCheck={false}
      placeholder="1234"
      {...props}
      mascara={mascararAgencia}
      conteudo={EH_DIGITO_OU_X}
    />
  );
}

export function CampoConta(props: PropsCampo) {
  return (
    <CampoMascarado
      inputMode="text"
      autoCapitalize="characters"
      autoComplete="off"
      spellCheck={false}
      placeholder="56789-0"
      {...props}
      mascara={mascararConta}
      conteudo={EH_DIGITO_OU_X}
    />
  );
}

export function CampoCep(props: PropsCampo) {
  return (
    <CampoMascarado
      inputMode="numeric"
      autoComplete="postal-code"
      placeholder="12345-678"
      {...props}
      mascara={mascararCep}
    />
  );
}
