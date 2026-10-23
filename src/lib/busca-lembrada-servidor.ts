import "server-only";

import { cookies } from "next/headers";

import { nomeDoCookie, type SecaoComBusca } from "./busca-lembrada";

type Parametros = Record<string, string | string[] | undefined>;

/**
 * Os parâmetros com que a lista abre: os da URL, ou — sem nenhum na URL — os
 * que a lista lembrou desta seção (`busca-lembrada.ts`).
 *
 * A URL manda sempre que traz alguma coisa: um link com filtro explícito (o
 * Painel abrindo os pedidos de um status) não pode ser trocado pela busca de
 * antes. O cookie é texto que o navegador manda e qualquer um edita: aqui só
 * vira parâmetro, e quem o lê é o mesmo `…DoParametro` de cada lista, que já
 * descarta o que não reconhece.
 */
export async function parametrosDaLista(secao: SecaoComBusca, daUrl: Parametros): Promise<Parametros> {
  if (Object.keys(daUrl).length > 0) return daUrl;

  const lembrada = (await cookies()).get(nomeDoCookie(secao))?.value;
  if (!lembrada) return daUrl;

  // O Next já devolve o valor decodificado: é a query como a lista a escreveu.
  return Object.fromEntries(new URLSearchParams(lembrada));
}
