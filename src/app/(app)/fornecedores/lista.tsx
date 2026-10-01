"use client";

/**
 * A lista de fornecedores: busca enquanto digita, sem navegar e sem piscar.
 *
 * Gêmea de `../clientes/lista.tsx` e das outras listas — as razões estão
 * escritas por extenso em `../pedidos/lista.tsx`. O resumo: o servidor desenha
 * a primeira fatia, daí em diante é esta lista que pede as seguintes a
 * `/fornecedores/busca`, a busca anterior é abortada a cada tecla, as linhas
 * atuais ficam na tela até as novas chegarem, e a URL continua contando a
 * verdade por `replaceState`.
 */

import { Factory, Loader2, Search, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  Botao,
  CLASSE_CONTROLE,
  Cartao,
  CorpoLinha,
  Emblema,
  EstadoVazio,
  FimDaLinha,
  LinhaLista,
  Segmentado,
  Selo,
  ValorLinha,
  formatarPercentual,
} from "@/components/ui";

import type { FatiaDeFornecedores, FiltroSituacaoFornecedor } from "./consulta";

/** O tempo entre a última tecla e a ida ao servidor. */
const ESPERA_MS = 250;

function endereco(busca: string, situacao: FiltroSituacaoFornecedor) {
  const parametros = new URLSearchParams();
  if (busca.trim()) parametros.set("busca", busca.trim());
  if (situacao !== "ativos") parametros.set("situacao", situacao);

  const consulta = parametros.toString();
  return consulta ? `/fornecedores?${consulta}` : "/fornecedores";
}

export function ListaFornecedores({
  inicial,
  buscaInicial,
  situacaoInicial,
  semNenhumFornecedor,
}: {
  inicial: FatiaDeFornecedores;
  buscaInicial: string;
  situacaoInicial: FiltroSituacaoFornecedor;
  /** O escritório não tem indústria nenhuma. */
  semNenhumFornecedor: boolean;
}) {
  const [busca, setBusca] = useState(buscaInicial);
  const [situacao, setSituacao] = useState(situacaoInicial);

  const [linhas, setLinhas] = useState(inicial.linhas);
  const [temMais, setTemMais] = useState(inicial.temMais);
  const [pagina, setPagina] = useState(0);
  const [buscando, setBuscando] = useState(false);

  /** A janela em que a página ainda está entrando: cascata longa, depois curta. */
  const [entrando, setEntrando] = useState(true);

  useEffect(() => {
    const fim = setTimeout(() => setEntrando(false), 1100);
    return () => clearTimeout(fim);
  }, []);

  const emVoo = useRef<AbortController | null>(null);
  const fim = useRef<HTMLDivElement | null>(null);

  const buscarFatia = useCallback(
    async (alvo: { busca: string; situacao: FiltroSituacaoFornecedor; pagina: number }) => {
      emVoo.current?.abort();
      const controle = new AbortController();
      emVoo.current = controle;

      setBuscando(true);
      try {
        const consulta = new URLSearchParams({ pagina: String(alvo.pagina) });
        if (alvo.busca.trim()) consulta.set("busca", alvo.busca.trim());
        if (alvo.situacao !== "ativos") consulta.set("situacao", alvo.situacao);

        const resposta = await fetch(`/fornecedores/busca?${consulta}`, {
          signal: controle.signal,
        });
        if (!resposta.ok) return;

        const fatia: FatiaDeFornecedores = await resposta.json();

        setLinhas((atuais) => (alvo.pagina === 0 ? fatia.linhas : [...atuais, ...fatia.linhas]));
        setTemMais(fatia.temMais);
        setPagina(alvo.pagina);
      } catch (erro) {
        // Abortar é o caminho normal: a pessoa digitou de novo antes da resposta.
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

    window.history.replaceState(null, "", endereco(busca, situacao));

    const espera = setTimeout(() => {
      void buscarFatia({ busca, situacao, pagina: 0 });
    }, ESPERA_MS);

    return () => clearTimeout(espera);
  }, [busca, situacao, buscarFatia]);

  /* A sentinela: encostou na janela, a fatia seguinte é pedida. */
  useEffect(() => {
    const alvo = fim.current;
    if (!alvo || !temMais || buscando) return;

    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas[0]?.isIntersecting) {
          void buscarFatia({ busca, situacao, pagina: pagina + 1 });
        }
      },
      { rootMargin: "400px" },
    );

    observador.observe(alvo);
    return () => observador.disconnect();
  }, [temMais, buscando, pagina, busca, situacao, buscarFatia]);

  /*
   * A busca sozinha não conta: a caixa já tem o próprio X para apagar o texto,
   * e um "Limpar" ao lado dela seria o mesmo botão duas vezes. Ele passa a
   * valer quando há situação escolhida, que o X não desfaz.
   */
  const algumFiltro = situacao !== "ativos";

  const limpar = () => {
    setBusca("");
    setSituacao("ativos");
  };

  if (semNenhumFornecedor) {
    return (
      <EstadoVazio icone={Factory}>
        Nenhuma indústria cadastrada ainda.
        <br />
        Comece por aqui: sem fornecedor não é possível cadastrar produto nem lançar pedido.
      </EstadoVazio>
    );
  }

  return (
    <>
      <div className="folha p-4 sm:p-5 mb-5 space-y-4">
        <label className="block">
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
              placeholder="Nome, razão social, CNPJ, cidade ou e-mail"
              className={`${CLASSE_CONTROLE} pl-10`}
            />
          </div>
        </label>

        <div className="flex flex-wrap items-center gap-3">
          <Segmentado
            nome="Situação"
            atual={situacao}
            aoEscolher={setSituacao}
            opcoes={[
              { valor: "ativos", rotulo: "Ativas" },
              { valor: "inativos", rotulo: "Inativas" },
              { valor: "todos", rotulo: "Todas" },
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
        <EstadoVazio
          icone={Factory}
          titulo="Nada encontrado"
          acao={
            algumFiltro ? (
              <Botao variante="secundaria" tamanho="compacto" onClick={limpar}>
                Limpar filtro
              </Botao>
            ) : undefined
          }
        >
          {situacao === "inativos" && !busca.trim()
            ? "Nenhuma indústria inativa. Uma indústria fica inativa pela ficha dela."
            : "Nenhuma indústria corresponde ao que você procurou."}
        </EstadoVazio>
      ) : (
        <Cartao
          className={`divide-y divide-filete overflow-hidden ${entrando ? "palco" : "palco-curto"}`}
        >
          {linhas.map((f) => (
            <LinhaLista key={f.id} href={`/fornecedores/${f.id}`}>
              <Emblema icone={Factory} tom="fraco" className="size-4" />

              <CorpoLinha
                titulo={
                  <span className="inline-flex items-center gap-2">
                    {f.nome}
                    {!f.ativo && <Selo tom="cancelado">Inativa</Selo>}
                  </span>
                }
                detalhe={
                  <>
                    <span className="numerico">{f.produtos}</span> produto(s)
                    {f.aditivos > 0 && (
                      <>
                        {" · "}
                        <span className="numerico">{f.aditivos}</span> aditivo(s)
                      </>
                    )}
                  </>
                }
              />

              {/* Dois percentuais lado a lado, cada um na sua largura fixa: é o
                  que faz a coluna de comissão cair no mesmo x em toda a lista,
                  em vez de escorregar conforme o IPI ao lado tiver uma casa
                  decimal a mais. */}
              <FimDaLinha>
                <ValorLinha
                  className="w-20"
                  valor={formatarPercentual(f.ipiPercentual)}
                  nota="IPI"
                />
                <ValorLinha
                  className="w-24"
                  valor={formatarPercentual(f.comissaoPercentual)}
                  nota="Comissão"
                />
              </FimDaLinha>
            </LinhaLista>
          ))}
        </Cartao>
      )}

      <div ref={fim} aria-hidden="true" />

      {buscando && linhas.length > 0 && (
        <p className="flex items-center justify-center gap-2 text-mini text-tinta-3 mt-4">
          <Loader2 size={14} strokeWidth={2} className="animate-spin" aria-hidden="true" />
          Carregando…
        </p>
      )}
    </>
  );
}
