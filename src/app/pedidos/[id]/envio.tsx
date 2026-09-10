"use client";

import { useActionState } from "react";

import { Botao, MensagemErro } from "@/components/ui";

import type { EstadoFormulario } from "../acoes";

/**
 * Envio do pedido por e-mail.
 *
 * Fica separado das outras ações porque é o único caminho que sai do sistema:
 * manda o PDF para a indústria e, dando certo, marca o pedido como enviado —
 * o que dispara a comissão.
 */
export function BotaoEnviarEmail({
  destinatarios,
  jaEnviado,
  acao,
}: {
  destinatarios: string[];
  jaEnviado: boolean;
  acao: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
}) {
  const [estado, enviar, enviando] = useActionState(acao, {});

  const semDestinatario = destinatarios.length === 0;

  return (
    <div className="flex flex-col items-end gap-2">
      <form action={enviar}>
        <Botao
          type="submit"
          variante={jaEnviado ? "secundaria" : "primaria"}
          disabled={enviando || semDestinatario}
          title={
            semDestinatario
              ? "A indústria não tem e-mail cadastrado"
              : `Enviar para ${destinatarios.join(", ")}`
          }
        >
          {enviando ? "Enviando…" : jaEnviado ? "Reenviar por e-mail" : "Enviar por e-mail"}
        </Botao>
      </form>

      {estado.erro && (
        <div className="max-w-sm">
          <MensagemErro>{estado.erro}</MensagemErro>
        </div>
      )}
    </div>
  );
}
