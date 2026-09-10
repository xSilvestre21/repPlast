"use client";

import { useActionState } from "react";

import { Botao, Campo, MensagemErro, SecaoCartao, Selecao, formatarMoeda } from "@/components/ui";

import type { EstadoFormulario } from "../acoes";

export type Aditivo = {
  id: string;
  nome: string;
  sufixoDescricao: string;
  tipo: "POR_KG" | "POR_MILHEIRO";
  valor: string;
};

export function SecaoAditivos({
  aditivos,
  adicionar,
  remover,
}: {
  aditivos: Aditivo[];
  adicionar: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  remover: (formData: FormData) => void | Promise<void>;
}) {
  const [estado, enviar, enviando] = useActionState(adicionar, {});

  return (
    <SecaoCartao
      titulo="Aditivos"
      descricao="Somam um valor ao preço e um sufixo à descrição impressa. Ex.: deslizante leva o fator de 13,50 para 15,60."
    >
      <div className="mb-4 rounded-md border border-borda bg-fundo divide-y divide-borda">
        {aditivos.length === 0 ? (
          <p className="px-3 py-2.5 text-sm text-texto-fraco">
            Nenhum aditivo cadastrado para esta indústria.
          </p>
        ) : (
          aditivos.map((aditivo) => (
            <div
              key={aditivo.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2.5"
            >
              <div className="min-w-0">
                <div className="text-sm">{aditivo.nome}</div>
                <div className="text-xs text-texto-fraco font-mono truncate">
                  {aditivo.sufixoDescricao}
                </div>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-sm numerico">
                  +{formatarMoeda(aditivo.valor)}
                  <span className="text-texto-fraco text-xs ml-1">
                    {aditivo.tipo === "POR_KG" ? "/ kg" : "/ milheiro"}
                  </span>
                </span>
                <form action={remover}>
                  <input type="hidden" name="aditivoId" value={aditivo.id} />
                  <button
                    type="submit"
                    className="text-xs text-texto-fraco hover:text-perigo transition-colors px-1"
                    aria-label={`Remover aditivo ${aditivo.nome}`}
                  >
                    remover
                  </button>
                </form>
              </div>
            </div>
          ))
        )}
      </div>

      <form action={enviar} className="space-y-3">
        <MensagemErro>{estado.erro}</MensagemErro>

        <div className="grid gap-3 sm:grid-cols-2">
          <Campo name="nome" rotulo="Nome" required placeholder="Deslizante" />
          <Campo
            name="sufixoDescricao"
            rotulo="Sufixo na descrição"
            required
            placeholder="C/ DESLIZANTE"
            dica="Entra no fim da descrição impressa do produto."
          />
          <Campo
            name="valor"
            rotulo="Valor somado"
            inputMode="decimal"
            required
            placeholder="2,10"
          />
          <Selecao
            name="tipo"
            rotulo="Somado onde"
            dica="Por kg entra no fator, antes da fórmula. Por milheiro entra no preço final."
          >
            <option value="POR_KG">No fator kg</option>
            <option value="POR_MILHEIRO">No preço do milheiro</option>
          </Selecao>
        </div>

        <div className="flex justify-end">
          <Botao type="submit" variante="secundaria" disabled={enviando}>
            {enviando ? "Adicionando…" : "Adicionar aditivo"}
          </Botao>
        </div>
      </form>
    </SecaoCartao>
  );
}
