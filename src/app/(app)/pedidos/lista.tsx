"use client";

/**
 * A lista de pedidos: busca enquanto digita, sem navegar e sem piscar.
 *
 * Gêmea de `../orcamentos/lista.tsx`, e as razões são as mesmas — estão escritas
 * por extenso lá. O resumo: o servidor desenha a primeira fatia, daí em diante é
 * esta lista que pede as seguintes a `/pedidos/busca`, a busca anterior é
 * abortada a cada tecla, as linhas atuais ficam na tela até as novas chegarem, e
 * a URL continua contando a verdade por `replaceState`.
 *
 * O que muda aqui: até agora esta tela paginava por URL (`?pagina=3`), com links
 * de verdade. Com busca e três filtros, ninguém mais pensa em número de página —
 * pensa em "o pedido da MARIOL" — e manter as duas listas com interações
 * diferentes custava mais do que o link para a página 3 valia.
 */

import { Ban, Loader2, Search, ScrollText, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { SeloStatus } from "@/components/selo-status";
import {
  Botao,
  CLASSE_CONTROLE,
  Cartao,
  CorpoLinha,
  EstadoVazio,
  FimDaLinha,
  LinhaLista,
  Segmentado,
  ValorLinha,
} from "@/components/ui";

import type { FatiaDePedidos, FiltroStatusPedido, PedidoDaLista } from "./consulta";

/** O tempo entre a última tecla e a ida ao servidor. */
const ESPERA_MS = 250;

function endereco(busca: string, status: FiltroStatusPedido) {
  const parametros = new URLSearchParams();
  if (busca.trim()) parametros.set("busca", busca.trim());
  if (status !== "todos") parametros.set("status", status);

  const consulta = parametros.toString();
  return consulta ? `/pedidos?${consulta}` : "/pedidos";
}

export function ListaPedidos({
  inicial,
  buscaInicial,
  statusInicial,
}: {
  inicial: FatiaDePedidos;
  buscaInicial: string;
  statusInicial: FiltroStatusPedido;
}) {
  const [busca, setBusca] = useState(buscaInicial);
  const [status, setStatus] = useState(statusInicial);

  const [linhas, setLinhas] = useState(inicial.linhas);
  const [temMais, setTemMais] = useState(inicial.temMais);
  const [pagina, setPagina] = useState(0);
  const [buscando, setBuscando] = useState(false);

  /**
   * A janela em que a página ainda está ENTRANDO.
   *
   * Enquanto ela dura, a lista usa a cascata longa — é a tela nascendo. Depois
   * dela, qualquer linha que chegue usa a curta, porque animação que muda no
   * meio recomeça, e recomeçar é piscar.
   */
  const [entrando, setEntrando] = useState(true);

  useEffect(() => {
    const fim = setTimeout(() => setEntrando(false), 1100);
    return () => clearTimeout(fim);
  }, []);

  const emVoo = useRef<AbortController | null>(null);
  const fim = useRef<HTMLDivElement | null>(null);

  const buscarFatia = useCallback(
    async (alvo: { busca: string; status: FiltroStatusPedido; pagina: number }) => {
      emVoo.current?.abort();
      const controle = new AbortController();
      emVoo.current = controle;

      setBuscando(true);
      try {
        const consulta = new URLSearchParams({ pagina: String(alvo.pagina) });
        if (alvo.busca.trim()) consulta.set("busca", alvo.busca.trim());
        if (alvo.status !== "todos") consulta.set("status", alvo.status);

        const resposta = await fetch(`/pedidos/busca?${consulta}`, {
          signal: controle.signal,
        });
        if (!resposta.ok) return;

        const fatia: FatiaDePedidos = await resposta.json();

        setLinhas((atuais) => (alvo.pagina === 0 ? fatia.linhas : [...atuais, ...fatia.linhas]));
        setTemMais(fatia.temMais);
        setPagina(alvo.pagina);
      } catch (erro) {
        // Abortar é o caminho normal aqui: significa que a pessoa digitou de
        // novo antes de esta resposta chegar.
        if ((erro as Error)?.name !== "AbortError") throw erro;
      } finally {
        if (emVoo.current === controle) setBuscando(false);
      }
    },
    [],
  );

  // Primeira renderização não busca: a fatia inicial já veio do servidor.
  const primeira = useRef(true);

  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }

    window.history.replaceState(null, "", endereco(busca, status));

    const espera = setTimeout(() => {
      void buscarFatia({ busca, status, pagina: 0 });
    }, ESPERA_MS);

    return () => clearTimeout(espera);
  }, [busca, status, buscarFatia]);

  /*
   * A sentinela: um bloco vazio depois da última linha. Quando ele encosta na
   * janela, a fatia seguinte é pedida — é o que substitui a barra de páginas
   * sem nunca trocar de rota.
   */
  useEffect(() => {
    const alvo = fim.current;
    if (!alvo || !temMais || buscando) return;

    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas[0]?.isIntersecting) {
          void buscarFatia({ busca, status, pagina: pagina + 1 });
        }
      },
      // Começa a carregar antes de a pessoa chegar no fim de verdade.
      { rootMargin: "400px" },
    );

    observador.observe(alvo);
    return () => observador.disconnect();
  }, [temMais, buscando, pagina, busca, status, buscarFatia]);

  const algumFiltro = Boolean(busca.trim()) || status !== "todos";

  const limpar = () => {
    setBusca("");
    setStatus("todos");
  };

  return (
    <>
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
                name="busca"
                autoComplete="off"
                value={busca}
                onChange={(evento) => setBusca(evento.target.value)}
                placeholder="Número, cliente, indústria ou pedido do cliente"
                className={`${CLASSE_CONTROLE} pl-10`}
              />
            </div>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Segmentado
            nome="Status"
            // "todos" (sem filtro) não bate com nenhuma opção abaixo de
            // propósito — nenhuma pastilha fica marcada como ativa nesse caso.
            atual={status as "aberto" | "enviado" | "cancelado"}
            aoEscolher={(valor) => setStatus(valor === status ? "todos" : valor)}
            opcoes={[
              { valor: "aberto", rotulo: "Em aberto" },
              { valor: "enviado", rotulo: "Enviados" },
              { valor: "cancelado", rotulo: "Cancelados" },
            ]}
          />

          {algumFiltro && (
            <Botao variante="secundaria" icone={X} tamanho="compacto" onClick={limpar}>
              Limpar
            </Botao>
          )}
        </div>
      </div>

      {linhas.length === 0 ? (
        algumFiltro ? (
          <EstadoVazio
            icone={ScrollText}
            titulo="Nada encontrado"
            acao={
              <Botao variante="secundaria" tamanho="compacto" onClick={limpar}>
                Limpar filtro
              </Botao>
            }
          >
            Nenhum pedido corresponde ao que você procurou.
          </EstadoVazio>
        ) : (
          <EstadoVazio icone={ScrollText}>
            Nenhum pedido lançado ainda.
            <br />
            Comece escolhendo o cliente e a indústria.
          </EstadoVazio>
        )
      ) : (
        <Cartao
          className={`divide-y divide-filete overflow-hidden ${entrando ? "palco" : "palco-curto"}`}
        >
          {linhas.map((pedido: PedidoDaLista) => (
            <LinhaLista key={pedido.id} href={`/pedidos/${pedido.id}`}>
              <div className="flex items-center gap-3 min-w-0 basis-full sm:basis-0 sm:flex-1">
                {/* Largura fixa: o nº 99 e o nº 2262 têm de começar a empurrar
                    o nome do cliente a partir do mesmo ponto. */}
                <span className="cifra numerico shrink-0 w-16 text-tinta-2">#{pedido.numero}</span>

                <CorpoLinha
                  titulo={pedido.cliente}
                  detalhe={
                    <>
                      {pedido.fornecedor} · {pedido.itens} item(ns) · {pedido.data}
                      {/* Se dá para procurar por ele, ele precisa estar visível:
                          senão a pessoa busca "228156", a linha aparece e nada
                          nela explica por quê. */}
                      {pedido.pedidoDoCliente && (
                        <> · pedido do cliente {pedido.pedidoDoCliente}</>
                      )}
                      {/* O motivo em linha própria: é frase, não mais um campo
                          da fila de dados separados por ponto. */}
                      {pedido.motivoCancelamento && (
                        <span className="flex items-start gap-1 text-perigo mt-0.5">
                          <Ban
                            size={11}
                            strokeWidth={2}
                            aria-hidden="true"
                            className="shrink-0 mt-[3px]"
                          />
                          {pedido.motivoCancelamento}
                        </span>
                      )}
                    </>
                  }
                />
              </div>

              <FimDaLinha>
                <ValorLinha
                  className="w-32"
                  riscado={pedido.status === "CANCELADO"}
                  valor={pedido.valor}
                />
                <div className="w-24 flex justify-end">
                  <SeloStatus status={pedido.status} />
                </div>
              </FimDaLinha>
            </LinhaLista>
          ))}
        </Cartao>
      )}

      <div ref={fim} aria-hidden="true" />

      {/* O giro só aparece quando há lista: buscar do zero troca o conteúdo no
          lugar, e um indicador ali embaixo seria movimento sem informação. */}
      {buscando && linhas.length > 0 && (
        <p className="flex items-center justify-center gap-2 text-mini text-tinta-3 mt-4">
          <Loader2 size={14} strokeWidth={2} className="animate-spin" aria-hidden="true" />
          Carregando…
        </p>
      )}
    </>
  );
}
