"use client";

/**
 * O e-mail com que a pessoa entra — e o pedido para trocá-lo.
 *
 * Não troca na hora: pede a senha e manda um link ao endereço novo, e só o
 * clique nele troca (`lib/troca-email.ts`). O e-mail é também para onde vai o
 * "Esqueceu sua senha?"; trocado errado, trancaria a pessoa fora da conta.
 *
 * Não mexe nas caixas de envio (Configurações › E-mail): aquelas são de onde
 * os pedidos saem, e podem ser outro endereço.
 */

import { AtSign } from "lucide-react";
import { useActionState, useState } from "react";

import { ErroGeral, Formulario } from "@/components/formulario";
import { Botao, Campo, CampoSenha, Mensagem, SecaoCartao } from "@/components/ui";

import type { EstadoConta } from "./acoes";

export function FormEmailLogin({
  email,
  pendente,
  pedir,
}: {
  email: string;
  /** O e-mail novo de um pedido ainda não confirmado, ou `null`. */
  pendente: string | null;
  pedir: (estado: EstadoConta, formData: FormData) => Promise<EstadoConta>;
}) {
  const [estado, enviar, enviando] = useActionState(pedir, {});
  // Aberto "desde" o último resultado: enviado com sucesso, o estado muda e o
  // formulário fecha sozinho; recusado, continua aberto para corrigir.
  // "Cancelar" fecha mesmo com a recusa ainda no estado.
  const [abertoEm, setAbertoEm] = useState<EstadoConta | null>(null);
  const [canceladoEm, setCanceladoEm] = useState<EstadoConta | null>(null);
  const mostrarFormulario = (abertoEm === estado || Boolean(estado.erro)) && canceladoEm !== estado;

  return (
    <SecaoCartao
      icone={AtSign}
      titulo="E-mail de login"
      descricao="É com ele que você entra no sistema, e é para ele que vai o link de “Esqueceu sua senha?”."
    >
      <div className="space-y-4">
        <p className="text-corpo text-tinta break-words">
          <span className="font-medium">{email}</span>
        </p>

        {pendente && !estado.ok && (
          <p className="text-mini text-tinta-2">
            Aguardando a confirmação em <span className="font-medium break-words">{pendente}</span>. Abra o
            link que mandamos para lá — ou peça a troca de novo.
          </p>
        )}
        <Mensagem tom="verde">{estado.ok}</Mensagem>

        {mostrarFormulario ? (
          <Formulario estado={estado} action={enviar} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo
                name="emailNovo"
                rotulo="E-mail novo"
                type="email"
                autoComplete="email"
                placeholder="voce@escritorio.com.br"
                required
              />
              <CampoSenha
                name="senhaAtual"
                rotulo="Sua senha atual"
                autoComplete="current-password"
                required
                dica="Para confirmar que é você."
              />
            </div>

            <ErroGeral />

            <div className="flex justify-end gap-3">
              <Botao type="button" variante="secundaria" onClick={() => setCanceladoEm(estado)} disabled={enviando}>
                Cancelar
              </Botao>
              <Botao type="submit" carregando={enviando}>
                {enviando ? "Enviando…" : "Enviar link de confirmação"}
              </Botao>
            </div>
          </Formulario>
        ) : (
          <div className="flex justify-end">
            <Botao type="button" variante="secundaria" onClick={() => {
                setAbertoEm(estado);
                setCanceladoEm(null);
              }}>
              Trocar e-mail
            </Botao>
          </div>
        )}
      </div>
    </SecaoCartao>
  );
}
