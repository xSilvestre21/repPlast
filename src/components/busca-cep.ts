"use client";

/**
 * A busca do endereço pelo CEP enquanto a pessoa digita — o miolo comum do
 * cadastro do escritório (`entrada/endereco-cobranca.tsx`) e das fichas de
 * cliente e fornecedor (`endereco-pelo-cep.tsx`).
 *
 * Só busca com os 8 dígitos, uma vez por CEP, e descarta a resposta que chega
 * depois de a pessoa já ter mudado o CEP. O que fazer com o endereço achado é
 * de quem chama (`aoAchar`): cada formulário tem os seus campos.
 */

import { useRef, useState, type ChangeEvent } from "react";

import { consultarCep, type EnderecoDoCep } from "@/lib/cep";
import { somenteDigitos } from "@/lib/mascara";

export type BuscaCep =
  | { tipo: "ocioso" }
  | { tipo: "buscando" }
  | { tipo: "achou"; cidade: string; uf: string; geral: boolean }
  | { tipo: "inexistente" }
  | { tipo: "indisponivel" };

export function useBuscaCep(aoAchar: (endereco: EnderecoDoCep) => void) {
  const [busca, setBusca] = useState<BuscaCep>({ tipo: "ocioso" });
  const ultimoCep = useRef("");

  async function aoDigitarCep(evento: ChangeEvent<HTMLInputElement>) {
    const cep = somenteDigitos(evento.currentTarget.value);
    if (cep.length !== 8) {
      ultimoCep.current = "";
      setBusca({ tipo: "ocioso" });
      return;
    }
    if (cep === ultimoCep.current) return;
    ultimoCep.current = cep;

    setBusca({ tipo: "buscando" });
    const resultado = await consultarCep(cep);
    // A pessoa já mudou o CEP enquanto a resposta vinha: esta não vale mais.
    if (ultimoCep.current !== cep) return;

    if (resultado === "inexistente") return setBusca({ tipo: "inexistente" });
    if (resultado === null) return setBusca({ tipo: "indisponivel" });

    setBusca({ tipo: "achou", cidade: resultado.cidade, uf: resultado.uf, geral: !resultado.logradouro });
    aoAchar(resultado);
  }

  return { busca, aoDigitarCep };
}

/** "São Paulo/SP" depois de achar; vazio antes. */
export function lugarDoCep(busca: BuscaCep): string {
  return busca.tipo === "achou" ? `${busca.cidade}/${busca.uf}` : "";
}

/** A dica embaixo do CEP: buscando, ou a cidade achada. */
export function dicaDoCep(busca: BuscaCep): string | undefined {
  if (busca.tipo === "buscando") return "Buscando o endereço…";
  if (busca.tipo === "achou") return lugarDoCep(busca);
  return undefined;
}

export function erroDoCep(busca: BuscaCep): string | undefined {
  return busca.tipo === "inexistente"
    ? "Não achamos este CEP. Confira os números, como 12345-678."
    : undefined;
}
