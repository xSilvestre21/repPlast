import { IBM_Plex_Mono, Plus_Jakarta_Sans } from "next/font/google";

/*
 * Duas vozes, e cada uma tem um trabalho.
 *
 * Plus Jakarta Sans conduz tudo: interface, títulos e NÚMEROS. É uma
 * geométrica de terminações retas e caixa alta estreita, que é o que permite
 * levar um valor a 4rem com tracking negativo sem ele virar um borrão — e é
 * justamente aí, no número grande, que a tela ganha a cara de produto.
 *
 * IBM Plex Mono cuida do que é código: medida (99x166x0,08), COD.FORN,
 * descrição gerada. São dados que a indústria confere caractere a caractere, e
 * numa proporcional o 1 e o l se confundem.
 *
 * O peso 800 existe só para o número da comissão. Abaixo dele nada passa de
 * 600, senão a tela inteira grita junto e o valor deixa de ser o mais alto.
 *
 * Num arquivo só porque dois documentos as usam: o layout raiz e o
 * `global-error.tsx`, que o substitui — chamar a fonte duas vezes as
 * hospedaria duas vezes.
 */
const sans = Plus_Jakarta_Sans({
  variable: "--fonte-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const mono = IBM_Plex_Mono({
  variable: "--fonte-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
});

/** As variáveis das duas fontes, para o `<html>` — o `globals.css` lê delas. */
export const classesDasFontes = `${sans.variable} ${mono.variable}`;
