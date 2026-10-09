"use client";

import { useActionState } from "react";

import { ErroGeral, Formulario } from "@/components/formulario";
import { Botao, Campo } from "@/components/ui";
import { TAMANHO_MINIMO_SENHA } from "@/lib/senha-regras";

import type { EstadoFormulario } from "./acoes";

type Acao = (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;

export function FormularioEntrada({ acao, rotulo }: { acao: Acao; rotulo: string }) {
  const [estado, enviar, enviando] = useActionState(acao, {});

  return (
    <Formulario estado={estado} action={enviar} className="space-y-4">

      <Campo
        name="email"
        rotulo="E-mail"
        type="email"
        autoComplete="email"
        required
        autoFocus
      />
      <Campo
        name="senha"
        rotulo="Senha"
        type="password"
        autoComplete="current-password"
        required
      />

      <ErroGeral />

      <Botao type="submit" carregando={enviando} className="w-full">
        {enviando ? "Entrando…" : rotulo}
      </Botao>
    </Formulario>
  );
}

export function FormularioCadastro({ acao }: { acao: Acao }) {
  const [estado, enviar, enviando] = useActionState(acao, {});

  return (
    <Formulario estado={estado} action={enviar} className="space-y-4">

      <Campo
        name="escritorio"
        rotulo="Nome do escritório"
        dica="Como a sua representação é conhecida."
        placeholder="Representação Silvestre"
        required
        autoFocus
      />
      <Campo
        name="nome"
        rotulo="Seu nome"
        dica="Nome e sobrenome — é assim que você assina o rodapé das propostas."
        placeholder="Valquiria Silvestre"
        autoComplete="name"
        required
      />
      <Campo name="email" rotulo="E-mail" type="email" autoComplete="email" required />
      <Campo
        name="senha"
        rotulo="Senha"
        type="password"
        autoComplete="new-password"
        minLength={TAMANHO_MINIMO_SENHA}
        dica={`Pelo menos ${TAMANHO_MINIMO_SENHA} caracteres.`}
        required
      />
      <Campo
        name="confirmacao"
        rotulo="Repita a senha"
        type="password"
        autoComplete="new-password"
        required
      />

      <ErroGeral />

      <Botao type="submit" carregando={enviando} className="w-full">
        {enviando ? "Criando…" : "Criar meu escritório"}
      </Botao>
    </Formulario>
  );
}
