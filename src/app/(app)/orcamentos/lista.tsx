"use client";

/**
 * A lista de orçamentos: busca enquanto digita, sem navegar e sem piscar.
 *
 * O servidor desenha a primeira fatia; daí em diante é esta lista que pede as
 * seguintes à rota `/orcamentos/busca`. Nada aqui troca de rota — e é por isso
 * que a tela não remonta: antes, cada letra virava uma URL nova, a página vinha
 * inteira de volta e as linhas que passavam a bater com o filtro nasciam do
 * zero para o React, refazendo a animação de entrada a cada tecla.
 *
 * Três detalhes fazem a troca não tremer:
 *
 *   1. A busca anterior é ABORTADA a cada tecla, senão uma resposta lenta
 *      chegaria depois de uma rápida e a lista voltaria no tempo.
 *   2. As linhas atuais continuam na tela até as novas chegarem — nunca há um
 *      vazio no meio do caminho.
 *   3. A cascata encurta depois que a página termina de entrar (`palco` vira
 *      `palco-curto`): linha nova continua se montando, em 0,2s em vez de um
 *      segundo. Sem movimento nenhum a troca fica seca — o que lia como
 *      "recarregou" era o TEMPO da entrada de página, não o fade.
 *
 * A URL continua contando a verdade, escrita por baixo com `replaceState`:
 * copiar o link ou dar F5 traz a mesma tela, sem custar uma navegação por tecla.
 */

import { FileText, Loader2, ScrollText, Search, ThumbsDown, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

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

import type { FatiaDeOrcamentos, FiltroStatusOrcamento, OrcamentoDaLista } from "./consulta";
import { SeloOrcamento } from "./selo";

/** O tempo entre a última tecla e a ida ao servidor. */
const ESPERA_MS = 250;

function endereco(busca: string, status: FiltroStatusOrcamento) {
  const parametros = new URLSearchParams();
  if (busca.trim()) parametros.set("busca", busca.trim());
  if (status !== "todos") parametros.set("status", status);

  const consulta = parametros.toString();
  return consulta ? `/orcamentos?${consulta}` : "/orcamentos";
}

export function ListaOrcamentos({
  inicial,
  buscaInicial,
  statusInicial,
}: {
  inicial: FatiaDeOrcamentos;
  buscaInicial: string;
  statusInicial: FiltroStatusOrcamento;
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
   * dela, qualquer linha que chegue (filtro novo, fatia da rolagem) usa a
   * curta. O tempo é o da própria cascata de entrada (0,5s de atraso máximo
   * mais 0,55s de fade), então a troca cai num instante em que não há mais
   * nada animando: animação que muda no meio recomeça, e recomeçar é piscar.
   */
  const [entrando, setEntrando] = useState(true);

  useEffect(() => {
    const fim = setTimeout(() => setEntrando(false), 1100);
    return () => clearTimeout(fim);
  }, []);

  const emVoo = useRef<AbortController | null>(null);
  const fim = useRef<HTMLDivElement | null>(null);

  const buscarFatia = useCallback(
    async (alvo: { busca: string; status: FiltroStatusOrcamento; pagina: number }) => {
      emVoo.current?.abort();
      const controle = new AbortController();
      emVoo.current = controle;

      setBuscando(true);
      try {
        const consulta = new URLSearchParams({ pagina: String(alvo.pagina) });
        if (alvo.busca.trim()) consulta.set("busca", alvo.busca.trim());
        if (alvo.status !== "todos") consulta.set("status", alvo.status);

        const resposta = await fetch(`/orcamentos/busca?${consulta}`, {
          signal: controle.signal,
        });
        if (!resposta.ok) return;

        const fatia: FatiaDeOrcamentos = await resposta.json();

        setLinhas((atuais) =>
          alvo.pagina === 0 ? fatia.linhas : [...atuais, ...fatia.linhas],
        );
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
   * janela, a fatia seguinte é pedida — é o que substitui o botão de próxima
   * página sem nunca trocar de rota.
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
                // O Chrome reclama de campo sem identificação ("A form field
                // element should have an id or name attribute") e tenta
                // autopreencher um filtro que não tem nada a preencher.
                autoComplete="off"
                value={busca}
                onChange={(evento) => setBusca(evento.target.value)}
                placeholder="Número, cliente ou indústria"
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
            atual={status as "aberto" | "recusado" | "aceito"}
            aoEscolher={(valor) => setStatus(valor === status ? "todos" : valor)}
            opcoes={[
              { valor: "aberto", rotulo: "Em aberto" },
              { valor: "recusado", rotulo: "Recusados" },
              { valor: "aceito", rotulo: "Aceitos" },
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
            icone={FileText}
            titulo="Nada encontrado"
            acao={
              <Botao variante="secundaria" tamanho="compacto" onClick={limpar}>
                Limpar filtro
              </Botao>
            }
          >
            Nenhum orçamento corresponde ao que você procurou.
          </EstadoVazio>
        ) : (
          <EstadoVazio icone={FileText}>
            Nenhuma proposta lançada.
            <br />
            Comece escolhendo o cliente e a indústria.
          </EstadoVazio>
        )
      ) : (
        <Cartao
          className={`divide-y divide-filete overflow-hidden ${
            entrando ? "palco" : "palco-curto"
          }`}
        >
          {linhas.map((orcamento: OrcamentoDaLista) => (
            <LinhaLista key={orcamento.id} href={`/orcamentos/${orcamento.id}`}>
              <div className="flex items-center gap-3 min-w-0 basis-full sm:basis-0 sm:flex-1">
                <span className="cifra numerico shrink-0 w-16 text-tinta-2">
                  #{orcamento.numero}
                </span>

                <CorpoLinha
                  titulo={
                    <>
                      {orcamento.nome}
                      {!orcamento.cadastrado && (
                        <span className="text-mini font-normal text-tinta-3 ml-2">
                          sem cadastro · não vira pedido
                        </span>
                      )}
                    </>
                  }
                  detalhe={
                    <>
                      {orcamento.fornecedor} · {orcamento.itens} item(ns) · {orcamento.data}
                      {orcamento.virouPedido && (
                        <>
                          {" · "}
                          <span className="inline-flex items-center gap-1 text-verde">
                            <ScrollText size={11} strokeWidth={2} aria-hidden="true" />
                            virou pedido
                          </span>
                        </>
                      )}
                      {/* O motivo em linha própria: é frase, não mais um campo
                          da fila de dados separados por ponto. */}
                      {orcamento.motivoRecusa && (
                        <span className="flex items-start gap-1 text-perigo mt-0.5">
                          <ThumbsDown
                            size={11}
                            strokeWidth={2}
                            aria-hidden="true"
                            className="shrink-0 mt-[3px]"
                          />
                          {orcamento.motivoRecusa}
                        </span>
                      )}
                    </>
                  }
                />
              </div>

              <FimDaLinha>
                <ValorLinha
                  className="w-32"
                  riscado={orcamento.status === "RECUSADO"}
                  valor={orcamento.valor}
                />
                <div className="w-24 flex justify-end">
                  <SeloOrcamento status={orcamento.status} />
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
