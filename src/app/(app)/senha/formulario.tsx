"use client";

import { useActionState } from "react";

import { ErroGeral, Formulario } from "@/components/formulario";
import { Botao, BotaoLink, CampoSenha, Mensagem } from "@/components/ui";
import { TAMANHO_MINIMO_SENHA } from "@/lib/senha-regras";

import type { EstadoFormulario } from "./acoes";

type Acao = (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;

/**
 * Senha atual, a nova e a repetição.
 *
 * No primeiro acesso do preposto, um "Agora não" ao lado do botão: a troca é
 * uma sugestão, e quem entrou para fazer um pedido urgente segue para o sistema.
 */
export function FormularioSenha({ acao, primeiroAcesso }: { acao: Acao; primeiroAcesso: boolean }) {
  const [estado, enviar, enviando] = useActionState(acao, {});

  return (
    <Formulario estado={estado} action={enviar} className="space-y-4 max-w-md">
      {primeiroAcesso && <input type="hidden" name="primeiroAcesso" value="1" />}
      <Mensagem tom="verde">{estado.aviso}</Mensagem>

      <CampoSenha
        name="atual"
        rotulo={primeiroAcesso ? "Senha que você recebeu" : "Senha atual"}
        autoComplete="current-password"
        required
        autoFocus
      />
      <CampoSenha
        name="senha"
        rotulo="Senha nova"
        autoComplete="new-password"
        minLength={TAMANHO_MINIMO_SENHA}
        dica={`Pelo menos ${TAMANHO_MINIMO_SENHA} caracteres. Só você vai saber.`}
        required
      />
      <CampoSenha
        name="confirmacao"
        rotulo="Repita a senha nova"
        autoComplete="new-password"
        required
      />

      <ErroGeral />

      <div className="flex flex-wrap items-center gap-3">
        <Botao type="submit" carregando={enviando}>
          {enviando ? "Salvando…" : primeiroAcesso ? "Criar minha senha" : "Trocar senha"}
        </Botao>
        {primeiroAcesso && (
          <BotaoLink href="/" variante="secundaria" tamanho="compacto">
            Agora não
          </BotaoLink>
        )}
      </div>
    </Formulario>
  );
}
