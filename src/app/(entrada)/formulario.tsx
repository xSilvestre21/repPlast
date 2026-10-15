"use client";

import Link from "next/link";
import { useActionState } from "react";

import { CampoCep, CampoDocumento } from "@/components/campo-mascarado";
import { CampoNomeEscritorio } from "@/components/campo-nome-escritorio";
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
      <div>
        <Campo
          name="senha"
          rotulo="Senha"
          type="password"
          autoComplete="current-password"
          required
        />
        <div className="mt-2 flex justify-end">
          <Link
            href="/esqueci-senha"
            className="text-mini text-tinta-2 underline underline-offset-4 decoration-tinta-3/40
              transition-colors hover:text-carimbo hover:decoration-carimbo"
          >
            Esqueceu sua senha?
          </Link>
        </div>
      </div>

      <ErroGeral />

      <Botao type="submit" carregando={enviando} className="w-full">
        {enviando ? "Entrando…" : rotulo}
      </Botao>
    </Formulario>
  );
}

/** "Esqueceu sua senha?": só o e-mail. */
export function FormularioEsqueciSenha({ acao }: { acao: Acao }) {
  const [estado, enviar, enviando] = useActionState(acao, {});

  return (
    <Formulario estado={estado} action={enviar} className="space-y-4">
      <Campo
        name="email"
        rotulo="E-mail"
        type="email"
        autoComplete="email"
        dica="O mesmo com que você entra no sistema."
        required
        autoFocus
      />

      <ErroGeral />

      <Botao type="submit" carregando={enviando} className="w-full">
        {enviando ? "Enviando…" : "Enviar link"}
      </Botao>
    </Formulario>
  );
}

/** A senha nova, pelo link do e-mail. */
export function FormularioSenhaNova({ acao }: { acao: Acao }) {
  const [estado, enviar, enviando] = useActionState(acao, {});

  return (
    <Formulario estado={estado} action={enviar} className="space-y-4">
      <Campo
        name="senha"
        rotulo="Senha nova"
        type="password"
        autoComplete="new-password"
        dica={`Pelo menos ${TAMANHO_MINIMO_SENHA} caracteres.`}
        required
        autoFocus
      />
      <Campo
        name="confirmacao"
        rotulo="Repita a senha nova"
        type="password"
        autoComplete="new-password"
        required
      />

      <ErroGeral />

      <Botao type="submit" carregando={enviando} className="w-full">
        {enviando ? "Salvando…" : "Salvar senha nova"}
      </Botao>
    </Formulario>
  );
}

export function FormularioCadastro({ acao, plano }: { acao: Acao; plano: "solo" | "max" }) {
  const [estado, enviar, enviando] = useActionState(acao, {});

  return (
    <Formulario estado={estado} action={enviar} className="space-y-4">
      <input type="hidden" name="plano" value={plano} />

      <CampoNomeEscritorio
        dica={
          "Vira a marca do RepPlast: aparece no topo de todas as telas, como um logo. Prefira um " +
          "nome curto — até uns 12 caracteres fica no tamanho cheio; até 25 costuma caber. Dá para " +
          "trocar depois em Configurações."
        }
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
