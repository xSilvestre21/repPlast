"use client";

/**
 * Quem atende esta indústria.
 *
 * O mesmo vínculo da ficha do preposto, visto pelo outro lado: aqui se marca
 * uma indústria para vários prepostos de uma vez; lá, várias indústrias para
 * um preposto. Quem fica desmarcado não vê esta indústria.
 */

import { Users } from "lucide-react";
import { useActionState, useState } from "react";

import { Botao, MensagemErro, SecaoCartao } from "@/components/ui";

import type { EstadoFormulario } from "../acoes";

export type PrepostoDaIndustria = {
  id: string;
  nome: string;
  atende: boolean;
};

export function SecaoPrepostos({
  prepostos,
  salvar,
  editavel,
}: {
  prepostos: PrepostoDaIndustria[];
  salvar: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  /** Ficha aberta para leitura: as marcas aparecem, mudar exige Editar. */
  editavel: boolean;
}) {
  const [estado, enviar, salvando] = useActionState(salvar, {});
  const [marcados, setMarcados] = useState(
    () => new Set(prepostos.filter((p) => p.atende).map((p) => p.id)),
  );


  return (
    <SecaoCartao
      icone={Users}
      tom="lilas"
      titulo="Quem atende esta indústria"
      descricao="Marque os prepostos que trabalham com ela. Quem ficar de fora não vê esta indústria nem os produtos dela."
    >
      <form action={enviar} className="space-y-4">
        <MensagemErro>{estado.erro}</MensagemErro>

        <fieldset disabled={!editavel} className="grid gap-3 sm:grid-cols-2 min-w-0">
          {prepostos.map((p) => (
            <label
              key={p.id}
              className="flex items-center gap-3 rounded-suave border border-filete
                bg-folha-2 px-3 py-2.5 text-corpo cursor-pointer transition-colors
                hover:border-filete-forte"
            >
              <input
                type="checkbox"
                name="usuarioId"
                value={p.id}
                checked={marcados.has(p.id)}
                onChange={(e) =>
                  setMarcados((atual) => {
                    const novo = new Set(atual);
                    if (e.target.checked) novo.add(p.id);
                    else novo.delete(p.id);
                    return novo;
                  })
                }
                className="size-4 accent-carimbo cursor-pointer"
              />
              {p.nome}
            </label>
          ))}
        </fieldset>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-mini text-tinta-3 leading-relaxed">
            {marcados.size === 0
              ? "Nenhum preposto vê esta indústria — só o administrador."
              : marcados.size === prepostos.length
                ? "Todos os prepostos veem esta indústria."
                : `Só ${marcados.size} de ${prepostos.length} prepostos veem esta indústria.`}
          </p>

          {editavel && (
            <Botao type="submit" variante="secundaria" carregando={salvando}>
              {salvando ? "Salvando…" : "Salvar quem atende"}
            </Botao>
          )}
        </div>
      </form>
    </SecaoCartao>
  );
}
