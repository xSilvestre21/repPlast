"use client";

import { useActionState, type ComponentProps, type ReactNode } from "react";

import { type Pergunta, usePerguntaAntes } from "@/components/pergunta-antes";
import type { EstadoFormulario } from "@/lib/erro-formulario";

/**
 * Um botão de ação (excluir, remover) que pode ser RECUSADO — e diz por quê,
 * logo embaixo dele.
 *
 * Antes estas ações não devolviam nada: lançavam o erro, e "Esta indústria
 * tem 3 produtos e não pode ser excluída" virava a página de erro genérica do
 * Next, em inglês. Agora a recusa volta como estado, e a frase aparece onde a
 * pessoa acabou de clicar.
 */
export function AcaoComRecusa({
  acao,
  children,
  alinhamento = "fim",
  confirmar,
  className = "",
  ...props
}: Omit<ComponentProps<"form">, "action" | "children" | "onSubmit"> & {
  acao: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  children: ReactNode;
  /** De que lado a frase se alinha: com o botão no fim da linha, no fim. */
  alinhamento?: "inicio" | "fim";
  /** A pergunta antes de enviar — toda ação que apaga passa por ela. */
  confirmar?: Pergunta;
}) {
  const [estado, enviar] = useActionState(acao, {});
  const pergunta = usePerguntaAntes(confirmar);

  return (
    <form
      action={enviar}
      // `inline-flex`: dentro de uma fileira de botões é o mesmo que `flex`, e no
      // meio de um texto (o "todos" do cabeçalho do IPI) não quebra a linha.
      className={`inline-flex flex-col ${alinhamento === "fim" ? "items-end text-right" : "items-start"} ${className}`}
      {...props}
      onSubmit={pergunta.aoEnviar}
    >
      {children}
      {pergunta.janela}
      {estado.erro && (
        <p role="alert" className="surgir mt-1.5 max-w-xs text-mini text-perigo">
          {estado.erro}
        </p>
      )}
    </form>
  );
}
