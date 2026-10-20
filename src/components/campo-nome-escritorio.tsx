"use client";

/**
 * O campo do nome do escritório com a prévia de como ele fica no topo — no
 * cadastro e na troca em Configurações.
 *
 * A prévia usa o MESMO `NomeQueCabe` do topo, numa caixa da largura que o topo
 * dá ao nome no pior caso (o notebook, `LARGURA_MINIMA_DO_NOME`): o que se vê
 * aqui é o que vai aparecer lá, letra por letra, e não uma imitação.
 */

import { useState } from "react";

import { cabeNoTopo, LARGURA_MINIMA_DO_NOME, TAMANHO_MAXIMO_ESCRITORIO } from "@/lib/escritorio-regras";

import { Campo } from "./campos";
import { NomeQueCabe } from "./nome-que-cabe";

export function CampoNomeEscritorio({
  valorInicial = "",
  dica,
  autoFocus,
}: {
  valorInicial?: string;
  dica: string;
  autoFocus?: boolean;
}) {
  const [nome, setNome] = useState(valorInicial);
  const digitado = nome.trim();

  return (
    <div>
      <Campo
        name="escritorio"
        rotulo="Nome do escritório"
        dica={dica}
        placeholder="Representações Exemplo"
        defaultValue={valorInicial}
        maxLength={TAMANHO_MAXIMO_ESCRITORIO}
        onInput={(evento) => setNome(evento.currentTarget.value)}
        required
        autoFocus={autoFocus}
      />

      <div className="mt-3">
        <p className="rotulo mb-1.5 text-tinta-3">Assim fica no topo</p>
        {/*
          A mesma grade do topo (`navegacao.tsx`): laterais iguais, abas no
          centro. Com `flex`, as abas daqui andavam conforme o nome crescia —
          justamente o que o topo de verdade não faz mais.
        */}
        <div
          aria-hidden="true"
          data-previa-topo=""
          className="barra-topo grid h-14 items-center gap-x-4 overflow-hidden rounded-suave border
            border-filete px-4"
          style={{
            gridTemplateColumns: `${LARGURA_MINIMA_DO_NOME}px minmax(0, 1fr) ${LARGURA_MINIMA_DO_NOME}px`,
          }}
        >
          <span
            className="min-w-0 max-w-full justify-self-start font-extrabold tracking-[-0.03em]"
            data-previa-nome=""
          >
            <NomeQueCabe nome={digitado || "Seu escritório"} />
          </span>
          {/* As abas e o avatar, só sugeridos: o que importa aqui é o nome. */}
          <span data-previa-abas="" className="flex items-center justify-center gap-2 overflow-hidden opacity-60">
            {[44, 56, 40, 52, 48].map((largura, indice) => (
              <span
                key={indice}
                className="h-2 shrink-0 rounded-full bg-filete-forte"
                style={{ width: largura }}
              />
            ))}
          </span>
          <span className="size-7 justify-self-end rounded-full bg-filete-forte opacity-60" />
        </div>
        {digitado && (
          <p className={`text-mini mt-1.5 ${cabeNoTopo(digitado) ? "text-tinta-3" : "text-perigo"}`}>
            {cabeNoTopo(digitado)
              ? "Cabe inteiro no topo, mesmo no notebook, onde o espaço é menor."
              : "Não cabe inteiro no topo — encurte um pouco, ou não vai dar para salvar."}
          </p>
        )}
      </div>
    </div>
  );
}
