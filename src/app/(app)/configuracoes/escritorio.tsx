"use client";

/**
 * O nome do escritório — a marca no topo de todas as telas. Só aparece para o
 * administrador (a página decide; a ação confere de novo).
 *
 * Com a troca bloqueada pelo intervalo, o campo continua à vista com o nome de
 * agora e a data em que libera: esconder a seção faria parecer que a opção
 * sumiu.
 */

import { Store } from "lucide-react";
import { useActionState } from "react";

import { CampoNomeEscritorio } from "@/components/campo-nome-escritorio";
import { ErroGeral, Formulario } from "@/components/formulario";
import { Botao, SecaoCartao } from "@/components/ui";
import { INTERVALO_TROCA_DIAS, PRAZO_LIVRE_DIAS } from "@/lib/escritorio-regras";

import type { EstadoFormulario } from "./acoes";

export function FormNomeEscritorio({
  nome,
  proximaTroca,
  salvar,
}: {
  nome: string;
  /** "14/11/2026", ou `null` se já pode trocar. */
  proximaTroca: string | null;
  salvar: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
}) {
  const [estado, enviar, salvando] = useActionState(salvar, {});

  return (
    <SecaoCartao
      icone={Store}
      titulo="Nome do escritório"
      descricao="Vira a marca do sistema: aparece no topo de todas as telas, como um logo."
    >
      <Formulario estado={estado} action={enviar} className="space-y-4">
        <CampoNomeEscritorio
          valorInicial={nome}
          dica={
            `Troca à vontade nos ${PRAZO_LIVRE_DIAS} primeiros dias depois do cadastro; depois, uma ` +
            `vez a cada ${INTERVALO_TROCA_DIAS} dias. Nome que outro escritório já usa não pode ser escolhido.`
          }
        />

        <ErroGeral />

        <div className="flex items-center justify-end gap-3">
          {proximaTroca && (
            <p className="text-mini text-tinta-3">A próxima troca fica liberada em {proximaTroca}.</p>
          )}
          <Botao
            type="submit"
            variante="secundaria"
            carregando={salvando}
            disabled={proximaTroca !== null}
          >
            {salvando ? "Trocando…" : "Trocar nome"}
          </Botao>
        </div>
      </Formulario>
    </SecaoCartao>
  );
}
