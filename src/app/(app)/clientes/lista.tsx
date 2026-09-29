"use client";

/**
 * A lista de clientes: busca enquanto digita, sem navegar e sem piscar.
 *
 * Gêmea de `../pedidos/lista.tsx` e `../orcamentos/lista.tsx` — as razões estão
 * escritas por extenso lá. O resumo: o servidor desenha a primeira fatia, daí
 * em diante é esta lista que pede as seguintes a `/clientes/busca`, a busca
 * anterior é abortada a cada tecla, as linhas atuais ficam na tela até as
 * novas chegarem, e a URL continua contando a verdade por `replaceState`.
 *
 * Até aqui a tela paginava por URL, só com os ativos. Com 107 clientes na
 * carteira de referência, ninguém procura "a página 5": procura "a ALBRAS".
 */

import { Loader2, Search, UserRoundPlus, Users, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  Avatar,
  Botao,
  CLASSE_CONTROLE,
  Cartao,
  CorpoLinha,
  EstadoVazio,
  FimDaLinha,
  LinhaLista,
  Segmentado,
  Selo,
  ValorLinha,
} from "@/components/ui";

import type { ClienteDaLista, FatiaDeClientes, FiltroSituacaoCliente } from "./consulta";

/** O tempo entre a última tecla e a ida ao servidor. */
const ESPERA_MS = 250;

function endereco(busca: string, situacao: FiltroSituacaoCliente) {
  const parametros = new URLSearchParams();
  if (busca.trim()) parametros.set("busca", busca.trim());
  if (situacao !== "ativos") parametros.set("situacao", situacao);

  const consulta = parametros.toString();
  return consulta ? `/clientes?${consulta}` : "/clientes";
}

export function ListaClientes({
  inicial,
  buscaInicial,
  situacaoInicial,
  semNenhumCliente,
}: {
  inicial: FatiaDeClientes;
  buscaInicial: string;
  situacaoInicial: FiltroSituacaoCliente;
  /** O escritório não tem cliente nenhum — nem ativo, nem inativo. */
  semNenhumCliente: boolean;
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
    async (alvo: { busca: string; situacao: FiltroSituacaoCliente; pagina: number }) => {
      emVoo.current?.abort();
      const controle = new AbortController();
      emVoo.current = controle;

      setBuscando(true);
      try {
        const consulta = new URLSearchParams({ pagina: String(alvo.pagina) });
        if (alvo.busca.trim()) consulta.set("busca", alvo.busca.trim());
        if (alvo.situacao !== "ativos") consulta.set("situacao", alvo.situacao);

        const resposta = await fetch(`/clientes/busca?${consulta}`, { signal: controle.signal });
        if (!resposta.ok) return;

        const fatia: FatiaDeClientes = await resposta.json();

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

  const algumFiltro = Boolean(busca.trim()) || situacao !== "ativos";

  const limpar = () => {
    setBusca("");
    setSituacao("ativos");
  };

  if (semNenhumCliente) {
    return <EstadoVazio icone={UserRoundPlus}>Nenhum cliente cadastrado ainda.</EstadoVazio>;
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
              placeholder="Apelido, razão social, CNPJ, cidade ou e-mail"
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
              { valor: "ativos", rotulo: "Ativos" },
              { valor: "inativos", rotulo: "Inativos" },
              { valor: "todos", rotulo: "Todos" },
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
          icone={Users}
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
            ? "Nenhum cliente inativo. Um cliente fica inativo pela ficha dele."
            : "Nenhum cliente corresponde ao que você procurou."}
        </EstadoVazio>
      ) : (
        <Cartao
          className={`divide-y divide-filete overflow-hidden ${entrando ? "palco" : "palco-curto"}`}
        >
          {linhas.map((cliente: ClienteDaLista) => (
            <LinhaLista key={cliente.id} href={`/clientes/${cliente.id}`}>
              {/* Neutro, e não azul: o carimbo marca o que aconteceu com um
                  pedido. Gastá-lo numa inicial de cliente esvaziaria o sinal. */}
              <Avatar nome={cliente.apelido} />

              <CorpoLinha
                titulo={
                  <span className="inline-flex items-center gap-2">
                    {cliente.apelido}
                    {!cliente.ativo && <Selo tom="cancelado">Inativo</Selo>}
                  </span>
                }
                detalhe={cliente.razaoSocial}
              />

              <FimDaLinha>
                <ValorLinha
                  className="w-44"
                  valor={cliente.cnpj || <span className="text-tinta-3">sem CNPJ</span>}
                  nota={
                    <>
                      {cliente.local || "—"}
                      {cliente.pedidos > 0 && ` · ${cliente.pedidos} pedido(s)`}
                    </>
                  }
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
