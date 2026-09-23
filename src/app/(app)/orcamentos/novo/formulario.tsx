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

import { SelecaoBuscavel } from "@/components/selecao-buscavel";
import { Botao, Campo, MensagemErro, SecaoCartao } from "@/components/ui";

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
              <SelecaoBuscavel
                name="clienteId"
                rotulo="Cliente"
                required
                opcoes={clientes}
                placeholder="Digite para achar…"
              />
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

            <SelecaoBuscavel
              name="fornecedorId"
              rotulo="Indústria"
              required
              opcoes={fornecedores}
            />
          </div>

          {!cadastrado && (
            <div className="rounded-suave border border-filete bg-folha-2 px-4 py-3 text-corpo text-tinta-2 leading-relaxed">
              <strong className="text-tinta font-semibold">Esta proposta não vira pedido.</strong>{" "}
              Ela ganha número, itens e PDF, mas os itens são feitos de conta — medidas, fator,
              aditivos —, sem produto cadastrado. Para virar pedido é preciso, depois, cadastrar o
              cliente e os itens como produtos dele; a proposta mostra o caminho.
            </div>
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
