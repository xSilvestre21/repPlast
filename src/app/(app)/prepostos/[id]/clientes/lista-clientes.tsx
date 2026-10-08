"use client";

/**
 * A lista de clientes para marcar quem o preposto atende, com busca.
 *
 * A busca só ESCONDE as linhas que não batem (`hidden`), em vez de tirá-las do
 * formulário: caixa desmontada não vai no envio, e salvar com um filtro
 * digitado desvincularia em silêncio todos os clientes fora dele.
 */

import { Search } from "lucide-react";
import { useActionState, useState } from "react";

import { Botao, Cartao, MensagemErro } from "@/components/ui";

import type { EstadoFormulario } from "../../acoes";

export type ClienteParaMarcar = {
  id: string;
  apelido: string;
  razaoSocial: string;
  lugar: string;
  ativo: boolean;
  marcado: boolean;
  /** Os outros prepostos que já atendem — um cliente pode ser de vários. */
  outros: string[];
};

function normalizar(texto: string) {
  return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function ListaClientesDoPreposto({
  clientes,
  salvar,
  nome,
}: {
  clientes: ClienteParaMarcar[];
  salvar: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  nome: string;
}) {
  const [estado, enviar, salvando] = useActionState(salvar, {});
  const [busca, setBusca] = useState("");
  const [marcados, setMarcados] = useState(
    () => new Set(clientes.filter((c) => c.marcado).map((c) => c.id)),
  );

  const procurado = normalizar(busca.trim());
  const bate = (c: ClienteParaMarcar) =>
    !procurado || normalizar(`${c.apelido} ${c.razaoSocial} ${c.lugar}`).includes(procurado);
  const visiveis = clientes.filter(bate);

  const alternar = (id: string, marcar: boolean) =>
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (marcar) novo.add(id);
      else novo.delete(id);
      return novo;
    });

  return (
    <form action={enviar} className="space-y-5">
      <MensagemErro>{estado.erro}</MensagemErro>

      <Cartao className="p-4 sm:p-5 flex flex-wrap items-center gap-3">
        <label className="relative flex-1 min-w-56">
          <span className="sr-only">Buscar cliente</span>
          <Search
            size={15}
            strokeWidth={2}
            aria-hidden="true"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-tinta-3"
          />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Nome, razão social ou cidade"
            className="w-full rounded-suave border border-filete bg-folha-2 pl-9 pr-3 py-2.5 text-corpo
              text-tinta placeholder:text-tinta-3 focus:outline-none focus:border-carimbo"
          />
        </label>
        {/* Marcar ou desmarcar o que a busca mostra — o atalho para "todos de
            Ribeirão Preto" sem clicar um por um. */}
        <div className="flex gap-2">
          <Botao
            type="button"
            variante="secundaria"
            tamanho="compacto"
            onClick={() => visiveis.forEach((c) => alternar(c.id, true))}
          >
            Marcar {procurado ? "os encontrados" : "todos"}
          </Botao>
          <Botao
            type="button"
            variante="secundaria"
            tamanho="compacto"
            onClick={() => visiveis.forEach((c) => alternar(c.id, false))}
          >
            Desmarcar {procurado ? "os encontrados" : "todos"}
          </Botao>
        </div>
      </Cartao>

      <Cartao className="divide-y divide-filete overflow-hidden">
        {clientes.map((c) => (
          <label
            key={c.id}
            hidden={!bate(c)}
            className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-folha-2 min-w-0"
          >
            <input
              type="checkbox"
              name="clienteId"
              value={c.id}
              checked={marcados.has(c.id)}
              onChange={(e) => alternar(c.id, e.target.checked)}
              className="size-4 shrink-0 accent-carimbo cursor-pointer"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-corpo font-medium text-tinta truncate">
                {c.apelido}
                {!c.ativo && <span className="text-mini font-normal text-tinta-3 ml-2">inativo</span>}
              </span>
              <span className="block text-mini text-tinta-3 truncate">
                {[c.lugar, c.outros.length > 0 ? `também atendido por ${c.outros.join(", ")}` : ""]
                  .filter(Boolean)
                  .join(" · ") || c.razaoSocial}
              </span>
            </span>
          </label>
        ))}
        {visiveis.length === 0 && (
          <p className="px-4 py-6 text-corpo text-tinta-3 text-center">Nenhum cliente encontrado.</p>
        )}
      </Cartao>

      <div className="sticky bottom-4 flex flex-wrap items-center justify-end gap-3">
        <p className="text-mini text-tinta-3 rounded-full bg-folha px-3 py-1.5 border border-filete">
          {marcados.size === 0
            ? `${nome} não atende nenhum cliente.`
            : `${nome} atende ${marcados.size} ${marcados.size === 1 ? "cliente" : "clientes"}.`}
        </p>
        <Botao type="submit" carregando={salvando}>
          {salvando ? "Salvando…" : "Salvar e voltar"}
        </Botao>
      </div>
    </form>
  );
}
