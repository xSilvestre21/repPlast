"use client";

/**
 * O endereço das fichas de cliente e fornecedor, com o CEP na frente: com os
 * 8 dígitos, rua, bairro, município e UF se preenchem sozinhos (ViaCEP) e o
 * cursor pula para o número — a única parte que o CEP não sabe. Mesmo jeito
 * do cadastro do escritório (`entrada/endereco-cobranca.tsx`).
 *
 * Os campos continuam não controlados: o que o CEP acha é escrito direto no
 * nó, e `defaultValue` e o envio sem JavaScript seguem valendo. O CEP aqui é
 * opcional e o servidor não o confere — cadastro importado nunca passou pelo
 * ViaCEP, e o ViaCEP fora do ar só manda digitar à mão.
 */

import { useRef } from "react";

import { dicaDoCep, erroDoCep, lugarDoCep, useBuscaCep } from "@/components/busca-cep";
import { CampoCep } from "@/components/campo-mascarado";
import { Campo } from "@/components/ui";

export type ValoresEndereco = {
  endereco: string;
  numero: string;
  complemento: string;
  cep: string;
  bairro: string;
  municipio: string;
  uf: string;
};

const mesmaRua = (a: string, b: string) =>
  a.trim().toLocaleLowerCase("pt-BR") === b.trim().toLocaleLowerCase("pt-BR");

export function EnderecoPeloCep({ valores }: { valores: ValoresEndereco }) {
  const endereco = useRef<HTMLInputElement>(null);
  const numero = useRef<HTMLInputElement>(null);
  const complemento = useRef<HTMLInputElement>(null);
  const bairro = useRef<HTMLInputElement>(null);
  const municipio = useRef<HTMLInputElement>(null);
  const uf = useRef<HTMLInputElement>(null);

  const { busca, aoDigitarCep } = useBuscaCep((achado) => {
    if (municipio.current) municipio.current.value = achado.cidade;
    if (uf.current) uf.current.value = achado.uf;

    // CEP geral de cidade pequena: não sabe a rua nem o bairro — ficam os que
    // estavam, e o cursor vai para a rua.
    if (!achado.logradouro) {
      endereco.current?.focus();
      return;
    }
    if (bairro.current) bairro.current.value = achado.bairro;

    const rua = endereco.current;
    // Outra rua: o número e o complemento eram da antiga. A mesma (o CEP
    // redigitado na edição) fica como está, com o número dela.
    if (rua && !mesmaRua(rua.value, achado.logradouro)) {
      if (rua.value.trim()) {
        if (numero.current) numero.current.value = "";
        if (complemento.current) complemento.current.value = "";
      }
      rua.value = achado.logradouro;
    }
    numero.current?.focus();
  });

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-start">
      <CampoCep
        name="cep"
        rotulo="CEP"
        defaultValue={valores.cep}
        onChange={aoDigitarCep}
        erro={erroDoCep(busca)}
        dica={dicaDoCep(busca)}
      />
      <Campo
        ref={endereco}
        name="endereco"
        rotulo="Logradouro"
        placeholder="Rua, avenida…"
        className="lg:col-span-2"
        defaultValue={valores.endereco}
        dica={
          busca.tipo === "achou" && busca.geral
            ? `Este CEP vale para toda ${lugarDoCep(busca)}: escreva a rua e o bairro.`
            : busca.tipo === "indisponivel"
              ? "Não conseguimos buscar o endereço pelo CEP agora. Escreva a rua, o bairro e a cidade."
              : undefined
        }
      />
      <Campo
        ref={numero}
        name="numero"
        rotulo="Número"
        placeholder="505"
        // Ver `endereco-cobranca.tsx`: `address-line2` é o do complemento.
        autoComplete="off"
        dica="Sem número? Escreva S/N."
        defaultValue={valores.numero}
      />
      <Campo
        ref={complemento}
        name="complemento"
        rotulo="Complemento"
        placeholder="Galpão 2, sala 3"
        defaultValue={valores.complemento}
      />
      <Campo ref={bairro} name="bairro" rotulo="Bairro" defaultValue={valores.bairro} />
      <Campo ref={municipio} name="municipio" rotulo="Município" defaultValue={valores.municipio} />
      <Campo ref={uf} name="uf" rotulo="UF" maxLength={2} defaultValue={valores.uf} placeholder="SP" />
    </div>
  );
}
