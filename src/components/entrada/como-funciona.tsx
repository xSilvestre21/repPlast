"use client";

/**
 * "Como funciona": o caminho do sistema em seis etapas, com uma demonstração
 * que FAZ a conta em vez de descrevê-la.
 *
 * Nada aqui é conta reinventada para a vitrine. O preço sai de `precoUnitario`
 * (o mesmo do item de pedido), a descrição de `descricao.ts`, os totais com IPI
 * de `calcularTotaisPedido`, o e-mail do modelo padrão de envio, o nome do
 * anexo de `nomeArquivoPedido` e o rateio de `ratearComissao`. É isso que
 * sustenta a promessa do título ("sem recalcular nada"): quem troca o saco
 * pela fita, ou mexe numa medida, vê o pedido, o e-mail e a comissão mudarem
 * juntos nas etapas seguintes.
 *
 * As etapas avançam sozinhas, o tempo todo — é a demonstração rodando. Pausa
 * só enquanto a pessoa está USANDO (clicou numa etapa, mexe numa régua) e
 * retoma sozinha `RETOMAR_MS` depois do último toque. Já pausou com o
 * ponteiro em cima, e isso lia como travado: quem lê com o mouse por ali via a
 * tela parada. E já parou de vez depois do primeiro clique — a demo morria.
 *
 * Só conta enquanto a seção está na tela e a aba à vista: quem rola até aqui
 * pega a demonstração andando dali em diante, e não uma que correu sozinha
 * fora da vista.
 *
 * O tempo de cada etapa é a animação CSS da barrinha (`.etapa-progresso`): o
 * fim dela é o que avança. Pausar é só congelar a animação; e com as animações
 * desligadas na conta ela não roda, e o avanço automático some junto.
 */

import Decimal from "decimal.js";
import {
  BadgePercent,
  BarChart3,
  Calculator,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FileText,
  Mail,
  Package,
  Paperclip,
  Send,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";

import { Segmentado } from "@/components/ui";
import { comissaoDoPedido, ratearComissao } from "@/lib/comissao";
import { descricaoFita, descricaoRolo, descricaoSaco, formatarNumero } from "@/lib/descricao";
import { textoPadraoDoEnvio } from "@/lib/envio-pedido";
import { nomeArquivoPedido } from "@/lib/pdf/nome-arquivo";
import { arredondarDinheiro, DENSIDADE_PADRAO, pesoMilheiroKg } from "@/lib/precificacao";
import { precoUnitario, type ProdutoPrecificavel, type UnidadeVenda } from "@/lib/produto-preco";
import { calcularTotaisPedido } from "@/lib/totais";

const SUAVE = [0.22, 1, 0.36, 1] as const;

/** Quanto tempo depois do último toque a demonstração volta a andar sozinha. */
const RETOMAR_MS = 8000;

/**
 * Fator dos atrasos da cascata dentro de cada quadro. Em 1, o último item de
 * uma etapa só chegava quase um segundo depois da troca, e a soma das esperas
 * deixava a demo com cara de lenta.
 */
const CASCATA = 0.5;

const MOEDA = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const NUMERO = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

function reais(valor: Decimal.Value): string {
  return MOEDA.format(arredondarDinheiro(valor).toNumber());
}

/* -------------------------------------------------------------------------- */
/* O exemplo                                                                  */
/* -------------------------------------------------------------------------- */

/*
 * Valores de exemplo, plausíveis para o ramo. No sistema eles vêm do cadastro
 * de cada indústria e produto.
 */
const FATOR_SACO = "14.5";
const PRECO_STRETCH_KG = "16.9";
/** Preço do rolo de fita por metragem — a "tabela da indústria" da vitrine. */
const PRECO_FITA = { "50": "2.6", "100": "4.2" } as const;
/** Fita mais larga custa um pouco mais por rolo. */
const ACRESCIMO_FITA_48 = "0.3";
/**
 * Rolos por caixa do exemplo. Não é regra do sistema: quantos rolos vêm na
 * caixa fechada é o representante quem cadastra, produto a produto — por isso
 * na demonstração é uma régua, e não um número fixo.
 */
const FITAS_POR_CAIXA = 36;
const IPI = "3.25";
const PERCENTUAL_COMISSAO = "3";
/** Fatia da preposta, em percentual DA COMISSÃO — como no cadastro do preposto. */
const FATIA_PREPOSTA = "40";
/** Data fixa: a página é desenhada no servidor, e `new Date()` mudaria entre ele e o navegador. */
const ENTREGA = new Date(Date.UTC(2026, 9, 24));

const QUANTIDADE: Record<UnidadeVenda, number> = { MIL: 20, KG: 300, CX: 40, UN: 200 };

const NOME_UNIDADE: Record<UnidadeVenda, { plural: string; sufixo: string; preco: string }> = {
  MIL: { plural: "milheiros", sufixo: "/milheiro", preco: "Preço do milheiro" },
  KG: { plural: "kg", sufixo: "/kg", preco: "Preço do quilo" },
  CX: { plural: "caixas", sufixo: "/caixa", preco: "Preço da caixa" },
  UN: { plural: "unidades", sufixo: "/un", preco: "Preço da unidade" },
};

type CodigoProduto = "SACO" | "STRETCH" | "FITA";

const PRODUTOS: { codigo: CodigoProduto; nome: string; vende: string }[] = [
  { codigo: "SACO", nome: "Saco", vende: "por milheiro ou por quilo" },
  { codigo: "STRETCH", nome: "Stretch", vende: "por quilo" },
  { codigo: "FITA", nome: "Fita", vende: "por caixa ou por unidade" },
];

interface Estado {
  produto: CodigoProduto;
  saco: { largura: number; comprimento: number; espessura: number; unidade: "MIL" | "KG" };
  stretch: { largura: "450" | "500"; micragem: number };
  fita: { largura: "45" | "48"; metragem: "50" | "100"; unidade: "CX" | "UN"; porCaixa: number };
}

const INICIAL: Estado = {
  produto: "SACO",
  saco: { largura: 40, comprimento: 60, espessura: 0.1, unidade: "MIL" },
  stretch: { largura: "500", micragem: 25 },
  fita: { largura: "45", metragem: "100", unidade: "CX", porCaixa: FITAS_POR_CAIXA },
};

/**
 * O estado com todos os campos, por produto.
 *
 * Campo novo no exemplo (como os rolos por caixa) não existe no estado que o
 * hot reload preserva entre edições; sem completar, ele chegaria `undefined`
 * e o `Decimal` derrubaria a página.
 */
function completar(estado: Estado): Estado {
  return {
    produto: estado.produto,
    saco: { ...INICIAL.saco, ...estado.saco },
    stretch: { ...INICIAL.stretch, ...estado.stretch },
    fita: { ...INICIAL.fita, ...estado.fita },
  };
}

interface Linha {
  rotulo: string;
  valor: string;
}

interface ItemExemplo {
  descricao: string;
  unidade: UnidadeVenda;
  quantidade: number;
  preco: Decimal;
}

function fitaPrecificavel(
  largura: "45" | "48",
  metragem: "50" | "100",
  porCaixa: number,
): ProdutoPrecificavel {
  const base = new Decimal(PRECO_FITA[metragem]);
  return {
    familia: "FITA",
    precoUnidade: largura === "48" ? base.plus(ACRESCIMO_FITA_48) : base,
    unidadesPorCaixa: porCaixa,
  };
}

function descricaoDaFita(largura: string, metragem: string) {
  return descricaoFita({
    material: "Fita adesiva",
    larguraMm: largura,
    metragemM: metragem,
    complemento: "transparente",
  });
}

/**
 * Tudo o que as etapas mostram, a partir do que a pessoa escolheu.
 *
 * Uma função só, para as seis etapas lerem do mesmo lugar: a etapa do pedido
 * não tem como mostrar um preço diferente do da etapa do cálculo.
 */
function montarExemplo(estado: Estado) {
  let produto: ProdutoPrecificavel;
  let unidade: UnidadeVenda;
  let descricao: string;
  let conta: Linha[];

  if (estado.produto === "SACO") {
    const { largura, comprimento, espessura } = estado.saco;
    unidade = estado.saco.unidade;
    produto = {
      familia: "SACO",
      larguraCm: largura,
      comprimentoCm: comprimento,
      espessuraMm: espessura,
      fatorKg: FATOR_SACO,
    };
    descricao = descricaoSaco({
      larguraCm: largura,
      comprimentoCm: comprimento,
      espessuraMm: espessura,
      material: "PEAD",
    });

    const peso = pesoMilheiroKg({ larguraCm: largura, comprimentoCm: comprimento, espessuraMm: espessura });
    conta =
      unidade === "MIL"
        ? [
            {
              rotulo: "Largura × comprimento × espessura",
              valor: `${largura} × ${comprimento} × ${formatarNumero(espessura, 2)}`,
            },
            { rotulo: "× densidade do material", valor: formatarNumero(DENSIDADE_PADRAO) },
            { rotulo: "= peso do milheiro", valor: `${NUMERO.format(peso.toNumber())} kg` },
            { rotulo: "× fator da indústria", valor: `${reais(FATOR_SACO)}/kg` },
          ]
        : [
            { rotulo: "Vendido por quilo", valor: "sem conta de peso" },
            { rotulo: "O preço do kg é o fator da indústria", valor: `${reais(FATOR_SACO)}/kg` },
          ];
  } else if (estado.produto === "STRETCH") {
    const { largura, micragem } = estado.stretch;
    unidade = "KG";
    produto = { familia: "STRETCH", precoKg: PRECO_STRETCH_KG };
    descricao = descricaoRolo({ material: "FILM STRETCH", larguraMm: largura, micragem });
    conta = [
      { rotulo: `Bobina de ${largura} mm, ${micragem} micras`, valor: "vendida por quilo" },
      { rotulo: "Preço do kg na tabela da indústria", valor: `${reais(PRECO_STRETCH_KG)}/kg` },
    ];
  } else {
    const { largura, metragem, porCaixa } = estado.fita;
    unidade = estado.fita.unidade;
    produto = fitaPrecificavel(largura, metragem, porCaixa);
    descricao = descricaoDaFita(largura, metragem);

    const precoRolo = new Decimal(produto.precoUnidade!);
    conta =
      unidade === "CX"
        ? [
            { rotulo: "Preço do rolo na tabela da indústria", valor: reais(precoRolo) },
            { rotulo: "× rolos por caixa (você cadastra)", valor: String(porCaixa) },
          ]
        : [
            { rotulo: "Vendida por unidade (rolo avulso)", valor: "sem caixa fechada" },
            { rotulo: "Preço do rolo na tabela da indústria", valor: reais(precoRolo) },
          ];
  }

  const preco = precoUnitario(produto, unidade) ?? new Decimal(0);
  const quantidade = QUANTIDADE[unidade];

  // O segundo item é de outra família — pedido de uma linha só não parece pedido.
  const outro: ItemExemplo =
    estado.produto === "FITA"
      ? {
          descricao: descricaoSaco({ larguraCm: 30, comprimentoCm: 40, espessuraMm: 0.08, material: "PEAD" }),
          unidade: "MIL",
          quantidade: 15,
          preco:
            precoUnitario(
              { familia: "SACO", larguraCm: 30, comprimentoCm: 40, espessuraMm: 0.08, fatorKg: FATOR_SACO },
              "MIL",
            ) ?? new Decimal(0),
        }
      : {
          descricao: descricaoDaFita("48", "100"),
          unidade: "CX",
          quantidade: 10,
          preco: precoUnitario(fitaPrecificavel("48", "100", FITAS_POR_CAIXA), "CX") ?? new Decimal(0),
        };

  const itens: ItemExemplo[] = [{ descricao, unidade, quantidade, preco }, outro];
  const totais = calcularTotaisPedido(
    itens.map((item) => ({ precoUnitario: item.preco, quantidade: item.quantidade })),
    IPI,
  );

  // A comissão é sobre a mercadoria: o IPI é imposto, não venda.
  const base = totais.subtotalSemIpi;
  const comissao = comissaoDoPedido(base, PERCENTUAL_COMISSAO);
  const rateio = ratearComissao(base, PERCENTUAL_COMISSAO, FATIA_PREPOSTA);

  const email = textoPadraoDoEnvio({
    numero: 2254,
    razaoSocialCliente: "EMBALAGENS EXEMPLO LTDA",
    cnpjCliente: "12.345.678/0001-90",
    pedidoDoCliente: "4512",
    vendedor: "Ana Souza",
  });
  const anexo = nomeArquivoPedido({
    numero: 2254,
    apelidoCliente: "EXEMPLO",
    pedidoDoCliente: "4512",
    prazoEntrega: ENTREGA,
  });

  return { unidade, descricao, conta, preco, quantidade, itens, totais, base, comissao, rateio, email, anexo };
}

type Exemplo = ReturnType<typeof montarExemplo>;

/* -------------------------------------------------------------------------- */
/* As etapas                                                                  */
/* -------------------------------------------------------------------------- */

interface Etapa {
  titulo: string;
  resumo: string;
  icone: LucideIcon;
}

const ETAPAS: Etapa[] = [
  {
    titulo: "Produto",
    resumo: "Saco por milheiro ou kg, stretch por kg, fita por caixa ou unidade.",
    icone: Package,
  },
  {
    titulo: "Preço",
    resumo: "A conta de cada unidade de venda, feita sozinha. Sem planilha.",
    icone: Calculator,
  },
  {
    titulo: "Pedido",
    resumo: "Os itens somam sozinhos, com IPI item a item.",
    icone: ClipboardList,
  },
  {
    titulo: "PDF e e-mail",
    resumo: "Mensagem pronta, PDF anexado e nomeado, enviado daqui mesmo.",
    icone: Mail,
  },
  {
    titulo: "Comissão",
    resumo: "No Solo é toda sua; no Max, rateada com o preposto.",
    icone: BadgePercent,
  },
  {
    titulo: "Gráficos",
    resumo: "Mês a mês, por indústria, por cliente — e quem parou de comprar.",
    icone: BarChart3,
  },
];

export function ComoFunciona() {
  const [ativa, setAtiva] = useState(0);
  const [estado, setEstado] = useState<Estado>(INICIAL);
  /** A pessoa está mexendo — volta a `false` sozinho, `RETOMAR_MS` depois. */
  const [usando, setUsando] = useState(false);
  const [aVista, setAVista] = useState(false);
  /** Muda a cada clique numa etapa: a barrinha recomeça do zero. */
  const [volta, setVolta] = useState(0);

  const raiz = useRef<HTMLDivElement>(null);
  const relogioRetomar = useRef<ReturnType<typeof setTimeout>>(undefined);

  const completo = useMemo(() => completar(estado), [estado]);
  const exemplo = useMemo(() => montarExemplo(completo), [completo]);
  const base = useId();

  // Na tela e com a aba visível: só aí a demonstração anda.
  useEffect(() => {
    const elemento = raiz.current;
    if (!elemento) return;

    let naTela = false;
    const acertar = () => setAVista(naTela && document.visibilityState === "visible");

    const observador = new IntersectionObserver(
      ([entrada]) => {
        naTela = entrada.isIntersecting;
        acertar();
      },
      { threshold: 0.35 },
    );
    observador.observe(elemento);
    document.addEventListener("visibilitychange", acertar);

    return () => {
      observador.disconnect();
      document.removeEventListener("visibilitychange", acertar);
    };
  }, []);

  useEffect(() => () => clearTimeout(relogioRetomar.current), []);

  /** Pausa enquanto a pessoa usa; cada toque empurra a retomada para depois. */
  function interagiu() {
    setUsando(true);
    clearTimeout(relogioRetomar.current);
    relogioRetomar.current = setTimeout(() => setUsando(false), RETOMAR_MS);
  }

  function escolher(indice: number) {
    interagiu();
    setAtiva(indice);
    setVolta((v) => v + 1);
  }

  function mudar(atualizar: (atual: Estado) => Estado) {
    interagiu();
    setEstado(atualizar);
  }

  const andando = aVista && !usando;

  return (
    <div
      ref={raiz}
      className="grid gap-6 lg:grid-cols-[minmax(0,20rem)_1fr] lg:gap-10 items-start"
    >
      {/* As etapas: lista de abas, à esquerda no computador e em fila no celular. */}
      <div
        role="tablist"
        aria-label="Etapas do RepPlast"
        aria-orientation="vertical"
        className="flex lg:flex-col gap-2 overflow-x-auto rolagem-limpa -mx-4 px-4 lg:mx-0 lg:px-0 pb-1"
      >
        {ETAPAS.map((etapa, i) => {
          const selecionada = i === ativa;
          const Icone = etapa.icone;

          return (
            <button
              key={etapa.titulo}
              type="button"
              role="tab"
              id={`${base}-aba-${i}`}
              aria-selected={selecionada}
              aria-controls={`${base}-quadro`}
              onClick={() => escolher(i)}
              className={`relative shrink-0 lg:shrink text-left rounded-[var(--radius-folha)]
                px-4 py-3 cursor-pointer transition-colors duration-200 overflow-hidden
                min-w-[11rem] lg:min-w-0 ${
                  selecionada
                    ? "bg-folha shadow-folha border border-filete"
                    : "border border-transparent hover:bg-folha/60"
                }`}
            >
              <span className="flex items-center gap-3">
                <span
                  className={`relative alvo-toque grid place-items-center size-8 rounded-full transition-colors ${
                    selecionada ? "bg-tinta text-papel" : "bg-folha-2 text-tinta-2"
                  }`}
                  aria-hidden="true"
                >
                  <Icone size={15} strokeWidth={2} />
                </span>
                <span className="min-w-0">
                  <span className="block text-realce font-semibold text-tinta whitespace-nowrap">
                    <span className="text-tinta-3 font-medium mr-1.5 numerico">{i + 1}</span>
                    {etapa.titulo}
                  </span>
                  <span
                    className={`hidden lg:block text-rotulo text-tinta-2 leading-snug transition-[max-height,opacity] duration-300 overflow-hidden ${
                      selecionada ? "max-h-16 opacity-100 mt-1" : "max-h-0 opacity-0"
                    }`}
                  >
                    {etapa.resumo}
                  </span>
                </span>
              </span>

              {/* O relógio da etapa: quando a barra enche, a próxima entra. */}
              {selecionada && (
                <span
                  key={`${ativa}-${volta}`}
                  aria-hidden="true"
                  className={`etapa-progresso absolute left-0 bottom-0 h-0.5 w-full origin-left transition-colors ${
                    andando ? "bg-carimbo" : "bg-tinta-3/50"
                  }`}
                  style={{ animationPlayState: andando ? "running" : "paused" }}
                  onAnimationEnd={() => setAtiva((atual) => (atual + 1) % ETAPAS.length)}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* O quadro da etapa. */}
      <div
        id={`${base}-quadro`}
        role="tabpanel"
        aria-labelledby={`${base}-aba-${ativa}`}
        className="folha folha-marcada p-5 sm:p-7 min-h-[27rem] relative overflow-hidden"
      >
        <p className="lg:hidden text-corpo text-tinta-2 mb-4">{ETAPAS[ativa].resumo}</p>

        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={ativa}
            // Só opacidade e deslocamento: um `filter: blur` aqui obrigava o
            // quadro inteiro a repintar a cada passo da troca.
            // A saída é mais curta que a entrada: o `wait` espera ela acabar, e
            // cada milissegundo dela é quadro em branco entre uma etapa e outra.
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, transition: { duration: 0.25, ease: SUAVE } }}
            exit={{ opacity: 0, y: -6, transition: { duration: 0.12, ease: "easeIn" } }}
          >
            {ativa === 0 && <QuadroProduto estado={completo} exemplo={exemplo} mudar={mudar} />}
            {ativa === 1 && <QuadroPreco exemplo={exemplo} />}
            {ativa === 2 && <QuadroPedido exemplo={exemplo} />}
            {ativa === 3 && <QuadroEnvio exemplo={exemplo} />}
            {ativa === 4 && <QuadroComissao exemplo={exemplo} aoInteragir={interagiu} />}
            {ativa === 5 && <QuadroGraficos exemplo={exemplo} />}
          </m.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Peças                                                                      */
/* -------------------------------------------------------------------------- */

function Rotulo({ children }: { children: ReactNode }) {
  return <p className="rotulo mb-3">{children}</p>;
}

function Regua({
  rotulo,
  unidade,
  valor,
  min,
  max,
  passo,
  casas = 0,
  aoMudar,
}: {
  rotulo: string;
  unidade: string;
  valor: number;
  min: number;
  max: number;
  passo: number;
  casas?: number;
  aoMudar: (valor: number) => void;
}) {
  const id = useId();

  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <label htmlFor={id} className="text-rotulo font-medium text-tinta-2">
          {rotulo}
        </label>
        <span className="text-realce font-semibold text-tinta numerico">
          {Number.isFinite(valor) ? formatarNumero(valor, casas) : "—"}{" "}
          <span className="text-tinta-3 font-normal">{unidade}</span>
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={passo}
        value={valor}
        onChange={(e) => aoMudar(Number(e.currentTarget.value))}
        className="regua w-full"
      />
    </div>
  );
}

function Opcoes<T extends string>({
  rotulo,
  opcoes,
  atual,
  aoEscolher,
}: {
  rotulo: string;
  opcoes: { valor: T; rotulo: string }[];
  atual: T;
  aoEscolher: (valor: T) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 flex-wrap">
      <span className="text-rotulo font-medium text-tinta-2">{rotulo}</span>
      <Segmentado nome={rotulo} opcoes={opcoes} atual={atual} aoEscolher={aoEscolher} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 1 · Produto                                                                */
/* -------------------------------------------------------------------------- */

type Mudar = (atualizar: (atual: Estado) => Estado) => void;

function QuadroProduto({ estado, exemplo, mudar }: { estado: Estado; exemplo: Exemplo; mudar: Mudar }) {
  const indice = PRODUTOS.findIndex((p) => p.codigo === estado.produto);
  // Para onde o quadro desliza: a seta da direita traz o próximo pela direita.
  const [direcao, setDirecao] = useState(1);

  function irPara(alvo: number, sentido: 1 | -1) {
    setDirecao(sentido);
    const indiceNovo = (alvo + PRODUTOS.length) % PRODUTOS.length;
    mudar((atual) => ({ ...atual, produto: PRODUTOS[indiceNovo].codigo }));
  }

  const produto = PRODUTOS[indice];

  return (
    <div className="flex flex-col min-h-[23rem]">
      <div className="flex items-baseline justify-between gap-3 mb-4 flex-wrap">
        <p className="rotulo">Medidas de exemplo — mexa à vontade</p>
        <p className="text-mini text-tinta-3">
          {produto.nome} se vende <strong className="text-tinta-2">{produto.vende}</strong>
        </p>
      </div>

      <div className="relative flex-1">
        <AnimatePresence mode="wait" initial={false} custom={direcao}>
          <m.div
            key={estado.produto}
            custom={direcao}
            variants={{
              entra: (d: number) => ({ opacity: 0, x: 40 * d }),
              fica: { opacity: 1, x: 0 },
              sai: (d: number) => ({ opacity: 0, x: -40 * d }),
            }}
            initial="entra"
            animate="fica"
            exit="sai"
            transition={{ duration: 0.3, ease: SUAVE }}
            className="grid sm:grid-cols-[1fr_auto] gap-6 sm:gap-8 items-center"
          >
            <div className="space-y-5 min-w-0">
              {estado.produto === "SACO" && <ControlesSaco estado={estado} mudar={mudar} />}
              {estado.produto === "STRETCH" && <ControlesStretch estado={estado} mudar={mudar} />}
              {estado.produto === "FITA" && <ControlesFita estado={estado} mudar={mudar} />}
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="grid place-items-center size-40" aria-hidden="true">
                {estado.produto === "SACO" && <DesenhoSaco estado={estado} />}
                {estado.produto === "STRETCH" && <DesenhoBobina estado={estado} />}
                {estado.produto === "FITA" && <DesenhoFita estado={estado} />}
              </div>
              <p className="text-mini text-tinta-3 text-center max-w-[12rem]">{exemplo.descricao}</p>
              <p className="text-corpo text-tinta-2 text-center">
                {NOME_UNIDADE[exemplo.unidade].preco}:{" "}
                <span className="font-semibold text-tinta numerico">{reais(exemplo.preco)}</span>
              </p>
            </div>
          </m.div>
        </AnimatePresence>
      </div>

      {/* A troca de produto: setas e bolinhas com nome, embaixo do quadro. */}
      <div className="mt-6 pt-4 border-t border-filete flex items-center justify-between gap-2">
        <BotaoSeta direcao="anterior" aoClicar={() => irPara(indice - 1, -1)} />
        <div className="flex items-center gap-1" role="group" aria-label="Produto do exemplo">
          {PRODUTOS.map((p, i) => (
            <button
              key={p.codigo}
              type="button"
              aria-pressed={i === indice}
              onClick={() => irPara(i, i >= indice ? 1 : -1)}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-mini font-semibold cursor-pointer transition-colors ${
                i === indice ? "bg-tinta text-papel" : "text-tinta-2 hover:text-tinta hover:bg-folha-2"
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${i === indice ? "bg-papel" : "bg-tinta-3"}`}
                aria-hidden="true"
              />
              {p.nome}
            </button>
          ))}
        </div>
        <BotaoSeta direcao="proximo" aoClicar={() => irPara(indice + 1, 1)} />
      </div>
    </div>
  );
}

function BotaoSeta({ direcao, aoClicar }: { direcao: "anterior" | "proximo"; aoClicar: () => void }) {
  const Icone = direcao === "anterior" ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      onClick={aoClicar}
      aria-label={direcao === "anterior" ? "Produto anterior" : "Próximo produto"}
      className="grid place-items-center size-9 shrink-0 rounded-full border border-filete-forte text-tinta cursor-pointer transition-all hover:bg-folha-2 active:scale-95"
    >
      <Icone size={17} strokeWidth={2.25} aria-hidden="true" />
    </button>
  );
}

function ControlesSaco({ estado, mudar }: { estado: Estado; mudar: Mudar }) {
  const saco = estado.saco;
  const alterar = (parte: Partial<Estado["saco"]>) =>
    mudar((atual) => ({ ...atual, saco: { ...atual.saco, ...parte } }));

  return (
    <>
      <Opcoes
        rotulo="Vender por"
        opcoes={[
          { valor: "MIL", rotulo: "Milheiro" },
          { valor: "KG", rotulo: "Quilo" },
        ]}
        atual={saco.unidade}
        aoEscolher={(unidade) => alterar({ unidade })}
      />
      <Regua
        rotulo="Largura"
        unidade="cm"
        valor={saco.largura}
        min={20}
        max={80}
        passo={1}
        aoMudar={(largura) => alterar({ largura })}
      />
      <Regua
        rotulo="Comprimento"
        unidade="cm"
        valor={saco.comprimento}
        min={30}
        max={100}
        passo={1}
        aoMudar={(comprimento) => alterar({ comprimento })}
      />
      <Regua
        rotulo="Espessura"
        unidade="mm"
        valor={saco.espessura}
        min={0.04}
        max={0.2}
        passo={0.01}
        casas={2}
        aoMudar={(v) => alterar({ espessura: Number(v.toFixed(2)) })}
      />
    </>
  );
}

function ControlesStretch({ estado, mudar }: { estado: Estado; mudar: Mudar }) {
  const stretch = estado.stretch;
  const alterar = (parte: Partial<Estado["stretch"]>) =>
    mudar((atual) => ({ ...atual, stretch: { ...atual.stretch, ...parte } }));

  return (
    <>
      <Opcoes
        rotulo="Largura da bobina"
        opcoes={[
          { valor: "450", rotulo: "450 mm" },
          { valor: "500", rotulo: "500 mm" },
        ]}
        atual={stretch.largura}
        aoEscolher={(largura) => alterar({ largura })}
      />
      <Regua
        rotulo="Espessura"
        unidade="micras"
        valor={stretch.micragem}
        min={18}
        max={30}
        passo={1}
        aoMudar={(micragem) => alterar({ micragem })}
      />
      <p className="text-corpo text-tinta-2 leading-relaxed rounded-[var(--radius-suave)] bg-folha-2 px-4 py-3">
        Stretch se vende <strong className="text-tinta">por quilo</strong>: o preço vem da tabela da
        indústria, e o pedido multiplica pelo peso que o cliente quer.
      </p>
    </>
  );
}

function ControlesFita({ estado, mudar }: { estado: Estado; mudar: Mudar }) {
  const fita = estado.fita;
  const alterar = (parte: Partial<Estado["fita"]>) =>
    mudar((atual) => ({ ...atual, fita: { ...atual.fita, ...parte } }));

  return (
    <>
      <Opcoes
        rotulo="Vender por"
        opcoes={[
          { valor: "CX", rotulo: "Caixa" },
          { valor: "UN", rotulo: "Unidade" },
        ]}
        atual={fita.unidade}
        aoEscolher={(unidade) => alterar({ unidade })}
      />
      <Opcoes
        rotulo="Largura"
        opcoes={[
          { valor: "45", rotulo: "45 mm" },
          { valor: "48", rotulo: "48 mm" },
        ]}
        atual={fita.largura}
        aoEscolher={(largura) => alterar({ largura })}
      />
      <Opcoes
        rotulo="Metragem"
        opcoes={[
          { valor: "50", rotulo: "50 m" },
          { valor: "100", rotulo: "100 m" },
        ]}
        atual={fita.metragem}
        aoEscolher={(metragem) => alterar({ metragem })}
      />
      <Regua
        rotulo="Rolos por caixa"
        unidade="rolos"
        valor={fita.porCaixa}
        min={6}
        max={72}
        passo={6}
        aoMudar={(porCaixa) => alterar({ porCaixa })}
      />
      <p className="text-corpo text-tinta-2 leading-relaxed rounded-[var(--radius-suave)] bg-folha-2 px-4 py-3">
        Medidas e quantidades de exemplo. Quantos rolos vêm na caixa fechada é{" "}
        <strong className="text-tinta">você quem diz</strong>, no cadastro de cada fita — a caixa sai
        pelo preço do rolo vezes essa quantidade, e o rolo avulso pelo preço da unidade.
      </p>
    </>
  );
}

/* Os desenhos acompanham as escolhas, dentro de uma caixa fixa de 160px. */

const MOLA = { type: "spring", stiffness: 260, damping: 26 } as const;

function DesenhoSaco({ estado }: { estado: Estado }) {
  const { largura, comprimento, espessura } = estado.saco;

  return (
    <m.div
      className="relative rounded-b-[10px] rounded-t-[4px] border-solid border-carimbo/60 bg-carimbo-fraco"
      animate={{
        width: 40 + (largura / 80) * 60,
        height: 50 + (comprimento / 100) * 70,
        borderWidth: 1 + espessura * 12,
      }}
      transition={MOLA}
    >
      <span className="absolute inset-x-2 top-2 border-t border-dashed border-carimbo/50" />
    </m.div>
  );
}

function DesenhoBobina({ estado }: { estado: Estado }) {
  const { largura, micragem } = estado.stretch;
  // A espessura engorda a bobina; a largura a estica.
  const diametro = 54 + (micragem - 18) * 3;
  const comprimento = largura === "500" ? 118 : 100;

  return (
    <m.div className="relative flex items-center" animate={{ width: comprimento }} transition={MOLA}>
      {/* O corpo: filme enrolado, com o brilho do plástico. */}
      <m.div
        className="flex-1 rounded-r-[14px]"
        style={{
          border: "1px solid var(--placa-mar-traco)",
          background:
            "repeating-linear-gradient(90deg, var(--placa-mar) 0 6px, color-mix(in srgb, var(--placa-mar) 60%, transparent) 6px 9px)",
        }}
        animate={{ height: diametro }}
        transition={MOLA}
      />
      {/* A boca da bobina, com o tubo de papelão no meio. */}
      <m.div
        className="absolute left-0 -translate-x-1/2 rounded-[50%] grid place-items-center"
        style={{ border: "1px solid var(--placa-mar-traco)", background: "var(--placa-mar)" }}
        animate={{ height: diametro, width: diametro * 0.42 }}
        transition={MOLA}
      >
        <span
          className="w-1/2 h-[30%] rounded-[50%]"
          style={{ background: "var(--placa-sol-traco)", opacity: 0.55 }}
        />
      </m.div>
    </m.div>
  );
}

function DesenhoFita({ estado }: { estado: Estado }) {
  const { largura, metragem, unidade } = estado.fita;
  const externo = metragem === "100" ? 100 : 80;
  const anel = largura === "48" ? 22 : 18;

  const rolo = (
    <m.div
      className="rounded-full grid place-items-center"
      style={{ background: "var(--placa-sol)", border: "1px solid var(--placa-sol-traco)" }}
      animate={{ width: externo, height: externo, padding: anel }}
      transition={MOLA}
    >
      <span
        className="block size-full rounded-full bg-folha"
        style={{ border: "1px solid var(--placa-sol-traco)" }}
      />
    </m.div>
  );

  if (unidade === "UN") return rolo;

  // Por caixa: o rolo na frente de uma caixa de papelão.
  return (
    <div className="relative grid place-items-center">
      <m.div
        className="absolute rounded-[6px]"
        style={{ background: "var(--placa-pessego)", border: "1px solid var(--placa-pessego-traco)" }}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1, width: externo + 44, height: externo + 16 }}
        transition={MOLA}
      >
        <span
          className="absolute right-2 bottom-1 text-micro font-bold"
          style={{ color: "var(--placa-pessego-traco)" }}
        >
          ×{estado.fita.porCaixa}
        </span>
      </m.div>
      <div className="relative -translate-x-4">{rolo}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 2 · Preço                                                                  */
/* -------------------------------------------------------------------------- */

function QuadroPreco({ exemplo }: { exemplo: Exemplo }) {
  const nome = NOME_UNIDADE[exemplo.unidade];
  const totalItem = exemplo.totais.itens[0].total;

  return (
    <div>
      <Rotulo>A conta que você fazia na calculadora</Rotulo>
      <p className="text-corpo font-medium text-tinta mb-4">{exemplo.descricao}</p>

      <ul className="space-y-2.5">
        {exemplo.conta.map((linha, i) => (
          <m.li
            key={linha.rotulo}
            className="flex items-baseline justify-between gap-4 border-b border-filete pb-2.5"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: (0.08 * i + 0.1) * CASCATA, duration: 0.4, ease: SUAVE }}
          >
            <span className="text-corpo text-tinta-2">{linha.rotulo}</span>
            <span className="text-realce font-medium text-tinta numerico text-right">{linha.valor}</span>
          </m.li>
        ))}
      </ul>

      <m.div
        className="mt-5 flex items-end justify-between gap-4"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.45 * CASCATA, duration: 0.45, ease: SUAVE }}
      >
        <span className="text-realce text-tinta-2">= {nome.preco}</span>
        {/* Azul, não o marca-texto: o amarelo é um por tela, e o da landing é o do título. */}
        <span className="text-cifra font-bold text-carimbo numerico">{reais(exemplo.preco)}</span>
      </m.div>

      <m.div
        className="mt-5 rounded-[var(--radius-suave)] bg-folha-2 px-4 py-3 flex flex-wrap items-baseline justify-between gap-2"
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.65 * CASCATA, duration: 0.4, ease: SUAVE }}
      >
        <span className="text-corpo text-tinta-2 numerico">
          No pedido: {exemplo.quantidade} {nome.plural} × {reais(exemplo.preco)}
        </span>
        <span className="text-realce font-semibold text-tinta numerico">= {reais(totalItem)}</span>
      </m.div>

      <p className="text-mini text-tinta-3 mt-4">
        Valores de exemplo. No sistema, fator, densidade e tabela vêm do cadastro de cada indústria —
        e os aditivos entram sozinhos.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 3 · Pedido                                                                 */
/* -------------------------------------------------------------------------- */

function QuadroPedido({ exemplo }: { exemplo: Exemplo }) {
  const { totais } = exemplo;

  return (
    <div>
      <Rotulo>Pedido nº 2254 · Embalagens Exemplo Ltda.</Rotulo>
      <div className="rounded-[var(--radius-suave)] bg-folha-2 p-1">
        {exemplo.itens.map((item, i) => (
          <m.div
            key={item.descricao + i}
            className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 rounded-[var(--radius-miudo)] bg-folha px-4 py-3 mb-1 last:mb-0 shadow-suave"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: (0.12 * i + 0.1) * CASCATA, duration: 0.4, ease: SUAVE }}
          >
            <span className="text-corpo font-medium text-tinta truncate">{item.descricao}</span>
            <span className="text-corpo font-semibold text-tinta numerico text-right">
              {reais(totais.itens[i].total)}
            </span>
            <span className="text-mini text-tinta-3 numerico">
              {item.quantidade} {NOME_UNIDADE[item.unidade].plural} × {reais(item.preco)}
              {NOME_UNIDADE[item.unidade].sufixo}
            </span>
            <span className="text-mini text-tinta-3 numerico text-right">IPI {reais(totais.itens[i].ipi)}</span>
          </m.div>
        ))}
      </div>

      <m.dl
        className="mt-5 space-y-1.5"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 * CASCATA, duration: 0.4 }}
      >
        <div className="flex justify-between text-corpo text-tinta-2">
          <dt>Mercadoria</dt>
          <dd className="numerico">{reais(totais.subtotalSemIpi)}</dd>
        </div>
        <div className="flex justify-between text-corpo text-tinta-2">
          <dt>IPI ({NUMERO.format(Number(IPI))}%)</dt>
          <dd className="numerico">{reais(totais.ipi)}</dd>
        </div>
        <div className="flex items-end justify-between pt-2">
          <dt className="text-realce text-tinta-2">Total do pedido</dt>
          <dd className="text-cifra font-bold text-tinta numerico">{reais(totais.totalGeral)}</dd>
        </div>
      </m.dl>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 4 · PDF e e-mail                                                           */
/* -------------------------------------------------------------------------- */

function QuadroEnvio({ exemplo }: { exemplo: Exemplo }) {
  const [enviado, setEnviado] = useState(false);

  // O "Enviar" se aperta sozinho, depois que a pessoa teve tempo de ler.
  useEffect(() => {
    const relogio = setTimeout(() => setEnviado(true), 1800);
    return () => clearTimeout(relogio);
  }, []);

  return (
    <div className="grid md:grid-cols-[auto_1fr] gap-6 items-start">
      {/*
        A folha do PDF se montando, linha por linha.

        Cores fixas de propósito, fora dos tokens: é PAPEL, branco nos dois
        temas — no escuro, uma folha escura não pareceria um PDF.
      */}
      <m.div
        aria-hidden="true"
        className="hidden md:flex mx-auto w-36 aspect-[1/1.41] rounded-[8px] bg-white border border-filete shadow-alta p-3 flex-col gap-1.5 mt-2"
        initial={{ rotate: -4, y: 16, opacity: 0 }}
        animate={{ rotate: -2, y: 0, opacity: 1 }}
        transition={{ duration: 0.5, ease: SUAVE }}
      >
        <div className="flex items-center justify-between">
          <span className="h-2 w-12 rounded-sm bg-[#2f6fed]/80" />
          <span className="h-1.5 w-7 rounded-sm bg-[#111117]/20" />
        </div>
        {[92, 70, 84, 60, 88, 76, 50].map((largura, i) => (
          <m.span
            key={i}
            className="h-1.5 rounded-sm bg-[#111117]/12 origin-left"
            style={{ width: `${largura}%` }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: (0.25 + i * 0.07) * CASCATA, duration: 0.35, ease: SUAVE }}
          />
        ))}
        <div className="mt-auto flex justify-end">
          <span className="h-2 w-14 rounded-sm bg-[#fcf08f]" />
        </div>
      </m.div>

      <div className="min-w-0">
        {/* A janela do e-mail, já preenchida pelo modelo. */}
        <m.div
          className="rounded-[var(--radius-folha)] border border-filete bg-folha shadow-folha overflow-hidden"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 * CASCATA, duration: 0.45, ease: SUAVE }}
        >
          <div className="px-4 py-2.5 border-b border-filete space-y-1 text-mini">
            <p className="flex gap-2">
              <span className="text-tinta-3 w-14 shrink-0">Para</span>
              <span className="text-tinta truncate">compras@industria-exemplo.com.br</span>
            </p>
            <p className="flex gap-2">
              <span className="text-tinta-3 w-14 shrink-0">Assunto</span>
              <span className="text-tinta font-medium truncate">{exemplo.email.assunto}</span>
            </p>
          </div>
          <p className="px-4 py-3 text-mini text-tinta-2 whitespace-pre-line leading-relaxed">
            {exemplo.email.corpo}
          </p>
          <div className="px-4 pb-3 flex flex-wrap items-center justify-between gap-2">
            <m.span
              className="inline-flex items-center gap-1.5 rounded-full bg-folha-2 border border-filete px-2.5 py-1 text-micro font-medium text-tinta max-w-full"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.7 * CASCATA, duration: 0.3 }}
            >
              <Paperclip size={12} strokeWidth={2} className="shrink-0 text-tinta-3" aria-hidden="true" />
              <FileText size={12} strokeWidth={2} className="shrink-0 text-perigo" aria-hidden="true" />
              <span className="truncate">{exemplo.anexo}</span>
            </m.span>

            <BotaoEnviar enviado={enviado} />
          </div>
        </m.div>

        <p className="mt-4 text-corpo text-tinta-2 leading-relaxed">
          A mensagem é escrita <strong className="text-tinta">uma vez só</strong>, em Configurações.
          Em cada pedido ela já vem preenchida com número, cliente e CNPJ, com o PDF{" "}
          <strong className="text-tinta">anexado e nomeado</strong> no layout da indústria — é só
          conferir e enviar daqui, sem abrir o seu e-mail.
        </p>
      </div>
    </div>
  );
}

/**
 * O "Enviar" que vira "Enviado" — um botão só, que se transforma.
 *
 * Eram dois, trocados por `AnimatePresence mode="wait"`: o primeiro saía, o
 * lugar ficava vazio esperando, e o segundo entrava com outra largura — a
 * linha pulava no meio. Agora os dois rótulos moram na mesma célula do grid
 * (o botão já nasce com a largura do maior), a cor muda por transição de CSS
 * e o movimento é só opacidade e deslocamento: nada recalcula o layout.
 */
function BotaoEnviar({ enviado }: { enviado: boolean }) {
  return (
    <m.span
      className={`grid rounded-full px-3 py-1 text-mini font-semibold overflow-hidden
        transition-colors duration-300 ease-out ${
          enviado ? "bg-verde-fraco text-verde" : "bg-tinta text-papel"
        }`}
      // O "aperto": afunda um pouco e volta, no instante do clique.
      animate={enviado ? { scale: [1, 0.93, 1.03, 1] } : { scale: 1 }}
      transition={{ duration: 0.45, times: [0, 0.25, 0.65, 1], ease: "easeOut" }}
    >
      <m.span
        className="col-start-1 row-start-1 inline-flex items-center justify-center gap-1.5"
        animate={enviado ? { opacity: 0, y: -10 } : { opacity: 1, y: 0 }}
        transition={{ duration: 0.22, ease: "easeIn" }}
        aria-hidden={enviado}
      >
        {/* O aviãozinho sai voando na diagonal, um pouco antes do texto. */}
        <m.span
          className="inline-flex"
          animate={enviado ? { x: 10, y: -8 } : { x: 0, y: 0 }}
          transition={{ duration: 0.25, ease: "easeIn" }}
        >
          <Send size={12} strokeWidth={2.25} aria-hidden="true" />
        </m.span>
        Enviar
      </m.span>

      <m.span
        className="col-start-1 row-start-1 inline-flex items-center justify-center gap-1.5"
        initial={false}
        animate={enviado ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
        transition={{ delay: enviado ? 0.15 : 0, duration: 0.3, ease: SUAVE }}
        aria-hidden={!enviado}
      >
        {/* O check se desenha, em vez de aparecer pronto. */}
        <svg viewBox="0 0 24 24" className="size-[13px]" fill="none" aria-hidden="true">
          <m.path
            d="M20 6 9 17l-5-5"
            stroke="currentColor"
            strokeWidth={2.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={false}
            animate={{ pathLength: enviado ? 1 : 0 }}
            transition={{ delay: enviado ? 0.25 : 0, duration: 0.35, ease: SUAVE }}
          />
        </svg>
        Enviado
      </m.span>
    </m.span>
  );
}

/* -------------------------------------------------------------------------- */
/* 5 · Comissão                                                               */
/* -------------------------------------------------------------------------- */

function QuadroComissao({ exemplo, aoInteragir }: { exemplo: Exemplo; aoInteragir: () => void }) {
  const [plano, setPlano] = useState<"solo" | "max">("solo");
  const { comissao, rateio, base } = exemplo;

  // Três parcelas que fecham no centavo: a última leva o resto do arredondamento.
  const parcela = comissao.dividedBy(3).toDecimalPlaces(2);
  const parcelas = [parcela, parcela, comissao.minus(parcela.times(2))];

  const fracaoPreposto = comissao.isZero() ? 0 : rateio.doPreposto.dividedBy(comissao).toNumber();

  return (
    <div>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-5">
        <p className="rotulo">Comissão do pedido</p>
        <Segmentado
          nome="Plano do exemplo"
          opcoes={[
            { valor: "solo", rotulo: "No Solo" },
            { valor: "max", rotulo: "No Max, com preposto" },
          ]}
          atual={plano}
          aoEscolher={(valor) => {
            aoInteragir();
            setPlano(valor);
          }}
        />
      </div>

      <p className="text-corpo text-tinta-2 numerico">
        {NUMERO.format(Number(PERCENTUAL_COMISSAO))}% sobre {reais(base)} de mercadoria (sem o IPI)
      </p>

      <AnimatePresence mode="wait" initial={false}>
        {plano === "solo" ? (
          <m.div
            key="solo"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: SUAVE }}
          >
            <p className="text-cifra font-bold text-verde numerico mt-1">+ {reais(comissao)}</p>
            <p className="text-mini text-tinta-3 mt-1">Tudo seu — você é o único vendedor do escritório.</p>

            <ul className="mt-6 grid grid-cols-3 gap-2 text-center">
              {["30 dias", "60 dias", "90 dias"].map((prazo, i) => (
                <m.li
                  key={prazo}
                  className="rounded-[var(--radius-suave)] bg-folha-2 px-2 py-2.5"
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: (0.2 + i * 0.1) * CASCATA, duration: 0.35, ease: SUAVE }}
                >
                  <span className="block text-mini text-tinta-3">{prazo}</span>
                  <span className="block text-corpo font-semibold text-tinta numerico">{reais(parcelas[i])}</span>
                </m.li>
              ))}
            </ul>
            <p className="text-mini text-tinta-3 mt-4">
              A comissão acompanha as parcelas que o cliente paga, entra no mês da entrega e é
              conferida contra o que a indústria acertou.
            </p>
          </m.div>
        ) : (
          <m.div
            key="max"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3, ease: SUAVE }}
          >
            <p className="text-corpo text-tinta mt-1">
              Pedido lançado pela preposta <strong>Ana</strong>, que fica com{" "}
              {NUMERO.format(Number(FATIA_PREPOSTA))}% da comissão.
            </p>

            {/*
              As duas fatias por `scaleX`, não por `width`: escala é só
              composição; largura recalcularia o layout a cada quadro. Cada uma
              cresce da sua ponta e as duas se encontram na divisa.
            */}
            <div className="relative mt-5 h-4 rounded-full bg-folha-2 overflow-hidden" aria-hidden="true">
              <m.div
                className="absolute inset-0 bg-carimbo origin-left"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: fracaoPreposto }}
                transition={{ delay: 0.15 * CASCATA, duration: 0.7, ease: SUAVE }}
              />
              <m.div
                className="absolute inset-0 bg-verde origin-right"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 - fracaoPreposto }}
                transition={{ delay: 0.5 * CASCATA, duration: 0.7, ease: SUAVE }}
              />
            </div>

            <dl className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-[var(--radius-suave)] bg-folha-2 px-3 py-2.5">
                <dt className="text-mini text-tinta-3">Comissão</dt>
                <dd className="text-corpo font-semibold text-tinta numerico">{reais(rateio.total)}</dd>
              </div>
              <div className="rounded-[var(--radius-suave)] bg-carimbo-fraco px-3 py-2.5">
                <dt className="text-mini text-carimbo">Da Ana</dt>
                <dd className="text-corpo font-semibold text-carimbo numerico">{reais(rateio.doPreposto)}</dd>
              </div>
              <div className="rounded-[var(--radius-suave)] bg-verde-fraco px-3 py-2.5">
                <dt className="text-mini text-verde">Do escritório</dt>
                <dd className="text-corpo font-semibold text-verde numerico">{reais(rateio.doEscritorio)}</dd>
              </div>
            </dl>
            <p className="text-mini text-tinta-3 mt-4">
              O repasse ao preposto sai pronto no fim do mês. Ele entra com o próprio login e vê só
              os clientes, os pedidos e a parte dele.
            </p>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* 6 · Gráficos                                                               */
/* -------------------------------------------------------------------------- */

const MESES = ["mai", "jun", "jul", "ago", "set", "out"];
/** O formato da curva; o último mês tem a escala do próprio exemplo. */
const PROPORCAO_MESES = [0.58, 0.74, 0.66, 0.9, 0.81, 1];
/** Onde a meta corta as barras, na mesma escala. */
const META = 0.85;
const ESCALA = 1.08;
const INDUSTRIAS = [
  { nome: "Plásticos Alfa", fatia: 0.52 },
  { nome: "Fitas Beta", fatia: 0.31 },
  { nome: "Stretch Sul", fatia: 0.17 },
];
/** Os outros gráficos que existem de verdade na tela de Gráficos. */
const OUTROS_GRAFICOS = [
  "Comissão por cliente",
  "Curva ABC de clientes",
  "Mapa de calor cliente × mês",
  "Clientes que pararam de comprar",
  "Orçamento que virou pedido",
  "Pontualidade de entrega",
  "Pedidos cancelados",
];

function QuadroGraficos({ exemplo }: { exemplo: Exemplo }) {
  // Um mês de escritório tem vários pedidos: a escala é o exemplo × 12.
  const mesAtual = exemplo.comissao.times(12);

  return (
    <div>
      <div className="grid sm:grid-cols-[1.3fr_1fr] gap-6">
        <div>
          <Rotulo>Comissão mês a mês</Rotulo>
          <div className="relative h-36 flex items-end gap-2 border-b border-filete" aria-hidden="true">
            {/* A meta: linha tracejada atravessando as barras. */}
            <m.span
              className="absolute inset-x-0 border-t border-dashed border-perigo/70 z-10"
              style={{ bottom: `${(META / ESCALA) * 100}%` }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 * CASCATA }}
            />
            {PROPORCAO_MESES.map((proporcao, i) => (
              <m.span
                key={MESES[i]}
                className={`flex-1 rounded-t-[5px] origin-bottom ${
                  i === PROPORCAO_MESES.length - 1 ? "bg-carimbo" : "bg-carimbo/30"
                }`}
                style={{ height: `${(proporcao / ESCALA) * 100}%` }}
                initial={{ scaleY: 0 }}
                animate={{ scaleY: 1 }}
                transition={{ delay: (0.1 + i * 0.07) * CASCATA, duration: 0.55, ease: SUAVE }}
              />
            ))}
          </div>
          <div className="flex gap-2 mt-1.5">
            {MESES.map((mes) => (
              <span key={mes} className="flex-1 text-center text-micro text-tinta-3">
                {mes}
              </span>
            ))}
          </div>
          <p className="text-mini text-tinta-3 mt-2">
            Outubro: <span className="font-semibold text-tinta numerico">{reais(mesAtual)}</span> ·{" "}
            <span className="text-perigo">tracejado = meta</span>
          </p>
        </div>

        <div>
          <Rotulo>Comissão por indústria</Rotulo>
          <ul className="space-y-3">
            {INDUSTRIAS.map((industria, i) => (
              <li key={industria.nome}>
                <div className="flex justify-between text-mini mb-1">
                  <span className="text-tinta">{industria.nome}</span>
                  <span className="text-tinta-2 numerico">{reais(mesAtual.times(industria.fatia))}</span>
                </div>
                <div className="h-2 rounded-full bg-folha-2 overflow-hidden">
                  <m.div
                    className="h-full rounded-full bg-verde origin-left"
                    style={{ width: `${(industria.fatia / INDUSTRIAS[0].fatia) * 100}%` }}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: (0.3 + i * 0.1) * CASCATA, duration: 0.6, ease: SUAVE }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <ul className="mt-6 flex flex-wrap gap-1.5">
        {OUTROS_GRAFICOS.map((grafico, i) => (
          <m.li
            key={grafico}
            className="chip"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: (0.6 + i * 0.05) * CASCATA, duration: 0.3 }}
          >
            {grafico}
          </m.li>
        ))}
        <m.li
          className="chip"
          style={{ color: "var(--carimbo)" }}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: (0.6 + OUTROS_GRAFICOS.length * 0.05) * CASCATA, duration: 0.3 }}
        >
          Por preposto · Max
        </m.li>
      </ul>
      <p className="text-mini text-tinta-3 mt-4">
        Os gráficos exportam em PDF e planilha, para levar à reunião com a indústria.
      </p>
    </div>
  );
}
