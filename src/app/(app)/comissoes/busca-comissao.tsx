"use client";

/**
 * A busca das tabelas de Comissões: o número do pedido, o cliente ou o
 * preposto, filtrando enquanto se digita.
 *
 * Quem confere o extrato de uma indústria com quarenta pedidos no mês vai
 * lendo o extrato e procurando cada pedido na tela. Filtra aqui, no navegador,
 * e não pela URL como o mês e a indústria: a tela já tem todos os itens do mês,
 * e uma ida ao servidor por tecla refaria todas as consultas da página.
 *
 * As linhas são ESCONDIDAS, nunca desmontadas: o acerto aberto guarda o que
 * foi digitado nele, e a busca não pode apagá-lo. Pelo mesmo motivo a busca
 * sobrevive ao salvar um acerto — o `revalidatePath` refaz a página no lugar,
 * sem desmontar o que é do navegador —, que é o caminho da conferência: busca,
 * acerta, busca o próximo.
 *
 * Quem decide o que casa é o índice (`linhas`), uma vez por tecla; cada linha
 * só pergunta se a chave dela está entre as achadas (`useLinhaVisivel`).
 */

import { Search, SearchX, X } from "lucide-react";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { Botao, CLASSE_CONTROLE, EstadoVazio } from "@/components/ui";
import { quantos } from "@/lib/quantos";

import { casaComBusca, type LinhaBuscavel } from "./busca";

export type LinhaDoIndice = LinhaBuscavel & {
  /** `chaveDaLinha` — o pedido, ou uma parcela dele. */
  chave: string;
  pedidoId: string;
  fornecedorId: string;
};

type Busca = {
  /** Há algo digitado. Sem isso, tudo aparece e nada é escondido. */
  ativa: boolean;
  linhas: ReadonlySet<string>;
  industrias: ReadonlySet<string>;
};

/*
 * Sem provedor, nada é escondido: a linha de comissão é usada (e testada) fora
 * da busca, e lá ela tem de aparecer sempre.
 */
const ContextoBusca = createContext<Busca | null>(null);

/** A linha `chave` aparece com a busca de agora? */
export function useLinhaVisivel(chave: string): boolean {
  const busca = useContext(ContextoBusca);
  return !busca?.ativa || busca.linhas.has(chave);
}

export function BuscaComissao({
  linhas,
  ordem,
  placeholder,
  onde,
  children,
}: {
  linhas: LinhaDoIndice[];
  /** O seletor de ordem, ao lado da caixa. */
  ordem: ReactNode;
  placeholder: string;
  /** "de novembro de 2026", "da ERIPACK em novembro de 2026" — para a frase do nada achado. */
  onde: string;
  children: ReactNode;
}) {
  const [texto, setTexto] = useState("");
  const ativa = texto.trim() !== "";

  const busca = useMemo<Busca & { pedidos: number }>(() => {
    const achadas = ativa ? linhas.filter((linha) => casaComBusca(linha, texto)) : linhas;
    return {
      ativa,
      linhas: new Set(achadas.map((l) => l.chave)),
      industrias: new Set(achadas.map((l) => l.fornecedorId)),
      // Pedidos, não linhas: duas parcelas do mesmo pedido contam um (`contarPedidos`).
      pedidos: new Set(achadas.map((l) => l.pedidoId)).size,
    };
  }, [linhas, texto, ativa]);

  const nada = ativa && busca.pedidos === 0;

  return (
    <ContextoBusca.Provider value={busca}>
      {/* Pelo topo, com o rótulo sobre cada um: no celular a ordem desce para
          a linha de baixo, e as duas peças continuam se explicando sozinhas. */}
      <div className="mb-5 flex flex-wrap items-start gap-x-4 gap-y-3">
        <div className="flex-1 min-w-56">
          <label className="block">
            <span className="rotulo block mb-1.5 text-tinta-2">Buscar</span>
            <span className="relative block">
              <Search
                size={15}
                strokeWidth={2}
                aria-hidden="true"
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tinta-3 pointer-events-none"
              />
              <input
                type="search"
                enterKeyHint="search"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                autoComplete="off"
                value={texto}
                onChange={(evento) => setTexto(evento.target.value)}
                onKeyDown={(evento) => {
                  if (evento.key === "Escape") setTexto("");
                }}
                placeholder={placeholder}
                className={`${CLASSE_CONTROLE} pl-10`}
              />
            </span>
          </label>
          {/* Fora do rótulo, que daria nome à caixa junto com a contagem. Sempre
              na página, vazio sem busca: o leitor de tela só anuncia mudança numa
              região que já existia. */}
          <p aria-live="polite" className="text-mini text-tinta-3 mt-1.5 empty:mt-0">
            {nada ? (
              // À vista, quem diz é o "Nada encontrado" logo abaixo.
              <span className="sr-only">Nenhum pedido encontrado</span>
            ) : ativa ? (
              quantos(busca.pedidos, "pedido encontrado", "pedidos encontrados")
            ) : null}
          </p>
        </div>

        {ordem}
      </div>

      {nada && (
        <EstadoVazio
          icone={SearchX}
          titulo="Nada encontrado"
          acao={
            <Botao variante="secundaria" icone={X} tamanho="compacto" onClick={() => setTexto("")}>
              Limpar busca
            </Botao>
          }
        >
          Nenhum pedido {onde} com “{texto.trim()}”. Procure por parte do número do pedido (como
          22 para achar o 2253) ou do nome do cliente.
        </EstadoVazio>
      )}

      {children}
    </ContextoBusca.Provider>
  );
}

/** O cartão de uma indústria: some quando nenhuma linha dele casa com a busca. */
export function GrupoDaBusca({ fornecedorId, children }: { fornecedorId: string; children: ReactNode }) {
  const busca = useContext(ContextoBusca);
  return <div hidden={Boolean(busca?.ativa) && !busca?.industrias.has(fornecedorId)}>{children}</div>;
}

/**
 * A linha "Total" da indústria, escondida durante a busca.
 *
 * Com metade das linhas escondidas, o total da indústria inteira embaixo delas
 * pareceria a soma do que está à vista — e não seria. É o mesmo cuidado de
 * deixar o cancelado fora da soma do grupo (`page.tsx`).
 */
export function LinhaDoTotal({ className, children }: { className?: string; children: ReactNode }) {
  const busca = useContext(ContextoBusca);
  return (
    <tr className={className} hidden={Boolean(busca?.ativa)}>
      {children}
    </tr>
  );
}
