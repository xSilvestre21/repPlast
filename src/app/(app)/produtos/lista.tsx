"use client";

/**
 * A lista de produtos: busca enquanto digita, sem navegar e sem piscar.
 *
 * Gêmea de `../clientes/lista.tsx`, `../pedidos/lista.tsx` e
 * `../orcamentos/lista.tsx` — as razões estão escritas por extenso lá. O
 * resumo: o servidor desenha a primeira fatia, daí em diante é esta lista que
 * pede as seguintes a `/produtos/busca`, a busca anterior é abortada a cada
 * tecla, as linhas atuais ficam na tela até as novas chegarem, e a URL continua
 * contando a verdade por `replaceState`.
 *
 * O filtro por MEDIDA existe porque é assim que se procura um saco: ninguém
 * lembra a descrição inteira, lembra "aquele de 90 por 160". O sistema
 * anterior tinha esse filtro num cartão próprio, e era o caminho mais usado
 * para achar produto num catálogo de 444.
 */

import {
  CircleDot,
  Disc3,
  Layers,
  Loader2,
  Package,
  PackagePlus,
  Search,
  ShoppingBag,
  X,
  type LucideIcon,
} from "lucide-react";
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
  formatarMoeda,
} from "@/components/ui";

import type {
  CampoMedida,
  FatiaDeProdutos,
  FiltroSituacaoProduto,
  FiltrosProduto,
} from "./consulta";

/** O tempo entre a última tecla e a ida ao servidor. */
const ESPERA_MS = 250;

const ROTULO_FAMILIA: Record<string, string> = {
  SACO: "Saco plástico",
  FITA: "Fita",
  STRETCH: "Stretch",
  BOBINA: "Bobina",
  AVULSO: "Avulso",
};

/**
 * Um ícone por família.
 *
 * A descrição gerada é uma sequência de medidas, e num catálogo longo todas se
 * parecem. O ícone dá à linha uma forma reconhecível antes de o olho começar a
 * ler números.
 */
const ICONE_FAMILIA: Record<string, LucideIcon> = {
  SACO: ShoppingBag,
  FITA: CircleDot,
  STRETCH: Layers,
  BOBINA: Disc3,
};

const MEDIDAS = [
  { campo: "larguraCm", rotulo: "Largura", unidade: "cm", exemplo: "90" },
  { campo: "comprimentoCm", rotulo: "Comprimento", unidade: "cm", exemplo: "160" },
  { campo: "espessuraMm", rotulo: "Espessura", unidade: "mm", exemplo: "0,055" },
] as const;

const SEM_FILTRO: FiltrosProduto = {
  busca: "",
  larguraCm: "",
  comprimentoCm: "",
  espessuraMm: "",
  situacao: "ativos",
};

/** Os filtros em parâmetros de URL, só os que valem alguma coisa. */
function parametros(filtros: FiltrosProduto) {
  const resultado = new URLSearchParams();
  if (filtros.busca.trim()) resultado.set("busca", filtros.busca.trim());
  if (filtros.larguraCm.trim()) resultado.set("l", filtros.larguraCm.trim());
  if (filtros.comprimentoCm.trim()) resultado.set("c", filtros.comprimentoCm.trim());
  if (filtros.espessuraMm.trim()) resultado.set("e", filtros.espessuraMm.trim());
  if (filtros.situacao !== "ativos") resultado.set("situacao", filtros.situacao);
  return resultado;
}

function endereco(filtros: FiltrosProduto) {
  const consulta = parametros(filtros).toString();
  return consulta ? `/produtos?${consulta}` : "/produtos";
}

export function ListaProdutos({
  inicial,
  filtrosIniciais,
  semNenhumProduto,
}: {
  inicial: FatiaDeProdutos;
  filtrosIniciais: FiltrosProduto;
  /** O escritório não tem produto nenhum — nem ativo, nem inativo. */
  semNenhumProduto: boolean;
}) {
  const [filtros, setFiltros] = useState(filtrosIniciais);

  /*
   * A medida com o foco casa pelo COMEÇO: o "1" do comprimento é o começo de
   * 110 e de 15, não um saco de um centímetro. Sair do campo devolve o valor
   * exato — é aí, e só aí, que "nada encontrado" quer dizer que não existe.
   * Campo vazio não conta, para que só entrar nele não refaça a busca.
   */
  const [comFoco, setComFoco] = useState<CampoMedida | null>(null);
  const digitando = comFoco && filtros[comFoco].trim() ? comFoco : null;

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

  const buscarFatia = useCallback(async (alvo: FiltrosProduto & { pagina: number }) => {
    emVoo.current?.abort();
    const controle = new AbortController();
    emVoo.current = controle;

    setBuscando(true);
    try {
      const consulta = parametros(alvo);
      if (alvo.digitando) consulta.set("digitando", alvo.digitando);
      consulta.set("pagina", String(alvo.pagina));

      const resposta = await fetch(`/produtos/busca?${consulta}`, { signal: controle.signal });
      if (!resposta.ok) return;

      const fatia: FatiaDeProdutos = await resposta.json();

      setLinhas((atuais) => (alvo.pagina === 0 ? fatia.linhas : [...atuais, ...fatia.linhas]));
      setTemMais(fatia.temMais);
      setPagina(alvo.pagina);
    } catch (erro) {
      // Abortar é o caminho normal: a pessoa digitou de novo antes da resposta.
      if ((erro as Error)?.name !== "AbortError") throw erro;
    } finally {
      if (emVoo.current === controle) setBuscando(false);
    }
  }, []);

  // Primeira renderização não busca: a fatia inicial já veio do servidor.
  const primeira = useRef(true);

  useEffect(() => {
    if (primeira.current) {
      primeira.current = false;
      return;
    }

    window.history.replaceState(null, "", endereco(filtros));

    const espera = setTimeout(() => {
      void buscarFatia({ ...filtros, digitando, pagina: 0 });
    }, ESPERA_MS);

    return () => clearTimeout(espera);
  }, [filtros, digitando, buscarFatia]);

  /* A sentinela: encostou na janela, a fatia seguinte é pedida. */
  useEffect(() => {
    const alvo = fim.current;
    if (!alvo || !temMais || buscando) return;

    const observador = new IntersectionObserver(
      (entradas) => {
        if (entradas[0]?.isIntersecting) {
          void buscarFatia({ ...filtros, digitando, pagina: pagina + 1 });
        }
      },
      { rootMargin: "400px" },
    );

    observador.observe(alvo);
    return () => observador.disconnect();
  }, [temMais, buscando, pagina, filtros, digitando, buscarFatia]);

  const mudar = <C extends keyof FiltrosProduto>(campo: C, valor: FiltrosProduto[C]) =>
    setFiltros((atuais) => ({ ...atuais, [campo]: valor }));

  const algumFiltro = parametros(filtros).size > 0;
  const limpar = () => setFiltros(SEM_FILTRO);

  if (semNenhumProduto) {
    return (
      <EstadoVazio icone={PackagePlus} titulo="Nenhum produto cadastrado">
        Cadastre a indústria primeiro, depois volte aqui.
      </EstadoVazio>
    );
  }

  return (
    <>
      <div className="folha p-4 sm:p-5 mb-5 space-y-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
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
                value={filtros.busca}
                onChange={(evento) => mudar("busca", evento.target.value)}
                placeholder="Descrição, material, cliente, indústria ou código"
                className={`${CLASSE_CONTROLE} pl-10`}
              />
            </div>
          </label>

          <fieldset className="min-w-0">
            <legend className="rotulo block mb-1.5 text-tinta-2">Medidas do saco</legend>
            <div className="grid grid-cols-3 gap-2 lg:w-96">
              {MEDIDAS.map((medida) => (
                <div key={medida.campo} className="relative">
                  <input
                    inputMode="decimal"
                    autoComplete="off"
                    aria-label={`${medida.rotulo} (${medida.unidade})`}
                    title={medida.rotulo}
                    value={filtros[medida.campo]}
                    onChange={(evento) => mudar(medida.campo, evento.target.value)}
                    onFocus={() => setComFoco(medida.campo)}
                    onBlur={() => setComFoco(null)}
                    placeholder={medida.exemplo}
                    className={`${CLASSE_CONTROLE} numerico text-right pr-10`}
                  />
                  <span
                    aria-hidden="true"
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-mini text-tinta-3 pointer-events-none"
                  >
                    {medida.unidade}
                  </span>
                </div>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Segmentado
            nome="Situação"
            atual={filtros.situacao}
            aoEscolher={(valor: FiltroSituacaoProduto) => mudar("situacao", valor)}
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
          icone={Package}
          titulo="Nada encontrado"
          acao={
            algumFiltro ? (
              <Botao variante="secundaria" tamanho="compacto" onClick={limpar}>
                Limpar filtro
              </Botao>
            ) : undefined
          }
        >
          Nenhum produto corresponde ao que você procurou.
        </EstadoVazio>
      ) : (
        <Cartao
          className={`divide-y divide-filete overflow-hidden ${entrando ? "palco" : "palco-curto"}`}
        >
          {linhas.map((produto) => (
            <LinhaLista key={produto.id} href={`/produtos/${produto.id}`}>
              <Emblema
                icone={ICONE_FAMILIA[produto.familia] ?? Package}
                tom="fraco"
                className="size-4"
              />

              <CorpoLinha
                className="font-mono"
                titulo={produto.descricao}
                detalhe={
                  <span className="font-sans">
                    {/* O cliente vem PRIMEIRO: é ele que desempata as linhas
                        de descrição idêntica. */}
                    {produto.cliente ?? "sem cliente"}
                    {" · "}
                    {produto.fornecedor}
                    {" · "}
                    {ROTULO_FAMILIA[produto.familia] ?? produto.familia}
                    {produto.codigoFornecedor && ` · cód. ${produto.codigoFornecedor}`}
                    {produto.codigoCliente && ` · cli. ${produto.codigoCliente}`}
                  </span>
                }
              />

              <FimDaLinha>
                {!produto.ativo && <Selo tom="cancelado">Inativo</Selo>}
                {produto.preco && (
                  <ValorLinha
                    className="w-32"
                    valor={formatarMoeda(produto.preco.valor)}
                    nota={`por ${produto.preco.unidade}`}
                  />
                )}
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
