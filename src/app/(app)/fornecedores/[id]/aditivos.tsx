"use client";

import { useActionState } from "react";

import { FlaskConical } from "lucide-react";

import { AcaoComRecusa } from "@/components/acao-com-recusa";
import { ErroGeral, Formulario } from "@/components/formulario";
import {
  Botao,
  BotaoTexto,
  Campo,
  CorpoLinha,
  EstadoVazio,
  LinhaDado,
  Painel,
  SecaoCartao,
  Selecao,
  ValorLinha,
  formatarMoeda,
} from "@/components/ui";

import type { EstadoFormulario } from "../acoes";

/** Como o valor do aditivo é cobrado, do jeito que a indústria fala. */
const ROTULO_TIPO = {
  POR_KG: "/ kg",
  POR_MILHEIRO: "/ milheiro",
  POR_METRO_LINEAR: "/ metro",
} as const;

export type Aditivo = {
  id: string;
  nome: string;
  sufixoDescricao: string;
  tipo: "POR_KG" | "POR_MILHEIRO" | "POR_METRO_LINEAR";
  valor: string;
};

export function SecaoAditivos({
  aditivos,
  adicionar,
  remover,
  editavel,
}: {
  aditivos: Aditivo[];
  adicionar: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  remover: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  /** Ficha aberta para leitura: a lista aparece, cadastrar e remover exigem Editar. */
  editavel: boolean;
}) {
  const [estado, enviar, enviando] = useActionState(adicionar, {});

  return (
    <SecaoCartao
      icone={FlaskConical}
      titulo="Aditivos"
      descricao="Somam um valor ao preço e um sufixo à descrição impressa. Ex.: deslizante leva o fator de 13,50 para 15,60."
    >
      <Painel className={editavel ? "mb-4" : ""}>
        {aditivos.length === 0 ? (
          <EstadoVazio discreto icone={FlaskConical}>
            Nenhum aditivo cadastrado para esta indústria.
          </EstadoVazio>
        ) : (
          aditivos.map((aditivo) => (
            <LinhaDado key={aditivo.id}>
              <CorpoLinha titulo={aditivo.nome} detalhe={aditivo.sufixoDescricao} />

              <div className="flex items-center gap-3 ml-auto shrink-0">
                <ValorLinha
                  className="w-28"
                  valor={`+${formatarMoeda(aditivo.valor)}`}
                  nota={ROTULO_TIPO[aditivo.tipo]}
                />
                {editavel && (
                  <AcaoComRecusa
                    acao={remover}
                    confirmar={{
                      titulo: `Remover o aditivo ${aditivo.nome}?`,
                      texto:
                        "Ele deixa de aparecer para marcar nos produtos e nas contas desta " +
                        "indústria. Esta ação não pode ser desfeita.",
                      rotulo: "Remover",
                    }}
                  >
                    <input type="hidden" name="aditivoId" value={aditivo.id} />
                    <BotaoTexto type="submit" perigoso aria-label={`Remover aditivo ${aditivo.nome}`}>
                      remover
                    </BotaoTexto>
                  </AcaoComRecusa>
                )}
              </div>
            </LinhaDado>
          ))
        )}
      </Painel>

      {editavel && (
        <Formulario estado={estado} action={enviar} className="space-y-4">

          <div className="grid gap-4 sm:grid-cols-2">
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
              dica="Por kg entra no fator, antes da fórmula. Por milheiro entra no preço final. Por metro fica guardado, mas ainda não entra na conta do saco."
            >
              <option value="POR_KG">No fator kg</option>
              <option value="POR_MILHEIRO">No preço do milheiro</option>
              <option value="POR_METRO_LINEAR">Por metro linear</option>
            </Selecao>
          </div>

          <ErroGeral />
          <div className="flex justify-end">
            <Botao type="submit" variante="secundaria" carregando={enviando}>
              {enviando ? "Adicionando…" : "Adicionar aditivo"}
            </Botao>
          </div>
        </Formulario>
      )}
    </SecaoCartao>
  );
}
