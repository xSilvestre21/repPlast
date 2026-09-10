"use client";

import { useActionState } from "react";

import { Botao, Campo, MensagemErro, SecaoCartao, Selecao } from "@/components/ui";

import type { EstadoFormulario } from "../acoes";

export type ProdutoOpcao = { id: string; descricao: string; fornecedor: string };
export type CodigoRegistrado = { produtoId: string; descricao: string; codigo: string };

export function SecaoCodigos({
  codigos,
  produtos,
  salvar,
  remover,
}: {
  codigos: CodigoRegistrado[];
  produtos: ProdutoOpcao[];
  salvar: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  remover: (formData: FormData) => void | Promise<void>;
}) {
  const [estado, enviar, enviando] = useActionState(salvar, {});

  return (
    <SecaoCartao
      titulo="Códigos deste cliente"
      descricao="O código que ELE usa para cada produto. Sai na coluna COD.CLI do pedido e é opcional — quando não houver, a coluna sai vazia."
    >
      <div className="mb-4 rounded-md border border-borda bg-fundo divide-y divide-borda">
        {codigos.length === 0 ? (
          <p className="px-3 py-2.5 text-sm text-texto-fraco">
            Nenhum código registrado para este cliente.
          </p>
        ) : (
          codigos.map((codigo) => (
            <div
              key={codigo.produtoId}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-3 py-2.5"
            >
              <span className="font-mono text-sm min-w-0 truncate">{codigo.descricao}</span>

              <div className="flex items-center gap-3">
                <span className="font-mono text-sm text-acento numerico">{codigo.codigo}</span>
                <form action={remover}>
                  <input type="hidden" name="produtoId" value={codigo.produtoId} />
                  <button
                    type="submit"
                    className="text-xs text-texto-fraco hover:text-perigo transition-colors px-1"
                    aria-label={`Remover código de ${codigo.descricao}`}
                  >
                    remover
                  </button>
                </form>
              </div>
            </div>
          ))
        )}
      </div>

      {produtos.length === 0 ? (
        <p className="text-sm text-texto-fraco">
          Cadastre produtos antes de registrar os códigos do cliente.
        </p>
      ) : (
        <form action={enviar} className="space-y-3">
          <MensagemErro>{estado.erro}</MensagemErro>

          <div className="flex flex-wrap items-end gap-3">
            <Selecao name="produtoId" rotulo="Produto" required className="flex-1 min-w-60">
              <option value="">Escolha…</option>
              {produtos.map((produto) => (
                <option key={produto.id} value={produto.id}>
                  {produto.descricao} — {produto.fornecedor}
                </option>
              ))}
            </Selecao>

            <Campo
              name="codigo"
              rotulo="Código no cliente"
              required
              placeholder="121010011"
              className="flex-1 min-w-40"
            />

            <Botao type="submit" variante="secundaria" disabled={enviando}>
              {enviando ? "Salvando…" : "Salvar código"}
            </Botao>
          </div>
        </form>
      )}
    </SecaoCartao>
  );
}
