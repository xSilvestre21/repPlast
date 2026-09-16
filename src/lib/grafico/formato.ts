/**
 * Como cada unidade vira texto.
 *
 * Existe porque **função não atravessa a fronteira servidor→cliente**: uma prop
 * `formatar: (valor) => string` vinda de uma página de servidor quebra numa
 * ilha de cliente com "Only plain objects...". Então o que viaja é o NOME da
 * unidade, e ela é resolvida do lado de cá — o mesmo contorno que o projeto já
 * usa para ícone.
 *
 * E mora fora de `ui.tsx` de propósito. Aquele arquivo não é `"use client"` e é
 * importado por página de servidor; uma ilha que buscasse `formatarMoeda` lá
 * arrastaria a biblioteca inteira para o bundle do navegador — é a regra
 * documentada em `campo-mascarado.tsx`.
 */

const MOEDA = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export const FORMATO = {
  moeda: (valor: number) => MOEDA.format(valor),
  dias: (valor: number) => `${valor} dias`,
  numero: (valor: number) => valor.toLocaleString("pt-BR"),
} as const;

export type Unidade = keyof typeof FORMATO;
