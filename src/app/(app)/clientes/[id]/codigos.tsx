"use client";

import { useActionState } from "react";

import { Hash } from "lucide-react";

import {
  Botao,
  BotaoTexto,
  Campo,
  EstadoVazio,
  LinhaDado,
  MensagemErro,
  Painel,
  SecaoCartao,
  Selecao,
} from "@/components/ui";

import type { EstadoFormulario } from "../acoes";

export type ProdutoOpcao = { id: string; descricao: string; fornecedor: string };
export type CodigoRegistrado = {
  produtoId: string;
  descricao: string;
  /** Nulo quando o cliente não numera este produto — o vínculo vale do mesmo jeito. */
  codigo: string | null;
};

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
      icone={Hash}
      titulo="Produtos deste cliente"
      descricao="São estes que aparecem ao lançar pedido ou proposta para ele. O código é o que ELE usa — opcional, e quando não houver a coluna COD.CLI sai vazia."
    >
      <Painel className="mb-4">
        {codigos.length === 0 ? (
          <EstadoVazio discreto icone={Hash}>
            Nenhum produto vinculado a este cliente.
          </EstadoVazio>
        ) : (
          codigos.map((codigo) => (
            <LinhaDado key={codigo.produtoId}>
              <span className="font-mono text-corpo min-w-0 flex-1 truncate">
                {codigo.descricao}
              </span>

              <div className="flex items-center gap-3 ml-auto shrink-0">
                {codigo.codigo ? (
                  <span className="font-mono text-corpo text-carimbo numerico">
                    {codigo.codigo}
                  </span>
                ) : (
                  <span className="text-mini text-tinta-3">sem código</span>
                )}
                <form action={remover}>
                  <input type="hidden" name="produtoId" value={codigo.produtoId} />
                  <BotaoTexto
                    type="submit"
                    perigoso
                    aria-label={`Desvincular ${codigo.descricao}`}
                  >
                    remover
                  </BotaoTexto>
                </form>
              </div>
            </LinhaDado>
          ))
        )}
      </Painel>

      {produtos.length === 0 ? (
        <p className="text-corpo text-tinta-3">
          Cadastre produtos antes de vinculá-los a este cliente.
        </p>
      ) : (
        <form action={enviar} className="space-y-4">
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
              placeholder="121010011"
              dica="Opcional."
              className="flex-1 min-w-40"
            />

            <Botao type="submit" variante="secundaria" carregando={enviando}>
              {enviando ? "Salvando…" : "Vincular produto"}
            </Botao>
          </div>
        </form>
      )}
    </SecaoCartao>
  );
}
