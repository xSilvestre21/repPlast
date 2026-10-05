"use client";

/**
 * A troca de senha do preposto, no modo de edição da ficha.
 *
 * Fica fora do formulário do cadastro de propósito: é um envio próprio, com
 * aviso próprio — salvar o nome não pode trocar a senha por um campo vazio, e
 * trocar a senha não pode depender de reenviar o cadastro inteiro.
 */

import { KeyRound } from "lucide-react";
import { useActionState } from "react";

import { Botao, Campo, Mensagem, MensagemErro, SecaoCartao } from "@/components/ui";

import type { EstadoFormulario } from "../acoes";

export function TrocarSenha({
  acao,
}: {
  acao: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
}) {
  const [estado, enviar, trocando] = useActionState(acao, {});

  return (
    <SecaoCartao
      icone={KeyRound}
      titulo="Senha"
      descricao="Para quando ele esqueceu a dele. A nova também é provisória — passe por um canal seguro."
    >
      <form action={enviar} className="space-y-4">
        <MensagemErro>{estado.erro}</MensagemErro>
        <Mensagem tom="verde">{estado.aviso}</Mensagem>
        <div className="flex flex-wrap items-end gap-3">
          <Campo
            className="basis-64 grow sm:grow-0"
            type="password"
            name="senha"
            rotulo="Nova senha"
            autoComplete="new-password"
            placeholder="mínimo 8 caracteres"
          />
          <Botao type="submit" variante="secundaria" icone={KeyRound} carregando={trocando}>
            {trocando ? "Trocando…" : "Trocar senha"}
          </Botao>
        </div>
      </form>
    </SecaoCartao>
  );
}
