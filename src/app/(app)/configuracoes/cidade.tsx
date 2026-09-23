"use client";

/**
 * De onde você escreve — a cidade que abre o cabeçalho da proposta.
 *
 * De quem está logado, não do escritório, pelo mesmo motivo das condições
 * padrão: prepostos moram em cidades diferentes, e a carta é assinada por quem
 * a escreveu. Até aqui o cabeçalho usava a cidade da INDÚSTRIA, que pode estar
 * a 400 km de quem assina embaixo.
 */

import { MapPin } from "lucide-react";
import { useActionState } from "react";

import { Botao, Campo, MensagemErro, SecaoCartao } from "@/components/ui";

import type { EstadoFormulario } from "./acoes";

export function FormCidade({
  valor,
  salvar,
}: {
  valor: string;
  salvar: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
}) {
  const [estado, enviar, salvando] = useActionState(salvar, {});

  return (
    <SecaoCartao
      icone={MapPin}
      titulo="Sua cidade"
      descricao="Abre o cabeçalho da proposta, antes da data: “Americana, 16 de Setembro de 2026”."
    >
      <form action={enviar} className="space-y-4">
        <MensagemErro>{estado.erro}</MensagemErro>

        <Campo
          name="municipio"
          rotulo="Cidade"
          defaultValue={valor}
          placeholder="Americana"
          className="max-w-xs"
          dica="Entra preenchida em todo orçamento novo. Dá para trocar em cada proposta — quem viaja muda ali, sem mexer neste padrão."
        />

        <div className="flex justify-end">
          <Botao type="submit" variante="secundaria" carregando={salvando}>
            {salvando ? "Salvando…" : "Salvar cidade"}
          </Botao>
        </div>
      </form>
    </SecaoCartao>
  );
}
