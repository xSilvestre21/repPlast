"use client";

/**
 * O texto que já vem preenchido em "Condições" num orçamento novo — de quem
 * está logado, não do escritório. Cada representante negocia diferente.
 */

import { ScrollText } from "lucide-react";
import { useActionState } from "react";

import { AreaTexto, Botao, MensagemErro, SecaoCartao } from "@/components/ui";

import type { EstadoFormulario } from "./acoes";

export function FormObservacoesPadrao({
  valor,
  salvar,
}: {
  valor: string;
  salvar: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
}) {
  const [estado, enviar, salvando] = useActionState(salvar, {});

  return (
    <SecaoCartao
      icone={ScrollText}
      titulo="Condições padrão do orçamento"
      descricao="Entra preenchido em todo orçamento novo que você criar. Dá para editar em cada proposta, sem afetar este padrão."
    >
      <form action={enviar} className="space-y-4">
        <MensagemErro>{estado.erro}</MensagemErro>

        <AreaTexto
          name="observacoesPadrao"
          rows={6}
          defaultValue={valor}
          placeholder={"ICMS: 18% (incluso no preço acima)\nFrete: CIF\nPrazo de entrega: 15 dias úteis"}
        />

        <div className="flex justify-end">
          <Botao type="submit" variante="secundaria" carregando={salvando}>
            {salvando ? "Salvando…" : "Salvar padrão"}
          </Botao>
        </div>
      </form>
    </SecaoCartao>
  );
}
