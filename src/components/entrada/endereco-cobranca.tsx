"use client";

import { useRef, type ReactNode } from "react";

import { dicaDoCep, erroDoCep, lugarDoCep, useBuscaCep } from "@/components/busca-cep";
import { CampoCep } from "@/components/campo-mascarado";
import { Campo } from "@/components/ui";

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

export function EnderecoCobranca({ documento }: { documento: ReactNode }) {
  const endereco = useRef<HTMLInputElement>(null);
  const numero = useRef<HTMLInputElement>(null);
  const bairro = useRef<HTMLInputElement>(null);

  const { busca, aoDigitarCep } = useBuscaCep((achado) => {
    if (endereco.current) endereco.current.value = achado.logradouro;
    if (bairro.current) bairro.current.value = achado.bairro;
    (achado.logradouro ? numero : endereco).current?.focus();
  });

  const lugar = lugarDoCep(busca);

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-[1fr_9rem] items-start">
        {documento}
        <CampoCep
          name="cep"
          rotulo="CEP"
          required
          onChange={aoDigitarCep}
          erro={erroDoCep(busca)}
          dica={dicaDoCep(busca)}
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
