"use client";

/**
 * Para quem e de quem, na proposta.
 *
 * Diferente do pedido num ponto só, e é o ponto que importa: aqui o
 * destinatário pode não ser cliente ainda. Cotar preço é o começo da conversa,
 * e obrigar o cadastro antes da primeira cotação faria o representante abrir
 * ficha para quem talvez nunca compre.
 */

import { Handshake } from "lucide-react";
import { useActionState, useState } from "react";

import { Botao, Campo, MensagemErro, SecaoCartao, Selecao } from "@/components/ui";

import type { EstadoFormulario } from "../acoes";

export type Opcao = { id: string; rotulo: string; detalhe?: string };

export function FormularioNovoOrcamento({
  clientes,
  fornecedores,
  acao,
}: {
  clientes: Opcao[];
  fornecedores: Opcao[];
  acao: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
}) {
  const [estado, enviar, enviando] = useActionState(acao, {});

  // Começa no cadastro quando há clientes: é o caso comum, e quem vai cotar
  // para um desconhecido sabe que vai precisar do outro caminho.
  const [cadastrado, setCadastrado] = useState(clientes.length > 0);

  return (
    <form action={enviar} className="space-y-5">
      <MensagemErro>{estado.erro}</MensagemErro>

      <SecaoCartao
        icone={Handshake}
        titulo="Para quem e de quem"
        descricao="A proposta é de uma única indústria — é a alíquota de IPI dela que fica congelada aqui."
      >
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {[
              { valor: true, rotulo: "Cliente cadastrado" },
              { valor: false, rotulo: "Ainda não é cliente" },
            ].map((opcao) => (
              <button
                key={String(opcao.valor)}
                type="button"
                onClick={() => setCadastrado(opcao.valor)}
                aria-pressed={cadastrado === opcao.valor}
                className={`px-3.5 py-1.5 rounded-full text-corpo font-medium cursor-pointer
                  transition-colors border ${
                    cadastrado === opcao.valor
                      ? "bg-tinta text-papel border-tinta"
                      : "bg-folha text-tinta-2 border-filete hover:border-filete-forte"
                  }`}
                disabled={opcao.valor && clientes.length === 0}
              >
                {opcao.rotulo}
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {cadastrado ? (
              <Selecao name="clienteId" rotulo="Cliente" required>
                <option value="">Escolha…</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.rotulo}
                    {c.detalhe ? ` — ${c.detalhe}` : ""}
                  </option>
                ))}
              </Selecao>
            ) : (
              <>
                <Campo
                  name="clienteAvulsoNome"
                  rotulo="Para quem é a proposta"
                  required
                  placeholder="Himaflex"
                  dica="Só o nome basta. O cadastro vem depois, se o negócio acontecer."
                />
                <Campo name="clienteAvulsoMunicipio" rotulo="Cidade" placeholder="Limeira" />
              </>
            )}

            <Selecao name="fornecedorId" rotulo="Indústria" required>
              <option value="">Escolha…</option>
              {fornecedores.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.rotulo}
                  {f.detalhe ? ` — ${f.detalhe}` : ""}
                </option>
              ))}
            </Selecao>
          </div>

          {!cadastrado && (
            <p className="text-mini text-tinta-3 leading-relaxed">
              A proposta funciona normalmente — ganha número, itens e PDF. Só não vira pedido
              enquanto não houver cadastro, porque o pedido leva CNPJ e endereço para a indústria.
              Dá para cadastrar depois, direto da proposta.
            </p>
          )}
        </div>
      </SecaoCartao>

      <div className="flex justify-end">
        <Botao type="submit" carregando={enviando}>
          {enviando ? "Criando…" : "Criar orçamento"}
        </Botao>
      </div>
    </form>
  );
}
