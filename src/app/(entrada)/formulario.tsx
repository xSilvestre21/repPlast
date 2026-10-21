"use client";

import Link from "next/link";
import { useActionState } from "react";

import {
  CampoDocumentoCobranca,
  CampoTelefone,
} from "@/components/campo-mascarado";
import { CampoNomeEscritorio } from "@/components/campo-nome-escritorio";
import { RodapeCampo } from "@/components/campos";
import { useCampoDoFormulario } from "@/components/contexto-formulario";
import { EnderecoCobranca } from "@/components/entrada/endereco-cobranca";
import { ErroGeral, Formulario } from "@/components/formulario";
import { Botao, Campo, CampoSenha } from "@/components/ui";
import { TAMANHO_MINIMO_SENHA } from "@/lib/senha-regras";

import type { EstadoFormulario } from "./acoes";

type Acao = (
  estado: EstadoFormulario,
  formData: FormData,
) => Promise<EstadoFormulario>;

export function FormularioEntrada({
  acao,
  rotulo,
}: {
  acao: Acao;
  rotulo: string;
}) {
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
        <CampoSenha
          name="senha"
          rotulo="Senha"
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
      <CampoSenha
        name="senha"
        rotulo="Senha nova"
        autoComplete="new-password"
        dica={`Pelo menos ${TAMANHO_MINIMO_SENHA} caracteres.`}
        required
        autoFocus
      />
      <CampoSenha
        name="confirmacao"
        rotulo="Repita a senha nova"
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

export function FormularioCadastro({
  acao,
  plano,
}: {
  acao: Acao;
  plano: "solo" | "max";
}) {
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
        placeholder="João da Silva"
        autoComplete="name"
        required
      />
      <Campo
        name="email"
        rotulo="E-mail"
        type="email"
        autoComplete="email"
        required
      />
      <CampoTelefone
        name="telefone"
        rotulo="Celular"
        placeholder="(11) 91234-5678"
        dica="Com DDD. O pagamento da assinatura pede um telefone de contato."
        required
      />
      <CampoSenha
        name="senha"
        rotulo="Senha"
        autoComplete="new-password"
        minLength={TAMANHO_MINIMO_SENHA}
        dica={`Pelo menos ${TAMANHO_MINIMO_SENHA} caracteres.`}
        required
      />
      <CampoSenha
        name="confirmacao"
        rotulo="Repita a senha"
        autoComplete="new-password"
        required
      />

      {/*
        O que o pagamento pede. Fica por último e com a razão escrita:
        documento no meio de um cadastro de conta, sem explicação, é o campo
        que faz a pessoa desistir.
      */}
      <div className="pt-2">
        <p className="text-rotulo font-semibold text-tinta">
          Dados de cobrança
        </p>
        <p className="text-mini text-tinta-3 mt-0.5">
          O pagamento da assinatura pede o documento e o endereço de quem paga.
        </p>
      </div>
      <EnderecoCobranca
        documento={
          <CampoDocumentoCobranca
            name="documento"
            rotulo="CPF ou CNPJ"
            dica="O CNPJ novo, com letras, também vale."
            required
          />
        }
      />

      <ComoUsamosSeusDados />
      <AceiteDosTermos />

      <ErroGeral />

      <Botao type="submit" carregando={enviando} className="w-full">
        {enviando ? "Abrindo o pagamento…" : "Continuar para o pagamento"}
      </Botao>
    </Formulario>
  );
}

/**
 * O resumo do que é feito com os dados, ANTES do aceite (LGPD, art. 9º): quem
 * marca a caixa precisa ter visto o essencial sem abrir outra página. O texto
 * inteiro está em `/privacidade`.
 */
function ComoUsamosSeusDados() {
  return (
    <div className="rounded-suave bg-folha-2 px-4 py-3.5 text-mini text-tinta-2 leading-relaxed">
      <p className="text-rotulo font-semibold text-tinta">
        Como usamos os seus dados
      </p>
      <ul className="mt-1.5 list-disc pl-4 space-y-1 marker:text-tinta-3">
        <li>
          <strong className="font-semibold text-tinta">E-mail e senha:</strong>{" "}
          para você entrar e recuperar o acesso. A senha é guardada embaralhada
          — nem nós conseguimos lê-la.
        </li>
        <li>
          <strong className="font-semibold text-tinta">
            Celular, CPF/CNPJ e endereço:
          </strong>{" "}
          só para a cobrança, repassados ao Asaas. O cartão é digitado no Asaas
          e nunca passa pelo RepPlast.
        </li>
        <li>
          <strong className="font-semibold text-tinta">Protegidos:</strong> os
          dados do seu escritório ficam isolados dos de qualquer outro, e nunca
          são vendidos nem usados para publicidade.
        </li>
      </ul>
    </div>
  );
}

/**
 * O aceite, desmarcado: consentimento só vale se for um ato da pessoa
 * (LGPD, art. 8º). Os textos abrem em outra aba, para quem lê não perder o
 * formulário preenchido.
 */
function AceiteDosTermos() {
  // Volta marcada depois de uma recusa em outro campo: o React limpa o form.
  const { erro, valorDigitado } = useCampoDoFormulario("termos");
  const classeLink =
    "text-carimbo font-medium underline underline-offset-4 decoration-carimbo/35 hover:decoration-carimbo";

  return (
    <div>
      <label className="flex items-start gap-2.5 text-corpo text-tinta-2 leading-snug cursor-pointer">
        <input
          type="checkbox"
          name="termos"
          value="aceito"
          required
          defaultChecked={valorDigitado === "aceito"}
          aria-invalid={erro ? true : undefined}
          className="size-4 mt-0.5 shrink-0 accent-carimbo"
        />
        <span>
          Li e aceito os{" "}
          <Link href="/termos" target="_blank" className={classeLink}>
            Termos de Uso
          </Link>{" "}
          e a{" "}
          <Link href="/privacidade" target="_blank" className={classeLink}>
            Política de Privacidade
          </Link>
          .
        </span>
      </label>
      <RodapeCampo erro={erro} />
    </div>
  );
}
