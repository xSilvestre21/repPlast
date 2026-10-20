"use client";

import { useRef, useState, type ChangeEvent, type ReactNode } from "react";

import { CampoCep } from "@/components/campo-mascarado";
import { Campo } from "@/components/ui";
import { consultarCep } from "@/lib/cep";
import { somenteDigitos } from "@/lib/mascara";

/**
 * CEP, endereço, número, bairro e complemento de quem paga a assinatura.
 *
 * Com o CEP completo, rua e bairro se preenchem sozinhos (ViaCEP) e o cursor
 * pula para o número — a única parte que o CEP não sabe. O bairro é campo
 * próprio porque o checkout do Asaas o pede separado (`province`). Os campos
 * continuam editáveis: o CEP geral de cidade pequena não traz rua nem bairro,
 * e o ViaCEP fora do ar não pode travar o cadastro (a frase manda digitar à mão).
 *
 * Os campos continuam não controlados, como o resto do formulário: o que o CEP
 * acha é escrito direto no nó, e o envio sem JavaScript segue funcionando.
 * Quem confere de verdade é `cadastrar`, no servidor.
 *
 * O documento entra como filho porque divide a linha com o CEP.
 */

type Busca =
  | { tipo: "ocioso" }
  | { tipo: "buscando" }
  | { tipo: "achou"; cidade: string; uf: string; geral: boolean }
  | { tipo: "inexistente" }
  | { tipo: "indisponivel" };

export function EnderecoCobranca({ documento }: { documento: ReactNode }) {
  const [busca, setBusca] = useState<Busca>({ tipo: "ocioso" });
  const ultimoCep = useRef("");
  const endereco = useRef<HTMLInputElement>(null);
  const numero = useRef<HTMLInputElement>(null);
  const bairro = useRef<HTMLInputElement>(null);

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

    if (endereco.current) endereco.current.value = resultado.logradouro;
    if (bairro.current) bairro.current.value = resultado.bairro;
    const geral = !resultado.logradouro;
    setBusca({ tipo: "achou", cidade: resultado.cidade, uf: resultado.uf, geral });
    (geral ? endereco : numero).current?.focus();
  }

  const lugar = busca.tipo === "achou" ? `${busca.cidade}/${busca.uf}` : "";

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-[1fr_9rem] items-start">
        {documento}
        <CampoCep
          name="cep"
          rotulo="CEP"
          required
          onChange={aoDigitarCep}
          erro={
            busca.tipo === "inexistente"
              ? "Não achamos este CEP. Confira os números, como 12345-678."
              : undefined
          }
          dica={
            busca.tipo === "buscando"
              ? "Buscando o endereço…"
              : busca.tipo === "achou"
                ? lugar
                : undefined
          }
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-[1fr_7rem] items-start">
        <Campo
          ref={endereco}
          name="endereco"
          rotulo="Endereço"
          placeholder="Rua, avenida…"
          autoComplete="address-line1"
          required
          dica={
            busca.tipo === "achou" && busca.geral
              ? `Este CEP vale para toda ${lugar}: escreva a rua e o bairro.`
              : busca.tipo === "indisponivel"
                ? "Não conseguimos buscar o endereço pelo CEP agora. Escreva a rua e o bairro."
                : "Preenchido pelo CEP. Corrija se precisar."
          }
        />
        <Campo
          ref={numero}
          name="numero"
          rotulo="Número"
          placeholder="505"
          // Não há código de autopreenchimento para o número; `address-line2`
          // é o do complemento, e poria "Apto 12" aqui.
          autoComplete="off"
          required
          dica="Sem número? Escreva S/N."
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 items-start">
        <Campo ref={bairro} name="bairro" rotulo="Bairro" placeholder="Centro" required />
        <Campo
          name="complemento"
          rotulo="Complemento (opcional)"
          placeholder="Sala 3, bloco B"
          autoComplete="address-line2"
          maxLength={60}
        />
      </div>
    </>
  );
}
