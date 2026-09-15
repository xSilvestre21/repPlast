"use client";

/**
 * Quem atende esta indústria.
 *
 * Vive na página da indústria, e não na do preposto, porque a permissão é da
 * indústria: marcar um é o mesmo ato que desmarcar os outros. Do lado do
 * preposto esse segundo efeito seria invisível — aconteceria numa tela onde os
 * outros nem aparecem.
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
}: {
  prepostos: PrepostoDaIndustria[];
  salvar: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
}) {
  const [estado, enviar, salvando] = useActionState(salvar, {});
  const [marcados, setMarcados] = useState(
    () => new Set(prepostos.filter((p) => p.atende).map((p) => p.id)),
  );

  // Nenhum e todos querem dizer a mesma coisa — e o rodapé diz isso em voz alta,
  // porque "desmarquei tudo" não parece "liberei para todos".
  const paraTodos = marcados.size === 0 || marcados.size === prepostos.length;

  return (
    <SecaoCartao
      icone={Users}
      tom="lilas"
      titulo="Quem atende esta indústria"
      descricao="Marque os prepostos que trabalham com ela. Quem ficar de fora não vê esta indústria nem os produtos dela."
    >
      <form action={enviar} className="space-y-4">
        <MensagemErro>{estado.erro}</MensagemErro>

        <div className="grid gap-3 sm:grid-cols-2">
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
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-mini text-tinta-3 leading-relaxed">
            {paraTodos
              ? "Como está, esta indústria é do escritório inteiro."
              : `Só ${marcados.size} de ${prepostos.length} prepostos verão esta indústria.`}
          </p>

          <Botao type="submit" variante="secundaria" carregando={salvando}>
            {salvando ? "Salvando…" : "Salvar quem atende"}
          </Botao>
        </div>
      </form>
    </SecaoCartao>
  );
}
