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

/* Os cartões interativos recebem dinheiro em CENTAVOS (`lib/grafico/base.ts`). */

/** "R$ 1.234,56" a partir de centavos. */
export const moedaDe = (centavos: number) => MOEDA.format(centavos / 100);

const COMPACTO = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  notation: "compact",
  maximumFractionDigits: 1,
});

/** "R$ 12,3 mil" — para eixo, onde "R$ 12.345,67" não cabe. */
export const moedaCompactaDe = (centavos: number) => COMPACTO.format(centavos / 100);

const PORCENTO = new Intl.NumberFormat("pt-BR", { style: "percent", maximumFractionDigits: 1 });

/** "42,5%" a partir de uma razão (0,425). */
export const porcento = (razao: number) => PORCENTO.format(razao);

/**
 * O tooltip do ECharts é HTML: nome de cliente ou de indústria vai escapado.
 * Um apelido com "<" quebraria o balão — e é dado digitado por gente.
 */
export const escapar = (texto: string) =>
  texto.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
