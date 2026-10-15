"use client";

import { useActionState } from "react";

import { CampoCep, CampoDocumento } from "@/components/campo-mascarado";
import { ErroGeral, Formulario } from "@/components/formulario";
import { Botao, Campo } from "@/components/ui";
import { TAMANHO_MAXIMO_ESCRITORIO } from "@/lib/escritorio-regras";
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

export function FormularioCadastro({ acao, plano }: { acao: Acao; plano: "solo" | "max" }) {
  const [estado, enviar, enviando] = useActionState(acao, {});

  return (
    <Formulario estado={estado} action={enviar} className="space-y-4">
      <input type="hidden" name="plano" value={plano} />

      <Campo
        name="escritorio"
        rotulo="Nome do escritório"
        dica={`Como a sua representação é conhecida — até ${TAMANHO_MAXIMO_ESCRITORIO} caracteres.`}
        placeholder="Representação Silvestre"
        maxLength={TAMANHO_MAXIMO_ESCRITORIO}
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

      {/*
        Os dois que o pagamento pede. Ficam por último e com a razão escrita:
        documento no meio de um cadastro de conta, sem explicação, é o campo
        que faz a pessoa desistir.
      */}
      <div className="pt-2">
        <p className="text-rotulo font-semibold text-tinta">Dados de cobrança</p>
        <p className="text-mini text-tinta-3 mt-0.5">O pagamento da assinatura pede estes dois dados.</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_9rem] items-start">
        <CampoDocumento
          name="documento"
          rotulo="CPF ou CNPJ"
          placeholder="123.456.789-09"
          required
        />
        <CampoCep name="cep" rotulo="CEP" placeholder="14781-160" autoComplete="postal-code" required />
      </div>

      <ErroGeral />

      <Botao type="submit" carregando={enviando} className="w-full">
        {enviando ? "Abrindo o pagamento…" : "Continuar para o pagamento"}
      </Botao>
    </Formulario>
  );
}
