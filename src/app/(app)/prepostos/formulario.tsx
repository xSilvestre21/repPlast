"use client";

/**
 * O cadastro do preposto — o mesmo formulário para inscrever e para editar,
 * no molde do cadastro de cliente: seções com o que cada grupo de campos é, e
 * o envio no pé.
 *
 * A diferença entre os dois usos é o login: na inscrição se escolhe o e-mail e
 * a senha provisória; depois, o e-mail fica travado (é a chave do login) e a
 * senha se troca à parte, na ficha.
 */

import { BadgeCheck, Factory, HandCoins, KeyRound, Phone } from "lucide-react";
import { useActionState } from "react";

import { CampoTelefone } from "@/components/campo-mascarado";
import { Botao, Campo, MensagemErro, SecaoCartao } from "@/components/ui";

import type { EstadoFormulario } from "./acoes";

export interface ValoresPreposto {
  nome: string;
  sobrenome: string;
  email: string;
  telefone: string;
  /** Já no padrão brasileiro ("42,5"); vazio quando não há acordo. */
  comissaoPercentual: string;
  /** As indústrias marcadas para ele — as únicas que ele vê. */
  fornecedorIds: string[];
}

export interface IndustriaDoFormulario {
  id: string;
  nome: string;
}

export const PREPOSTO_VAZIO: ValoresPreposto = {
  nome: "",
  sobrenome: "",
  email: "",
  telefone: "",
  comissaoPercentual: "",
  fornecedorIds: [],
};

export function FormularioPreposto({
  acao,
  valores,
  industrias,
  rotuloEnvio,
  novo = false,
  editavel = true,
}: {
  acao: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  valores: ValoresPreposto;
  /** Todas as indústrias que se podem marcar para ele. */
  industrias: IndustriaDoFormulario[];
  rotuloEnvio: string;
  /** Inscrição: o e-mail se escolhe aqui, e a senha provisória também. */
  novo?: boolean;
  /** Ficha aberta para leitura: tudo travado até clicar em Editar. */
  editavel?: boolean;
}) {
  const [estado, enviar, enviando] = useActionState(acao, {});

  // Recusado o envio, os campos voltam com o que foi digitado (o React limpa o
  // formulário a cada envio). O e-mail travado da edição não vai no envio, e
  // por isso vem do original.
  const atuais: ValoresPreposto = estado.valores
    ? { ...estado.valores, email: estado.valores.email || valores.email }
    : valores;

  return (
    <form action={enviar} className="space-y-5">
      <MensagemErro>{estado.erro}</MensagemErro>

      <fieldset disabled={!editavel} className="space-y-5 min-w-0">
        <SecaoCartao
          icone={BadgeCheck}
          titulo="Identificação"
          descricao="Nome e sobrenome assinam o rodapé das propostas dele e aparecem em Comissões."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo name="nome" rotulo="Nome" required placeholder="Maria" defaultValue={atuais.nome} />
            <Campo
              name="sobrenome"
              rotulo="Sobrenome"
              placeholder="Augusta Ferraz"
              defaultValue={atuais.sobrenome}
            />
          </div>
        </SecaoCartao>

        <SecaoCartao icone={Phone} titulo="Contato">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              name="email"
              rotulo="E-mail"
              type="email"
              required={novo}
              // Depois de inscrito, o e-mail é o login dele: não muda por aqui.
              // Travado com a cara de campo travado do app — e, desabilitado,
              // nem vai no envio, que de todo jeito não o lê na edição.
              disabled={!novo}
              autoComplete="off"
              placeholder="maria@exemplo.com.br"
              defaultValue={atuais.email}
              dica={novo ? "É com ele que o preposto entra no sistema." : "É o login dele — não muda por aqui."}
            />
            <CampoTelefone name="telefone" rotulo="Telefone" defaultValue={atuais.telefone} />
          </div>
        </SecaoCartao>

        <SecaoCartao
          icone={HandCoins}
          titulo="Acordo"
          descricao="A fatia dele no que a indústria paga ao escritório — não na venda. Cada pedido guarda o percentual da época em que foi lançado."
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Campo
              name="comissaoPercentualPadrao"
              rotulo="% da comissão"
              inputMode="decimal"
              placeholder="50"
              sufixo="%"
              defaultValue={atuais.comissaoPercentual}
            />
          </div>
        </SecaoCartao>

        <SecaoCartao
          icone={Factory}
          tom="lilas"
          titulo="Indústrias"
          descricao="Marque as indústrias com que ele trabalha. Ele só vê as marcadas, com os produtos delas; sem nenhuma marcada, não vê indústria nenhuma."
        >
          {industrias.length === 0 ? (
            <p className="text-corpo text-tinta-3">Nenhuma indústria cadastrada ainda.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {industrias.map((industria) => (
                <label
                  key={industria.id}
                  className="flex items-center gap-3 rounded-suave border border-filete
                    bg-folha-2 px-3 py-2.5 text-corpo cursor-pointer transition-colors
                    hover:border-filete-forte min-w-0"
                >
                  <input
                    type="checkbox"
                    name="fornecedorId"
                    value={industria.id}
                    defaultChecked={atuais.fornecedorIds.includes(industria.id)}
                    className="size-4 shrink-0 accent-carimbo cursor-pointer"
                  />
                  <span className="truncate">{industria.nome}</span>
                </label>
              ))}
            </div>
          )}
        </SecaoCartao>

        {novo && (
          <SecaoCartao
            icone={KeyRound}
            titulo="Acesso"
            descricao="A senha é provisória: passe a ele por um canal seguro e combine de trocá-la no primeiro acesso."
          >
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Campo
                name="senha"
                rotulo="Senha provisória"
                type="password"
                required
                autoComplete="new-password"
                dica="Mínimo 8 caracteres."
              />
            </div>
          </SecaoCartao>
        )}
      </fieldset>

      {editavel && (
        <div className="flex justify-end">
          <Botao type="submit" carregando={enviando}>
            {enviando ? "Salvando…" : rotuloEnvio}
          </Botao>
        </div>
      )}
    </form>
  );
}
