"use client";

/**
 * Quem recebe o pedido nesta indústria.
 *
 * Uma tabela que se edita e se salva como bloco, como as faixas do material.
 * O "padrão" é o grupo: quem está marcado já vem escolhido no envio, e o resto
 * fica a um clique para quando o pedido pede alguém a mais.
 */

import { Plus, Send, Trash2 } from "lucide-react";
import { startTransition, useActionState, useState } from "react";

import { Botao, CLASSE_CONTROLE, EstadoVazio, MensagemErro, SecaoCartao } from "@/components/ui";

import type { EstadoFormulario } from "../acoes";

export type Contato = {
  id: string;
  nome: string;
  setor: string;
  email: string;
  padrao: boolean;
};

type Linha = Contato & { chave: string };

let sequencia = 0;
const linhaNova = (): Linha => ({
  chave: `nova-${++sequencia}`,
  id: "",
  nome: "",
  setor: "",
  email: "",
  padrao: true,
});

export function SecaoContatos({
  contatos,
  salvar,
  editavel,
}: {
  contatos: Contato[];
  salvar: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  /** Ficha aberta para leitura: a tabela aparece, mas não se mexe. */
  editavel: boolean;
}) {
  const [estado, enviar, salvando] = useActionState(salvar, {});
  // A linha em branco de quem não tem contato é convite a digitar — em leitura
  // ela não teria o que convidar, e a lista vazia fala por si.
  const [linhas, setLinhas] = useState<Linha[]>(() =>
    contatos.length > 0 || !editavel
      ? contatos.map((c) => ({ ...c, chave: c.id }))
      : [linhaNova()],
  );

  // Sem a coluna da lixeira em leitura. As duas classes por extenso, porque o
  // Tailwind só gera o que encontra escrito inteiro no código.
  const colunas = editavel
    ? "sm:grid-cols-[1fr_0.8fr_1.4fr_auto_auto]"
    : "sm:grid-cols-[1fr_0.8fr_1.4fr_auto]";

  const mudar = (chave: string, campo: keyof Contato, valor: string | boolean) =>
    setLinhas((atuais) => atuais.map((l) => (l.chave === chave ? { ...l, [campo]: valor } : l)));

  return (
    <SecaoCartao
      icone={Send}
      titulo="Contatos para pedidos"
      descricao="Para quem o pedido pode ir por e-mail. Os marcados como padrão já vêm escolhidos no envio; os outros ficam à mão."
    >
      <form
        // Submissão à mão, como no envio do pedido: o reset automático do React
        // desfaria as linhas digitadas quando o salvamento volta com erro.
        onSubmit={(evento) => {
          evento.preventDefault();
          const dados = new FormData(evento.currentTarget);
          startTransition(() => enviar(dados));
        }}
        className="space-y-3"
      >
        <MensagemErro>{estado.erro}</MensagemErro>

        <fieldset disabled={!editavel} className="space-y-3 min-w-0">
          {linhas.length === 0 ? (
            <EstadoVazio discreto icone={Send}>
              Ninguém cadastrado. Sem contato, o pedido não tem para quem ir por e-mail.
            </EstadoVazio>
          ) : (
            <>
              <div className={`hidden sm:grid gap-2 text-tinta-3 ${colunas}`}>
                <span className="rotulo">Nome</span>
                <span className="rotulo">Setor</span>
                <span className="rotulo">E-mail</span>
                <span className="rotulo w-16 text-center">Padrão</span>
                {editavel && <span className="w-8" />}
              </div>

              {linhas.map((linha, i) => (
                <div
                  key={linha.chave}
                  className={`grid grid-cols-2 gap-2 items-center ${colunas}`}
                >
                  <input type="hidden" name="contatoId" value={linha.id} />
                  {/* Checkbox desmarcado não vai no FormData, e as listas paralelas
                      desalinhariam. O oculto manda "sim" ou "nao" para toda linha. */}
                  <input type="hidden" name="padrao" value={linha.padrao ? "sim" : "nao"} />

                  <label>
                    <span className="sr-only">Nome do contato {i + 1}</span>
                    <input
                      name="nome"
                      value={linha.nome}
                      onChange={(e) => mudar(linha.chave, "nome", e.target.value)}
                      placeholder={linha.id ? "" : "Marcos"}
                      className={CLASSE_CONTROLE}
                    />
                  </label>
                  <label>
                    <span className="sr-only">Setor do contato {i + 1}</span>
                    <input
                      name="setor"
                      value={linha.setor}
                      onChange={(e) => mudar(linha.chave, "setor", e.target.value)}
                      placeholder={linha.id ? "" : "Comercial"}
                      className={CLASSE_CONTROLE}
                    />
                  </label>
                  <label className="col-span-2 sm:col-span-1">
                    <span className="sr-only">E-mail do contato {i + 1}</span>
                    <input
                      name="email"
                      type="email"
                      value={linha.email}
                      onChange={(e) => mudar(linha.chave, "email", e.target.value)}
                      placeholder="pedidos@industria.com.br"
                      className={CLASSE_CONTROLE}
                    />
                  </label>
                  <label className="flex items-center justify-center gap-2 sm:w-16 text-corpo">
                    <input
                      type="checkbox"
                      checked={linha.padrao}
                      onChange={(e) => mudar(linha.chave, "padrao", e.target.checked)}
                      className="size-4 accent-carimbo"
                    />
                    <span className="sm:sr-only">Padrão</span>
                  </label>
                  {editavel && (
                    <button
                      type="button"
                      onClick={() => setLinhas((atuais) => atuais.filter((l) => l.chave !== linha.chave))}
                      className="justify-self-end size-8 grid place-items-center rounded-full text-tinta-3 hover:text-perigo hover:bg-perigo-fraco cursor-pointer"
                      aria-label={`Tirar ${linha.email || "este contato"}`}
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  )}
                </div>
              ))}
            </>
          )}
        </fieldset>

        {editavel && (
          <div className="flex flex-wrap justify-between gap-2 pt-1">
            <Botao
              type="button"
              variante="secundaria"
              tamanho="compacto"
              icone={Plus}
              onClick={() => setLinhas((atuais) => [...atuais, linhaNova()])}
            >
              Adicionar contato
            </Botao>
            <Botao type="submit" variante="secundaria" carregando={salvando}>
              {salvando ? "Salvando…" : "Salvar contatos"}
            </Botao>
          </div>
        )}
      </form>
    </SecaoCartao>
  );
}
