"use client";

/**
 * Busca e filtro de status dos orçamentos.
 *
 * Diferente da busca de Produtos (`<form method="get">` puro, sem
 * JavaScript), esta filtra ENQUANTO digita: o campo é controlado, e cada
 * tecla reagenda uma troca de URL 300ms depois da última — cedo o bastante
 * pra parecer instantâneo, tarde o bastante pra não buscar a cada letra.
 * `useTransition` mantém a lista atual visível durante a troca, em vez de
 * piscar o esqueleto de carregamento a cada busca.
 *
 * Não lê `useSearchParams()`: recebe `busca`/`status` como props (o servidor
 * já leu os dois) e monta a URL só com o que já sabe — evita a exigência de
 * `<Suspense>` que o hook traria, e mantém o componente simples.
 */

import { Search, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { BotaoLink, CLASSE_CONTROLE, Segmentado } from "@/components/ui";

export type FiltroStatusOrcamento = "todos" | "aberto" | "recusado" | "aceito";

export type FiltrosOrcamento = {
  busca: string;
  status: FiltroStatusOrcamento;
};

function enderecoComFiltros(busca: string, status: FiltroStatusOrcamento) {
  const parametros = new URLSearchParams();
  if (busca) parametros.set("busca", busca);
  if (status !== "todos") parametros.set("status", status);

  const consulta = parametros.toString();
  return consulta ? `/orcamentos?${consulta}` : "/orcamentos";
}

export function FiltrosOrcamentos({ filtros }: { filtros: FiltrosOrcamento }) {
  const router = useRouter();
  const [busca, setBusca] = useState(filtros.busca);
  const [, iniciarTransicao] = useTransition();
  const primeiraRenderizacao = useRef(true);

  // Sem isto, a primeira renderização (montagem) já dispararia uma troca de
  // URL para o valor que ela mesma acabou de receber — navegação à toa.
  useEffect(() => {
    if (primeiraRenderizacao.current) {
      primeiraRenderizacao.current = false;
      return;
    }

    const espera = setTimeout(() => {
      iniciarTransicao(() => {
        router.replace(enderecoComFiltros(busca, filtros.status), { scroll: false });
      });
    }, 300);

    return () => clearTimeout(espera);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busca]);

  const algumFiltro = Boolean(filtros.busca) || filtros.status !== "todos";

  return (
    <div className="folha p-4 sm:p-5 mb-5 space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex-1 min-w-56">
          <span className="rotulo block mb-1.5 text-tinta-2">Buscar</span>
          <div className="relative">
            <Search
              size={15}
              strokeWidth={2}
              aria-hidden="true"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tinta-3 pointer-events-none"
            />
            <input
              type="search"
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
              placeholder="Cliente ou indústria"
              className={`${CLASSE_CONTROLE} pl-10`}
            />
          </div>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Segmentado
          nome="Status"
          // "todos" (sem filtro) não bate com nenhuma opção abaixo de propósito
          // — nenhuma pastilha fica marcada como ativa nesse caso.
          atual={filtros.status as "aberto" | "recusado" | "aceito"}
          opcoes={[
            { valor: "aberto", rotulo: "Em aberto", href: enderecoComFiltros(busca, "aberto") },
            { valor: "recusado", rotulo: "Recusados", href: enderecoComFiltros(busca, "recusado") },
            { valor: "aceito", rotulo: "Aceitos", href: enderecoComFiltros(busca, "aceito") },
          ]}
        />

        {algumFiltro && (
          <BotaoLink href="/orcamentos" variante="secundaria" icone={X} tamanho="compacto">
            Limpar
          </BotaoLink>
        )}
      </div>
    </div>
  );
}
