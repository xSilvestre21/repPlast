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
 * Frasco, bombona e tampa são das famílias por milheiro: o preço é o da tabela
 * da indústria, e a descrição sai de `descricaoDoTipo` — a mesma do cadastro,
 * com o "+ Tampa" do conjunto quando a pessoa põe a tampa.
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
  Barrel,
  BarChart3,
  Bubbles,
  Calculator,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  ClipboardList,
  Cylinder,
  Disc3,
  FileText,
  Mail,
  Milk,
  Package,
  PackageOpen,
  PaintBucket,
  Paperclip,
  Ribbon,
  Send,
  ShoppingBag,
  Soup,
  TestTube,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";

import { Placa, Segmentado } from "@/components/ui";
import { comissaoDoPedido, ratearComissao } from "@/lib/comissao";
import { descricaoFita, descricaoRolo, descricaoSaco, formatarNumero } from "@/lib/descricao";
import { textoPadraoDoEnvio } from "@/lib/envio-pedido";
import { nomeArquivoPedido } from "@/lib/pdf/nome-arquivo";
import { arredondarDinheiro, DENSIDADE_PADRAO, pesoMilheiroKg } from "@/lib/precificacao";
import { precoUnitario, type Familia, type ProdutoPrecificavel, type UnidadeVenda } from "@/lib/produto-preco";
import { camposDaEmbalagem as campos, descricaoDoTipo, tipoPorValor } from "@/lib/tipos-produto";
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

/*
 * Frasco, bombona e tampa: o preço do milheiro é a linha da tabela da
 * indústria, sem conta de medida. O conjunto com tampa é OUTRA linha, com preço
 * próprio — no cadastro ele é um produto só, com um preço só, e o sistema não
 * soma frasco + tampa. A vitrine também não.
 */
type CapacidadeFrasco = "250" | "500" | "1000";
type MaterialFrasco = "PEAD" | "PET" | "PP";
type CapacidadeBombona = "5" | "20" | "50";
type DiametroTampa = "24" | "28" | "38" | "53";
type ModeloTampa = "Rosca" | "Flip Top" | "Lacre";
type SemOuCom = "SEM" | "COM";
type MilOuUn = "MIL" | "UN";

/** Capacidade como o cadastro grava, e o bocal — o diâmetro da tampa do conjunto. */
const FRASCO: Record<CapacidadeFrasco, { capacidade: string; unidade: string; rotulo: string; bocalMm: string }> = {
  "250": { capacidade: "250", unidade: "mL", rotulo: "250 mL", bocalMm: "24" },
  "500": { capacidade: "500", unidade: "mL", rotulo: "500 mL", bocalMm: "28" },
  "1000": { capacidade: "1", unidade: "L", rotulo: "1 L", bocalMm: "38" },
};
/** Milheiro na tabela de exemplo: o frasco sozinho e o conjunto com tampa. */
const PRECO_FRASCO: Record<CapacidadeFrasco, { so: string; conjunto: string }> = {
  "250": { so: "420", conjunto: "560" },
  "500": { so: "620", conjunto: "790" },
  "1000": { so: "980", conjunto: "1190" },
};
/** O PET sai um pouco mais caro que o PEAD, e o PP fica no meio. */
const ACRESCIMO_FRASCO: Record<MaterialFrasco, string> = { PEAD: "0", PET: "70", PP: "30" };

const PRECO_BOMBONA: Record<CapacidadeBombona, { so: string; conjunto: string; bocalMm: string }> = {
  "5": { so: "4200", conjunto: "4900", bocalMm: "38" },
  "20": { so: "11800", conjunto: "13100", bocalMm: "51" },
  "50": { so: "24500", conjunto: "26900", bocalMm: "61" },
};

const PRECO_TAMPA: Record<DiametroTampa, string> = { "24": "95", "28": "120", "38": "190", "53": "310" };
/** O modelo muda a linha da tabela: o flip top tem mais peça que a de rosca. */
const ACRESCIMO_TAMPA: Record<ModeloTampa, string> = { Rosca: "0", "Flip Top": "85", Lacre: "30" };

/*
 * Pote e balde vão pela tabela, como o frasco e a bombona, com o conjunto em
 * linha própria. A boca do pote é a das tampas de pote que a indústria faz
 * (80, 90 e 100 mm).
 */
type CapacidadePote = "250" | "500" | "1000";
type CapacidadeBalde = "5" | "10" | "20";
type AlcaBalde = "Plástica" | "Metálica";
type PesoPreforma = "18" | "21" | "28";
type GargaloPreforma = "PCO 1881" | "PCO 1810";
type AlturaBigBag = "90" | "120" | "150";
type LarguraArquear = "12" | "16" | "19";
type LarguraBolha = "100" | "130" | "150";
type TamanhoBolha = "Pequena" | "Grande";

const POTE: Record<CapacidadePote, { capacidade: string; unidade: string; rotulo: string; bocaMm: string }> = {
  "250": { capacidade: "250", unidade: "mL", rotulo: "250 mL", bocaMm: "80" },
  "500": { capacidade: "500", unidade: "mL", rotulo: "500 mL", bocaMm: "90" },
  "1000": { capacidade: "1", unidade: "L", rotulo: "1 L", bocaMm: "100" },
};
const PRECO_POTE: Record<CapacidadePote, { so: string; conjunto: string }> = {
  "250": { so: "380", conjunto: "520" },
  "500": { so: "560", conjunto: "740" },
  "1000": { so: "890", conjunto: "1150" },
};

const PRECO_BALDE: Record<CapacidadeBalde, { so: string; conjunto: string; tampaMm: string }> = {
  "5": { so: "2900", conjunto: "3700", tampaMm: "200" },
  "10": { so: "4300", conjunto: "5400", tampaMm: "250" },
  "20": { so: "6900", conjunto: "8600", tampaMm: "290" },
};
/** A alça de metal é outra linha da tabela, mais cara que a de plástico. */
const ACRESCIMO_ALCA_METALICA = "900";

/** Pré-forma: o milheiro pelo peso; o gargalo alto (PCO 1810) leva mais resina. */
const PRECO_PREFORMA: Record<PesoPreforma, string> = { "18": "210", "21": "240", "28": "310" };
const ACRESCIMO_PCO_1810 = "12";

/*
 * Big bag, fita de arquear e plástico bolha não se cotam por milheiro: o
 * cadastro escolhe a unidade do preço, e a vitrine mostra a que o mercado usa.
 */
const PRECO_BIG_BAG: Record<AlturaBigBag, string> = { "90": "34.9", "120": "39.9", "150": "45.9" };
const ACRESCIMO_VALVULA = "6";
/** A espessura vem com a largura, como nos catálogos: 12 × 0,6, 16 × 0,8, 19 × 1. */
const ARQUEAR: Record<LarguraArquear, { espessura: string; kg: string }> = {
  "12": { espessura: "0,6", kg: "15.4" },
  "16": { espessura: "0,8", kg: "14.9" },
  "19": { espessura: "1", kg: "14.6" },
};
/** O rolo de 100 m, pela largura em metros. */
const BOLHA: Record<LarguraBolha, { metros: string; rotulo: string; rolo: string }> = {
  "100": { metros: "1", rotulo: "1,00 m", rolo: "72" },
  "130": { metros: "1,3", rotulo: "1,30 m", rolo: "94" },
  "150": { metros: "1,5", rotulo: "1,50 m", rolo: "108" },
};
const ACRESCIMO_BOLHA_GRANDE = "12";

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

type CodigoProduto =
  | "SACO"
  | "STRETCH"
  | "FITA"
  | "FRASCO"
  | "BOMBONA"
  | "TAMPA"
  | "POTE"
  | "BALDE"
  | "PREFORMA"
  | "BIG_BAG"
  | "ARQUEAR"
  | "BOLHA";

type TomProduto = "sol" | "mar" | "menta" | "pessego" | "lilas";

/**
 * Na ordem da trilha: os flexíveis, os rígidos, os rígidos que vieram depois e
 * o que fecha a carga. O ícone e o tom marcam o produto da vez no meio da troca
 * — os mesmos dos cartões de "O que você vende".
 */
const PRODUTOS: { codigo: CodigoProduto; nome: string; vende: string; icone: LucideIcon; tom: TomProduto }[] = [
  { codigo: "SACO", nome: "Saco", vende: "por milheiro ou por quilo", icone: ShoppingBag, tom: "sol" },
  { codigo: "STRETCH", nome: "Stretch", vende: "por quilo", icone: Cylinder, tom: "mar" },
  { codigo: "FITA", nome: "Fita", vende: "por caixa ou por unidade", icone: Disc3, tom: "pessego" },
  { codigo: "FRASCO", nome: "Frasco", vende: "por milheiro ou por unidade", icone: Milk, tom: "menta" },
  { codigo: "BOMBONA", nome: "Bombona", vende: "por milheiro ou por unidade", icone: Barrel, tom: "lilas" },
  { codigo: "TAMPA", nome: "Tampa", vende: "por milheiro ou por unidade", icone: CircleDot, tom: "sol" },
  { codigo: "POTE", nome: "Pote", vende: "por milheiro ou por unidade", icone: Soup, tom: "lilas" },
  { codigo: "BALDE", nome: "Balde", vende: "por milheiro ou por unidade", icone: PaintBucket, tom: "mar" },
  { codigo: "PREFORMA", nome: "Pré-forma", vende: "por milheiro ou por unidade", icone: TestTube, tom: "menta" },
  { codigo: "BIG_BAG", nome: "Big bag", vende: "por unidade", icone: PackageOpen, tom: "pessego" },
  { codigo: "ARQUEAR", nome: "Fita de arquear", vende: "por quilo", icone: Ribbon, tom: "sol" },
  { codigo: "BOLHA", nome: "Plástico bolha", vende: "por rolo", icone: Bubbles, tom: "menta" },
];

interface Estado {
  produto: CodigoProduto;
  saco: { largura: number; comprimento: number; espessura: number; unidade: "MIL" | "KG" };
  stretch: { largura: "450" | "500"; micragem: number };
  fita: { largura: "45" | "48"; metragem: "50" | "100"; unidade: "CX" | "UN"; porCaixa: number };
  frasco: { capacidade: CapacidadeFrasco; material: MaterialFrasco; tampa: SemOuCom; unidade: MilOuUn };
  bombona: { capacidade: CapacidadeBombona; tampa: SemOuCom; unidade: MilOuUn };
  tampa: { diametro: DiametroTampa; modelo: ModeloTampa; unidade: MilOuUn };
  pote: { capacidade: CapacidadePote; tampa: SemOuCom; unidade: MilOuUn };
  balde: { capacidade: CapacidadeBalde; alca: AlcaBalde; tampa: SemOuCom; unidade: MilOuUn };
  preforma: { peso: PesoPreforma; gargalo: GargaloPreforma; unidade: MilOuUn };
  bigbag: { altura: AlturaBigBag; valvula: SemOuCom };
  arquear: { largura: LarguraArquear };
  bolha: { largura: LarguraBolha; bolha: TamanhoBolha };
}

const INICIAL: Estado = {
  produto: "SACO",
  saco: { largura: 40, comprimento: 60, espessura: 0.1, unidade: "MIL" },
  stretch: { largura: "500", micragem: 25 },
  fita: { largura: "45", metragem: "100", unidade: "CX", porCaixa: FITAS_POR_CAIXA },
  frasco: { capacidade: "500", material: "PEAD", tampa: "SEM", unidade: "MIL" },
  bombona: { capacidade: "20", tampa: "COM", unidade: "UN" },
  tampa: { diametro: "28", modelo: "Flip Top", unidade: "MIL" },
  pote: { capacidade: "500", tampa: "COM", unidade: "MIL" },
  balde: { capacidade: "20", alca: "Metálica", tampa: "COM", unidade: "UN" },
  preforma: { peso: "18", gargalo: "PCO 1881", unidade: "MIL" },
  bigbag: { altura: "120", valvula: "SEM" },
  arquear: { largura: "12" },
  bolha: { largura: "130", bolha: "Pequena" },
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
    frasco: { ...INICIAL.frasco, ...estado.frasco },
    bombona: { ...INICIAL.bombona, ...estado.bombona },
    tampa: { ...INICIAL.tampa, ...estado.tampa },
    pote: { ...INICIAL.pote, ...estado.pote },
    balde: { ...INICIAL.balde, ...estado.balde },
    preforma: { ...INICIAL.preforma, ...estado.preforma },
    bigbag: { ...INICIAL.bigbag, ...estado.bigbag },
    arquear: { ...INICIAL.arquear, ...estado.arquear },
    bolha: { ...INICIAL.bolha, ...estado.bolha },
  };
}

/** Produto por milheiro: o preço é o da linha da tabela, como no cadastro. */
function porMilheiro(familia: Familia, milheiro: Decimal): ProdutoPrecificavel {
  return { familia, precoAvulso: milheiro, unidadeAvulsa: "MIL" };
}

/**
 * Produto que escolhe a unidade do preço no cadastro — big bag por unidade, fita
 * de arquear por quilo, plástico bolha por rolo. O preço vale só nela.
 */
function porUnidadeDeVenda(familia: Familia, preco: Decimal, unidade: UnidadeVenda): ProdutoPrecificavel {
  return { familia, precoAvulso: preco, unidadeAvulsa: unidade };
}

/** A conta das famílias por milheiro: a linha da tabela e, na unidade, o milheiro ÷ 1000. */
function contaDaTabela(linha: string, conjunto: boolean, milheiro: Decimal, unidade: MilOuUn): Linha[] {
  return [
    { rotulo: linha, valor: conjunto ? "o conjunto tem linha própria" : "linha da tabela" },
    { rotulo: "Preço do milheiro na tabela da indústria", valor: reais(milheiro) },
    ...(unidade === "UN" ? [{ rotulo: "Vendido por unidade", valor: "milheiro ÷ 1.000" }] : []),
  ];
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
  } else if (estado.produto === "FRASCO") {
    const { capacidade, material } = estado.frasco;
    const conjunto = estado.frasco.tampa === "COM";
    const medida = FRASCO[capacidade];
    const tabela = PRECO_FRASCO[capacidade];
    const milheiro = new Decimal(conjunto ? tabela.conjunto : tabela.so).plus(ACRESCIMO_FRASCO[material]);
    unidade = estado.frasco.unidade;
    produto = porMilheiro(conjunto ? "FRASCO_TAMPA" : "FRASCO", milheiro);
    descricao = descricaoDoTipo(
      tipoPorValor(conjunto ? "FRASCO_TAMPA" : "FRASCO"),
      campos({
        capacidade: medida.capacidade,
        capacidadeUnidade: medida.unidade,
        material,
        complemento: "Cilíndrico",
        diametroMm: medida.bocalMm,
        materialTampa: "PP",
        complementoTampa: "Rosca",
      }),
    );
    conta = contaDaTabela(
      conjunto
        ? `Frasco ${medida.rotulo} em ${material} + tampa ${medida.bocalMm} mm`
        : `Frasco ${medida.rotulo} em ${material}`,
      conjunto,
      milheiro,
      unidade,
    );
  } else if (estado.produto === "BOMBONA") {
    const { capacidade } = estado.bombona;
    const conjunto = estado.bombona.tampa === "COM";
    const tabela = PRECO_BOMBONA[capacidade];
    const milheiro = new Decimal(conjunto ? tabela.conjunto : tabela.so);
    unidade = estado.bombona.unidade;
    produto = porMilheiro(conjunto ? "BOMBONA_TAMPA" : "BOMBONA", milheiro);
    descricao = descricaoDoTipo(
      tipoPorValor(conjunto ? "BOMBONA_TAMPA" : "BOMBONA"),
      campos({
        capacidade,
        capacidadeUnidade: "L",
        material: "PEAD",
        complemento: "Boca Estreita",
        diametroMm: tabela.bocalMm,
        materialTampa: "PP",
        complementoTampa: "Lacre",
      }),
    );
    conta = contaDaTabela(
      conjunto ? `Bombona ${capacidade} L + tampa ${tabela.bocalMm} mm` : `Bombona ${capacidade} L`,
      conjunto,
      milheiro,
      unidade,
    );
  } else if (estado.produto === "TAMPA") {
    const { diametro, modelo } = estado.tampa;
    const milheiro = new Decimal(PRECO_TAMPA[diametro]).plus(ACRESCIMO_TAMPA[modelo]);
    unidade = estado.tampa.unidade;
    produto = porMilheiro("TAMPA", milheiro);
    descricao = descricaoDoTipo(
      tipoPorValor("TAMPA"),
      campos({ diametroMm: diametro, material: "PP", complemento: modelo }),
    );
    conta = contaDaTabela(`Tampa ${diametro} mm em PP, ${modelo}`, false, milheiro, unidade);
  } else if (estado.produto === "POTE") {
    const { capacidade } = estado.pote;
    const conjunto = estado.pote.tampa === "COM";
    const medida = POTE[capacidade];
    const tabela = PRECO_POTE[capacidade];
    const milheiro = new Decimal(conjunto ? tabela.conjunto : tabela.so);
    unidade = estado.pote.unidade;
    produto = porMilheiro(conjunto ? "POTE_TAMPA" : "POTE", milheiro);
    descricao = descricaoDoTipo(
      tipoPorValor(conjunto ? "POTE_TAMPA" : "POTE"),
      campos({
        capacidade: medida.capacidade,
        capacidadeUnidade: medida.unidade,
        material: "PP",
        complemento: `Redondo Boca ${medida.bocaMm}mm`,
        diametroMm: medida.bocaMm,
        materialTampa: "PP",
        complementoTampa: "Rosca",
      }),
    );
    conta = contaDaTabela(
      conjunto ? `Pote ${medida.rotulo} em PP + tampa ${medida.bocaMm} mm` : `Pote ${medida.rotulo} em PP`,
      conjunto,
      milheiro,
      unidade,
    );
  } else if (estado.produto === "BALDE") {
    const { capacidade, alca } = estado.balde;
    const conjunto = estado.balde.tampa === "COM";
    const tabela = PRECO_BALDE[capacidade];
    const milheiro = new Decimal(conjunto ? tabela.conjunto : tabela.so).plus(
      alca === "Metálica" ? ACRESCIMO_ALCA_METALICA : 0,
    );
    unidade = estado.balde.unidade;
    produto = porMilheiro(conjunto ? "BALDE_TAMPA" : "BALDE", milheiro);
    descricao = descricaoDoTipo(
      tipoPorValor(conjunto ? "BALDE_TAMPA" : "BALDE"),
      campos({
        capacidade,
        capacidadeUnidade: "L",
        material: "PP",
        complemento: `Alça ${alca}`,
        diametroMm: tabela.tampaMm,
        materialTampa: "PP",
        complementoTampa: "Lacre",
      }),
    );
    const balde = `Balde ${capacidade} L, alça ${alca.toLowerCase()}`;
    conta = contaDaTabela(
      conjunto ? `${balde} + tampa ${tabela.tampaMm} mm` : balde,
      conjunto,
      milheiro,
      unidade,
    );
  } else if (estado.produto === "PREFORMA") {
    const { peso, gargalo } = estado.preforma;
    const milheiro = new Decimal(PRECO_PREFORMA[peso]).plus(gargalo === "PCO 1810" ? ACRESCIMO_PCO_1810 : 0);
    unidade = estado.preforma.unidade;
    produto = porMilheiro("PREFORMA", milheiro);
    descricao = descricaoDoTipo(
      tipoPorValor("PREFORMA"),
      campos({ capacidade: peso, capacidadeUnidade: "g", material: "PET", complemento: `${gargalo} Cristal` }),
    );
    conta = contaDaTabela(`Pré-forma de ${peso} g, gargalo ${gargalo}`, false, milheiro, unidade);
  } else if (estado.produto === "BIG_BAG") {
    const { altura } = estado.bigbag;
    const comValvula = estado.bigbag.valvula === "COM";
    const preco = new Decimal(PRECO_BIG_BAG[altura]).plus(comValvula ? ACRESCIMO_VALVULA : 0);
    unidade = "UN";
    produto = porUnidadeDeVenda("BIG_BAG", preco, "UN");
    descricao = descricaoDoTipo(
      tipoPorValor("BIG_BAG"),
      campos({
        comprimentoCm: "90",
        larguraCm: "90",
        alturaCm: altura,
        material: "PP",
        complemento: `1000 kg 4 Alças ${comValvula ? "Fundo C/ Válvula" : "Fundo Plano"}`,
      }),
    );
    conta = [
      {
        rotulo: `Big bag 90 × 90 × ${altura} cm, ${comValvula ? "com válvula de descarga" : "fundo plano"}`,
        valor: "linha da tabela",
      },
      { rotulo: "Preço da unidade na tabela da indústria", valor: reais(preco) },
      { rotulo: "Vendido por unidade", valor: "o cadastro escolhe" },
    ];
  } else if (estado.produto === "ARQUEAR") {
    const { largura } = estado.arquear;
    const linha = ARQUEAR[largura];
    const kg = new Decimal(linha.kg);
    unidade = "KG";
    produto = porUnidadeDeVenda("FITA_ARQUEAR", kg, "KG");
    descricao = descricaoDoTipo(
      tipoPorValor("FITA_ARQUEAR"),
      campos({ larguraMm: largura, espessuraMm: linha.espessura, material: "PP", complemento: "Preta" }),
    );
    conta = [
      { rotulo: `Fita de arquear ${largura} × ${linha.espessura} mm`, valor: "vendida por quilo" },
      { rotulo: "Preço do kg na tabela da indústria", valor: `${reais(kg)}/kg` },
    ];
  } else if (estado.produto === "BOLHA") {
    const { largura, bolha } = estado.bolha;
    const linha = BOLHA[largura];
    const rolo = new Decimal(linha.rolo).plus(bolha === "Grande" ? ACRESCIMO_BOLHA_GRANDE : 0);
    unidade = "UN";
    produto = porUnidadeDeVenda("BOLHA", rolo, "UN");
    descricao = descricaoDoTipo(
      tipoPorValor("BOLHA"),
      campos({ larguraM: linha.metros, metragemM: "100", material: "PEBD", complemento: `Bolha ${bolha}` }),
    );
    conta = [
      { rotulo: `Rolo de ${linha.rotulo} × 100 m, bolha ${bolha.toLowerCase()}`, valor: "vendido por rolo" },
      { rotulo: "Preço do rolo na tabela da indústria", valor: reais(rolo) },
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
    resumo:
      "Saco pela medida; stretch e arquear por kg; big bag e bolha pela unidade; o resto pela tabela, por milheiro.",
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
        // No computador, a altura do quadro de Produto mais alto (a fita, com a
        // régua de rolos por caixa): a etapa que passa sozinha não faz a página pular.
        className="folha folha-marcada p-5 sm:p-7 min-h-[27rem] lg:min-h-[34rem] relative overflow-hidden flex flex-col"
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
            className="flex-1 flex flex-col"
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
    <div className="flex-1 flex flex-col min-h-[23rem]">
      <div className="flex items-baseline justify-between gap-3 mb-4 flex-wrap">
        <p className="rotulo">Medidas de exemplo — mexa à vontade</p>
        <p className="text-mini text-tinta-3">
          {produto.nome} se vende <strong className="text-tinta-2">{produto.vende}</strong>
        </p>
      </div>

      {/* A sobra de altura fica em volta do exemplo, e não embaixo da troca. */}
      <div className="relative flex-1 flex flex-col justify-center">
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
              {estado.produto === "FRASCO" && <ControlesFrasco estado={estado} mudar={mudar} />}
              {estado.produto === "BOMBONA" && <ControlesBombona estado={estado} mudar={mudar} />}
              {estado.produto === "TAMPA" && <ControlesTampa estado={estado} mudar={mudar} />}
              {estado.produto === "POTE" && <ControlesPote estado={estado} mudar={mudar} />}
              {estado.produto === "BALDE" && <ControlesBalde estado={estado} mudar={mudar} />}
              {estado.produto === "PREFORMA" && <ControlesPreforma estado={estado} mudar={mudar} />}
              {estado.produto === "BIG_BAG" && <ControlesBigBag estado={estado} mudar={mudar} />}
              {estado.produto === "ARQUEAR" && <ControlesArquear estado={estado} mudar={mudar} />}
              {estado.produto === "BOLHA" && <ControlesBolha estado={estado} mudar={mudar} />}
            </div>

            <div className="flex flex-col items-center gap-3">
              <div className="grid place-items-center size-40" aria-hidden="true">
                {estado.produto === "SACO" && <DesenhoSaco estado={estado} />}
                {estado.produto === "STRETCH" && <DesenhoBobina estado={estado} />}
                {estado.produto === "FITA" && <DesenhoFita estado={estado} />}
                {estado.produto === "FRASCO" && <DesenhoFrasco estado={estado} />}
                {estado.produto === "BOMBONA" && <DesenhoBombona estado={estado} />}
                {estado.produto === "TAMPA" && <DesenhoTampa estado={estado} />}
                {estado.produto === "POTE" && <DesenhoPote estado={estado} />}
                {estado.produto === "BALDE" && <DesenhoBalde estado={estado} />}
                {estado.produto === "PREFORMA" && <DesenhoPreforma estado={estado} />}
                {estado.produto === "BIG_BAG" && <DesenhoBigBag estado={estado} />}
                {estado.produto === "ARQUEAR" && <DesenhoArquear estado={estado} />}
                {estado.produto === "BOLHA" && <DesenhoBolha estado={estado} />}
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

      {/*
        A troca de produto. As setas trocam, e no meio fica só o produto da vez:
        o ícone, o nome e quantos são — doze nomes de uma vez ocupavam mais que o
        próprio exemplo. Embaixo, a trilha: um tracinho por produto, o da vez
        aceso e mais comprido. Cada um diz o nome ao passar o mouse e leva direto
        a ele, para ninguém precisar de seis cliques na seta.
      */}
      <div className="mt-6 pt-4 border-t border-filete">
        <div className="flex items-center justify-between gap-3">
          <BotaoSeta direcao="anterior" aoClicar={() => irPara(indice - 1, -1)} />
          <div className="relative flex-1 min-w-0 h-11 overflow-hidden" aria-live="polite">
            <AnimatePresence initial={false} custom={direcao}>
              <m.div
                key={produto.codigo}
                custom={direcao}
                variants={{
                  entra: (d: number) => ({ opacity: 0, x: 28 * d }),
                  fica: { opacity: 1, x: 0 },
                  sai: (d: number) => ({ opacity: 0, x: -28 * d }),
                }}
                initial="entra"
                animate="fica"
                exit="sai"
                transition={{ duration: 0.28, ease: SUAVE }}
                className="absolute inset-0 flex items-center justify-center gap-2.5"
              >
                <Placa icone={produto.icone} tom={produto.tom} pequena />
                <span className="min-w-0 text-left leading-tight">
                  <span className="block truncate text-realce font-semibold text-tinta">{produto.nome}</span>
                  <span className="block text-mini text-tinta-3 numerico">
                    {indice + 1} de {PRODUTOS.length}
                  </span>
                </span>
              </m.div>
            </AnimatePresence>
          </div>
          <BotaoSeta direcao="proximo" aoClicar={() => irPara(indice + 1, 1)} />
        </div>

        <div role="group" aria-label="Produto do exemplo" className="mt-2 flex items-center justify-center">
          {PRODUTOS.map((p, i) => (
            <button
              key={p.codigo}
              type="button"
              aria-label={p.nome}
              aria-pressed={i === indice}
              onClick={() => irPara(i, i >= indice ? 1 : -1)}
              className="group relative grid place-items-center h-7 px-[3px] cursor-pointer"
            >
              <span
                aria-hidden="true"
                className={`block h-1.5 rounded-full transition-all duration-300 ${
                  i === indice ? "w-7 bg-carimbo" : "w-3 bg-filete-forte group-hover:bg-tinta-3"
                }`}
              />
              <span
                aria-hidden="true"
                className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 whitespace-nowrap
                  rounded-[var(--radius-miudo)] bg-tinta px-2 py-0.5 text-micro font-semibold text-papel
                  opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100"
              >
                {p.nome}
              </span>
            </button>
          ))}
        </div>
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
      className="alvo-toque relative grid place-items-center size-9 shrink-0 rounded-full border border-filete-forte text-tinta cursor-pointer transition-all hover:bg-folha-2 active:scale-95"
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

/* Frasco, bombona e tampa: escolhas de tabela, e não réguas — a indústria tem
   as capacidades e os diâmetros dela, não qualquer número. */

const VENDER_POR_MILHEIRO = [
  { valor: "MIL" as const, rotulo: "Milheiro" },
  { valor: "UN" as const, rotulo: "Unidade" },
];

const COM_OU_SEM_TAMPA = [
  { valor: "SEM" as const, rotulo: "Sem tampa" },
  { valor: "COM" as const, rotulo: "Com tampa" },
];

function NotaDaTabela({ children }: { children: ReactNode }) {
  return (
    <p className="text-corpo text-tinta-2 leading-relaxed rounded-[var(--radius-suave)] bg-folha-2 px-4 py-3">
      {children}
    </p>
  );
}

function ControlesFrasco({ estado, mudar }: { estado: Estado; mudar: Mudar }) {
  const frasco = estado.frasco;
  const alterar = (parte: Partial<Estado["frasco"]>) =>
    mudar((atual) => ({ ...atual, frasco: { ...atual.frasco, ...parte } }));

  return (
    <>
      <Opcoes
        rotulo="Vender por"
        opcoes={VENDER_POR_MILHEIRO}
        atual={frasco.unidade}
        aoEscolher={(unidade) => alterar({ unidade })}
      />
      <Opcoes
        rotulo="Capacidade"
        opcoes={(Object.keys(FRASCO) as CapacidadeFrasco[]).map((valor) => ({
          valor,
          rotulo: FRASCO[valor].rotulo,
        }))}
        atual={frasco.capacidade}
        aoEscolher={(capacidade) => alterar({ capacidade })}
      />
      <Opcoes
        rotulo="Material"
        opcoes={[
          { valor: "PEAD", rotulo: "PEAD" },
          { valor: "PET", rotulo: "PET" },
          { valor: "PP", rotulo: "PP" },
        ]}
        atual={frasco.material}
        aoEscolher={(material) => alterar({ material })}
      />
      <Opcoes rotulo="Tampa" opcoes={COM_OU_SEM_TAMPA} atual={frasco.tampa} aoEscolher={(tampa) => alterar({ tampa })} />
      <NotaDaTabela>
        Com a tampa, o frasco vira <strong className="text-tinta">conjunto</strong>: a descrição ganha o
        &ldquo;+ Tampa&rdquo; e o preço é o do conjunto na tabela da indústria.
      </NotaDaTabela>
    </>
  );
}

function ControlesBombona({ estado, mudar }: { estado: Estado; mudar: Mudar }) {
  const bombona = estado.bombona;
  const alterar = (parte: Partial<Estado["bombona"]>) =>
    mudar((atual) => ({ ...atual, bombona: { ...atual.bombona, ...parte } }));

  return (
    <>
      <Opcoes
        rotulo="Vender por"
        opcoes={VENDER_POR_MILHEIRO}
        atual={bombona.unidade}
        aoEscolher={(unidade) => alterar({ unidade })}
      />
      <Opcoes
        rotulo="Capacidade"
        opcoes={[
          { valor: "5", rotulo: "5 L" },
          { valor: "20", rotulo: "20 L" },
          { valor: "50", rotulo: "50 L" },
        ]}
        atual={bombona.capacidade}
        aoEscolher={(capacidade) => alterar({ capacidade })}
      />
      <Opcoes rotulo="Tampa" opcoes={COM_OU_SEM_TAMPA} atual={bombona.tampa} aoEscolher={(tampa) => alterar({ tampa })} />
      <NotaDaTabela>
        Bombona se vende <strong className="text-tinta">pela tabela</strong>, por milheiro — e a unidade é o
        milheiro dividido por mil, sem arredondar no caminho.
      </NotaDaTabela>
    </>
  );
}

function ControlesTampa({ estado, mudar }: { estado: Estado; mudar: Mudar }) {
  const tampa = estado.tampa;
  const alterar = (parte: Partial<Estado["tampa"]>) =>
    mudar((atual) => ({ ...atual, tampa: { ...atual.tampa, ...parte } }));

  return (
    <>
      <Opcoes
        rotulo="Vender por"
        opcoes={VENDER_POR_MILHEIRO}
        atual={tampa.unidade}
        aoEscolher={(unidade) => alterar({ unidade })}
      />
      <Opcoes
        rotulo="Diâmetro"
        opcoes={(Object.keys(PRECO_TAMPA) as DiametroTampa[]).map((valor) => ({ valor, rotulo: `${valor} mm` }))}
        atual={tampa.diametro}
        aoEscolher={(diametro) => alterar({ diametro })}
      />
      <Opcoes
        rotulo="Modelo"
        opcoes={[
          { valor: "Rosca", rotulo: "Rosca" },
          { valor: "Flip Top", rotulo: "Flip Top" },
          { valor: "Lacre", rotulo: "Lacre" },
        ]}
        atual={tampa.modelo}
        aoEscolher={(modelo) => alterar({ modelo })}
      />
      <NotaDaTabela>
        A tampa também se vende <strong className="text-tinta">sozinha</strong>, pelo diâmetro — e pode vir
        de outra indústria que não a do frasco.
      </NotaDaTabela>
    </>
  );
}

/** O frasco cresce com a capacidade, e a cor diz o material. */
const ESCALA_FRASCO: Record<CapacidadeFrasco, number> = { "250": 0.66, "500": 0.83, "1000": 1 };
const COR_FRASCO: Record<MaterialFrasco, { fundo: string; traco: string }> = {
  PEAD: { fundo: "var(--placa-menta)", traco: "var(--placa-menta-traco)" },
  PET: { fundo: "var(--placa-mar)", traco: "var(--placa-mar-traco)" },
  PP: { fundo: "var(--placa-lilas)", traco: "var(--placa-lilas-traco)" },
};
const TAMPA_COR = { fill: "var(--placa-sol)", stroke: "var(--placa-sol-traco)" };

/** A tampa do conjunto: desce de cima e encaixa no bocal. */
function TampaQueDesce({ x, y, largura, altura }: { x: number; y: number; largura: number; altura: number }) {
  const estrias = Array.from({ length: Math.floor(largura / 4) - 1 }, (_, i) => x + 4 + i * 4);

  return (
    <m.g
      initial={{ y: -24, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: -24, opacity: 0 }}
      transition={MOLA}
    >
      <rect x={x} y={y} width={largura} height={altura} rx={3} style={{ ...TAMPA_COR, strokeWidth: 1.25 }} />
      {estrias.map((ex) => (
        <line
          key={ex}
          x1={ex}
          x2={ex}
          y1={y + 3}
          y2={y + altura - 3}
          style={{ stroke: TAMPA_COR.stroke, strokeWidth: 1, opacity: 0.45 }}
        />
      ))}
    </m.g>
  );
}

function DesenhoFrasco({ estado }: { estado: Estado }) {
  const { capacidade, material, tampa } = estado.frasco;
  const cor = COR_FRASCO[material];

  return (
    <m.svg
      viewBox="0 0 80 150"
      className="w-[86px] h-[160px] overflow-visible"
      style={{ originY: 1 }}
      animate={{ scale: ESCALA_FRASCO[capacidade] }}
      transition={MOLA}
    >
      <path
        d="M31 40 L31 28 L49 28 L49 40 C49 50 68 52 68 66 L68 136 Q68 146 58 146 L22 146 Q12 146 12 136 L12 66 C12 52 31 50 31 40 Z"
        style={{ fill: cor.fundo, stroke: cor.traco, strokeWidth: 1.25, transition: "fill .3s, stroke .3s" }}
      />
      {/* A rosca do bocal: some embaixo da tampa. */}
      <line x1={31} x2={49} y1={31.5} y2={31.5} style={{ stroke: cor.traco, strokeWidth: 1, opacity: 0.5 }} />
      <line x1={31} x2={49} y1={35.5} y2={35.5} style={{ stroke: cor.traco, strokeWidth: 1, opacity: 0.5 }} />
      {/* O rótulo. */}
      <rect x={12} y={84} width={56} height={34} style={{ fill: cor.traco, opacity: 0.14 }} />
      <line x1={20} x2={20} y1={70} y2={132} style={{ stroke: cor.traco, strokeWidth: 2, opacity: 0.18 }} />
      <AnimatePresence>
        {tampa === "COM" && <TampaQueDesce key="tampa" x={28} y={16} largura={24} altura={16} />}
      </AnimatePresence>
    </m.svg>
  );
}

const ESCALA_BOMBONA: Record<CapacidadeBombona, number> = { "5": 0.6, "20": 0.8, "50": 1 };

function DesenhoBombona({ estado }: { estado: Estado }) {
  const { capacidade, tampa } = estado.bombona;
  const cor = { fill: "var(--placa-mar)", stroke: "var(--placa-mar-traco)" };

  return (
    <m.svg
      viewBox="0 0 130 140"
      className="w-[150px] h-[160px] overflow-visible"
      style={{ originY: 1 }}
      animate={{ scale: ESCALA_BOMBONA[capacidade] }}
      transition={MOLA}
    >
      {/* A alça, vazada no meio. */}
      <path
        fillRule="evenodd"
        d="M22 46 V22 Q22 12 32 12 H72 Q82 12 82 22 V46 Z M33 22 H71 V35 H33 Z"
        style={{ ...cor, strokeWidth: 1.25 }}
      />
      <rect x={8} y={42} width={114} height={94} rx={14} style={{ ...cor, strokeWidth: 1.25 }} />
      {/* As nervuras do corpo. */}
      <line x1={8} x2={122} y1={72} y2={72} style={{ stroke: cor.stroke, strokeWidth: 1, opacity: 0.3 }} />
      <line x1={8} x2={122} y1={106} y2={106} style={{ stroke: cor.stroke, strokeWidth: 1, opacity: 0.3 }} />
      {/* O bocal, com a rosca. */}
      <rect x={93} y={28} width={20} height={15} rx={2} style={{ ...cor, strokeWidth: 1.25 }} />
      <line x1={93} x2={113} y1={33} y2={33} style={{ stroke: cor.stroke, strokeWidth: 1, opacity: 0.5 }} />
      <line x1={93} x2={113} y1={37.5} y2={37.5} style={{ stroke: cor.stroke, strokeWidth: 1, opacity: 0.5 }} />
      <AnimatePresence>
        {tampa === "COM" && <TampaQueDesce key="tampa" x={90} y={17} largura={26} altura={15} />}
      </AnimatePresence>
    </m.svg>
  );
}

/** A tampa vista de cima: cresce com o diâmetro, e o modelo muda o topo. */
const ESCALA_TAMPA: Record<DiametroTampa, number> = { "24": 0.52, "28": 0.62, "38": 0.8, "53": 1 };

function DesenhoTampa({ estado }: { estado: Estado }) {
  const { diametro, modelo } = estado.tampa;

  return (
    <m.svg
      viewBox="0 0 120 120"
      className="w-[150px] h-[150px] overflow-visible"
      animate={{ scale: ESCALA_TAMPA[diametro] }}
      transition={MOLA}
    >
      {/* O lacre: o anel que se rompe na primeira abertura. */}
      {modelo === "Lacre" && (
        <circle
          cx={60}
          cy={60}
          r={58}
          style={{ fill: "none", stroke: TAMPA_COR.stroke, strokeWidth: 1.5, strokeDasharray: "7 4", opacity: 0.7 }}
        />
      )}
      {/* A borda serrilhada, que a mão segura para girar. */}
      <circle
        cx={60}
        cy={60}
        r={52}
        style={{ fill: TAMPA_COR.fill, stroke: TAMPA_COR.stroke, strokeWidth: 5, strokeDasharray: "2 2.4" }}
      />
      <circle cx={60} cy={60} r={46} style={{ fill: "none", stroke: TAMPA_COR.stroke, strokeWidth: 1, opacity: 0.4 }} />
      <AnimatePresence mode="wait" initial={false}>
        {modelo === "Flip Top" ? (
          <m.g
            key="flip"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.2 }}
            style={{ originX: 0.5, originY: 0.5 }}
          >
            {/* A aba que abre, com a dobradiça embaixo e o bico em cima. */}
            <rect
              x={36}
              y={30}
              width={48}
              height={50}
              rx={20}
              style={{ fill: TAMPA_COR.fill, stroke: TAMPA_COR.stroke, strokeWidth: 1.25 }}
            />
            <circle cx={60} cy={44} r={5} style={{ fill: "none", stroke: TAMPA_COR.stroke, strokeWidth: 1.25 }} />
            <line x1={42} x2={78} y1={86} y2={86} style={{ stroke: TAMPA_COR.stroke, strokeWidth: 2, opacity: 0.6 }} />
          </m.g>
        ) : (
          <m.circle
            key="lisa"
            cx={60}
            cy={60}
            r={30}
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.35 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{ fill: "none", stroke: TAMPA_COR.stroke, strokeWidth: 1 }}
          />
        )}
      </AnimatePresence>
    </m.svg>
  );
}

/*
 * Pote, balde e pré-forma: escolhas de tabela, como o frasco. Big bag, fita de
 * arquear e plástico bolha: o preço na unidade em que o mercado cota — e o
 * desenho mostra o que a escolha muda na peça.
 */

const ALCAS = [
  { valor: "Plástica" as const, rotulo: "Plástica" },
  { valor: "Metálica" as const, rotulo: "Metálica" },
];

function ControlesPote({ estado, mudar }: { estado: Estado; mudar: Mudar }) {
  const pote = estado.pote;
  const alterar = (parte: Partial<Estado["pote"]>) =>
    mudar((atual) => ({ ...atual, pote: { ...atual.pote, ...parte } }));

  return (
    <>
      <Opcoes
        rotulo="Vender por"
        opcoes={VENDER_POR_MILHEIRO}
        atual={pote.unidade}
        aoEscolher={(unidade) => alterar({ unidade })}
      />
      <Opcoes
        rotulo="Capacidade"
        opcoes={(Object.keys(POTE) as CapacidadePote[]).map((valor) => ({ valor, rotulo: POTE[valor].rotulo }))}
        atual={pote.capacidade}
        aoEscolher={(capacidade) => alterar({ capacidade })}
      />
      <Opcoes rotulo="Tampa" opcoes={COM_OU_SEM_TAMPA} atual={pote.tampa} aoEscolher={(tampa) => alterar({ tampa })} />
      <NotaDaTabela>
        A boca do pote é o diâmetro da tampa — <strong className="text-tinta">{POTE[pote.capacidade].bocaMm} mm</strong>.
        Com ela, o pote vira conjunto, com linha própria na tabela.
      </NotaDaTabela>
    </>
  );
}

function ControlesBalde({ estado, mudar }: { estado: Estado; mudar: Mudar }) {
  const balde = estado.balde;
  const alterar = (parte: Partial<Estado["balde"]>) =>
    mudar((atual) => ({ ...atual, balde: { ...atual.balde, ...parte } }));

  return (
    <>
      <Opcoes
        rotulo="Vender por"
        opcoes={VENDER_POR_MILHEIRO}
        atual={balde.unidade}
        aoEscolher={(unidade) => alterar({ unidade })}
      />
      <Opcoes
        rotulo="Capacidade"
        opcoes={(Object.keys(PRECO_BALDE) as CapacidadeBalde[]).map((valor) => ({ valor, rotulo: `${valor} L` }))}
        atual={balde.capacidade}
        aoEscolher={(capacidade) => alterar({ capacidade })}
      />
      <Opcoes rotulo="Alça" opcoes={ALCAS} atual={balde.alca} aoEscolher={(alca) => alterar({ alca })} />
      <Opcoes rotulo="Tampa" opcoes={COM_OU_SEM_TAMPA} atual={balde.tampa} aoEscolher={(tampa) => alterar({ tampa })} />
    </>
  );
}

function ControlesPreforma({ estado, mudar }: { estado: Estado; mudar: Mudar }) {
  const preforma = estado.preforma;
  const alterar = (parte: Partial<Estado["preforma"]>) =>
    mudar((atual) => ({ ...atual, preforma: { ...atual.preforma, ...parte } }));

  return (
    <>
      <Opcoes
        rotulo="Vender por"
        opcoes={VENDER_POR_MILHEIRO}
        atual={preforma.unidade}
        aoEscolher={(unidade) => alterar({ unidade })}
      />
      <Opcoes
        rotulo="Peso"
        opcoes={(Object.keys(PRECO_PREFORMA) as PesoPreforma[]).map((valor) => ({ valor, rotulo: `${valor} g` }))}
        atual={preforma.peso}
        aoEscolher={(peso) => alterar({ peso })}
      />
      <Opcoes
        rotulo="Gargalo"
        opcoes={[
          { valor: "PCO 1881" as const, rotulo: "PCO 1881" },
          { valor: "PCO 1810" as const, rotulo: "PCO 1810" },
        ]}
        atual={preforma.gargalo}
        aoEscolher={(gargalo) => alterar({ gargalo })}
      />
      <NotaDaTabela>
        Pelo <strong className="text-tinta">peso</strong>, que é o da garrafa que ela vira, e pelo gargalo: o
        1810 é o de 28 mm alto, o 1881 o baixo.
      </NotaDaTabela>
    </>
  );
}

function ControlesBigBag({ estado, mudar }: { estado: Estado; mudar: Mudar }) {
  const bigbag = estado.bigbag;
  const alterar = (parte: Partial<Estado["bigbag"]>) =>
    mudar((atual) => ({ ...atual, bigbag: { ...atual.bigbag, ...parte } }));

  return (
    <>
      <Opcoes
        rotulo="Altura"
        opcoes={(Object.keys(PRECO_BIG_BAG) as AlturaBigBag[]).map((valor) => ({ valor, rotulo: `${valor} cm` }))}
        atual={bigbag.altura}
        aoEscolher={(altura) => alterar({ altura })}
      />
      <Opcoes
        rotulo="Fundo"
        opcoes={[
          { valor: "SEM" as const, rotulo: "Plano" },
          { valor: "COM" as const, rotulo: "Com válvula" },
        ]}
        atual={bigbag.valvula}
        aoEscolher={(valvula) => alterar({ valvula })}
      />
      <NotaDaTabela>
        Big bag se cota <strong className="text-tinta">por unidade</strong>: no cadastro, o preço fica na unidade
        que a indústria usa, sem passar pelo milheiro.
      </NotaDaTabela>
    </>
  );
}

function ControlesArquear({ estado, mudar }: { estado: Estado; mudar: Mudar }) {
  const { largura } = estado.arquear;
  const alterar = (parte: Partial<Estado["arquear"]>) =>
    mudar((atual) => ({ ...atual, arquear: { ...atual.arquear, ...parte } }));

  return (
    <>
      <Opcoes
        rotulo="Largura"
        opcoes={(Object.keys(ARQUEAR) as LarguraArquear[]).map((valor) => ({ valor, rotulo: `${valor} mm` }))}
        atual={largura}
        aoEscolher={(nova) => alterar({ largura: nova })}
      />
      <NotaDaTabela>
        Por <strong className="text-tinta">quilo</strong>, como a indústria cobra. A espessura vem com a largura (
        {ARQUEAR[largura].espessura} mm), e o selo de {largura} mm entra no mesmo pedido, por milheiro.
      </NotaDaTabela>
    </>
  );
}

function ControlesBolha({ estado, mudar }: { estado: Estado; mudar: Mudar }) {
  const bolha = estado.bolha;
  const alterar = (parte: Partial<Estado["bolha"]>) =>
    mudar((atual) => ({ ...atual, bolha: { ...atual.bolha, ...parte } }));

  return (
    <>
      <Opcoes
        rotulo="Largura"
        opcoes={(Object.keys(BOLHA) as LarguraBolha[]).map((valor) => ({ valor, rotulo: BOLHA[valor].rotulo }))}
        atual={bolha.largura}
        aoEscolher={(largura) => alterar({ largura })}
      />
      <Opcoes
        rotulo="Bolha"
        opcoes={[
          { valor: "Pequena" as const, rotulo: "Pequena" },
          { valor: "Grande" as const, rotulo: "Grande" },
        ]}
        atual={bolha.bolha}
        aoEscolher={(tamanho) => alterar({ bolha: tamanho })}
      />
      <NotaDaTabela>
        O rolo tem 100 m e o preço é <strong className="text-tinta">por rolo</strong>. Na descrição, a largura
        sai em metros, como o mercado escreve.
      </NotaDaTabela>
    </>
  );
}

/** O pote cresce com a capacidade, baixo e largo; a tampa desce no conjunto. */
const ESCALA_POTE: Record<CapacidadePote, number> = { "250": 0.66, "500": 0.82, "1000": 1 };
const COR_POTE = { fill: "var(--placa-lilas)", stroke: "var(--placa-lilas-traco)" };

function DesenhoPote({ estado }: { estado: Estado }) {
  const { capacidade, tampa } = estado.pote;

  return (
    <m.svg
      viewBox="0 0 120 120"
      className="w-[150px] h-[150px] overflow-visible"
      style={{ originY: 1 }}
      animate={{ scale: ESCALA_POTE[capacidade] }}
      transition={MOLA}
    >
      <rect x={14} y={41} width={92} height={75} rx={14} style={{ ...COR_POTE, strokeWidth: 1.25 }} />
      {/* O rótulo. */}
      <rect x={14} y={62} width={92} height={30} style={{ fill: COR_POTE.stroke, opacity: 0.14 }} />
      {/* A boca larga, com a rosca: some embaixo da tampa. */}
      <rect x={24} y={30} width={72} height={12} rx={2} style={{ ...COR_POTE, strokeWidth: 1.25 }} />
      <line x1={24} x2={96} y1={34} y2={34} style={{ stroke: COR_POTE.stroke, strokeWidth: 1, opacity: 0.5 }} />
      <line x1={24} x2={96} y1={38} y2={38} style={{ stroke: COR_POTE.stroke, strokeWidth: 1, opacity: 0.5 }} />
      <AnimatePresence>
        {tampa === "COM" && <TampaQueDesce key="tampa" x={20} y={18} largura={80} altura={16} />}
      </AnimatePresence>
    </m.svg>
  );
}

/** O balde cresce com a capacidade; a alça de metal é fina e cinza, a de plástico é grossa. */
const ESCALA_BALDE: Record<CapacidadeBalde, number> = { "5": 0.62, "10": 0.8, "20": 1 };
const COR_BALDE = { fill: "var(--placa-mar)", stroke: "var(--placa-mar-traco)" };

function DesenhoBalde({ estado }: { estado: Estado }) {
  const { capacidade, alca, tampa } = estado.balde;
  const metalica = alca === "Metálica";

  return (
    <m.svg
      viewBox="0 0 130 140"
      className="w-[150px] h-[160px] overflow-visible"
      style={{ originY: 1 }}
      animate={{ scale: ESCALA_BALDE[capacidade] }}
      transition={MOLA}
    >
      <path
        d="M21 58 C21 2 109 2 109 58"
        style={{
          fill: "none",
          stroke: metalica ? "var(--tinta-3)" : COR_BALDE.stroke,
          strokeWidth: metalica ? 2 : 5,
          strokeLinecap: "round",
          transition: "stroke .3s, stroke-width .3s",
        }}
      />
      {/* O corpo, mais largo na boca que no fundo. */}
      <path
        d="M16 46 H114 L104 130 Q103 136 97 136 H33 Q27 136 26 130 Z"
        style={{ ...COR_BALDE, strokeWidth: 1.25 }}
      />
      <line x1={19} x2={111} y1={72} y2={72} style={{ stroke: COR_BALDE.stroke, strokeWidth: 1, opacity: 0.3 }} />
      <line x1={22} x2={108} y1={102} y2={102} style={{ stroke: COR_BALDE.stroke, strokeWidth: 1, opacity: 0.3 }} />
      {/* A borda, e os pinos onde a alça prende. */}
      <rect x={12} y={40} width={106} height={8} rx={3} style={{ ...COR_BALDE, strokeWidth: 1.25 }} />
      <circle cx={21} cy={58} r={3} style={{ ...COR_BALDE, strokeWidth: 1.25 }} />
      <circle cx={109} cy={58} r={3} style={{ ...COR_BALDE, strokeWidth: 1.25 }} />
      <AnimatePresence>
        {tampa === "COM" && <TampaQueDesce key="tampa" x={10} y={28} largura={110} altura={14} />}
      </AnimatePresence>
    </m.svg>
  );
}

/** A pré-forma estica com o peso; o gargalo PCO 1810 é o alto, o 1881 o baixo. */
const CORPO_PREFORMA: Record<PesoPreforma, number> = { "18": 74, "21": 88, "28": 108 };
const COR_PREFORMA = { fill: "var(--placa-mar)", stroke: "var(--placa-mar-traco)" };

function DesenhoPreforma({ estado }: { estado: Estado }) {
  const { peso, gargalo } = estado.preforma;
  const alturaGargalo = gargalo === "PCO 1810" ? 22 : 14;
  /** Onde fica o anel de suporte: logo abaixo do gargalo. */
  const anel = 8 + alturaGargalo;

  return (
    <svg viewBox="0 0 60 150" className="w-[64px] h-[160px] overflow-visible">
      {/* O tubo, que o sopro vira garrafa. */}
      <m.rect
        x={16}
        width={28}
        rx={14}
        initial={false}
        animate={{ y: anel + 2, height: CORPO_PREFORMA[peso] }}
        transition={MOLA}
        style={{ ...COR_PREFORMA, strokeWidth: 1.25 }}
      />
      {/* O gargalo, já no formato final, com a rosca. */}
      <m.rect
        x={18}
        y={8}
        width={24}
        rx={2}
        initial={false}
        animate={{ height: alturaGargalo }}
        transition={MOLA}
        style={{ ...COR_PREFORMA, strokeWidth: 1.25 }}
      />
      <line x1={18} x2={42} y1={12} y2={12} style={{ stroke: COR_PREFORMA.stroke, strokeWidth: 1, opacity: 0.5 }} />
      <line x1={18} x2={42} y1={16} y2={16} style={{ stroke: COR_PREFORMA.stroke, strokeWidth: 1, opacity: 0.5 }} />
      {/* O anel de suporte, que segura a peça na sopradora. */}
      <m.rect
        x={11}
        width={38}
        height={5}
        rx={2}
        initial={false}
        animate={{ y: anel }}
        transition={MOLA}
        style={{ ...COR_PREFORMA, strokeWidth: 1.25 }}
      />
    </svg>
  );
}

/** O big bag estica para cima com a altura; a válvula de descarga desce por baixo. */
const ALTURA_BIG_BAG: Record<AlturaBigBag, number> = { "90": 66, "120": 86, "150": 106 };
const COR_BIG_BAG = { fill: "var(--placa-pessego)", stroke: "var(--placa-pessego-traco)" };
/** A base fica parada: o saco cresce para cima, como quando se enche. */
const BASE_BIG_BAG = 128;

function DesenhoBigBag({ estado }: { estado: Estado }) {
  const altura = ALTURA_BIG_BAG[estado.bigbag.altura];
  const topo = BASE_BIG_BAG - altura;
  const alca = { fill: "none", stroke: COR_BIG_BAG.stroke, strokeWidth: 3, strokeLinecap: "round" as const };

  return (
    <svg viewBox="0 0 140 150" className="w-[150px] h-[160px] overflow-visible">
      {/* As duas alças de trás, mais apagadas. */}
      <m.g initial={false} animate={{ y: topo }} transition={MOLA}>
        <path d="M40 2 C40 -13 52 -13 52 2" style={{ ...alca, opacity: 0.45 }} />
        <path d="M88 2 C88 -13 100 -13 100 2" style={{ ...alca, opacity: 0.45 }} />
      </m.g>
      <m.rect
        x={26}
        width={88}
        rx={10}
        initial={false}
        animate={{ y: topo, height: altura }}
        transition={MOLA}
        style={{ ...COR_BIG_BAG, strokeWidth: 1.25 }}
      />
      {/* As costuras da ráfia. */}
      {[56, 84].map((x) => (
        <m.line
          key={x}
          x1={x}
          x2={x}
          y2={BASE_BIG_BAG - 6}
          initial={false}
          animate={{ y1: topo + 6 }}
          transition={MOLA}
          style={{ stroke: COR_BIG_BAG.stroke, strokeWidth: 1, strokeDasharray: "3 3", opacity: 0.45 }}
        />
      ))}
      {/* As alças da frente e a saia de enchimento, que sobem com o topo. */}
      <m.g initial={false} animate={{ y: topo }} transition={MOLA}>
        <path d="M30 6 C28 -17 48 -17 46 6" style={alca} />
        <path d="M94 6 C92 -17 112 -17 110 6" style={alca} />
        <path d="M58 1 L61 -11 H79 L82 1 Z" style={{ ...COR_BIG_BAG, strokeWidth: 1.25 }} />
        <line x1={61} x2={79} y1={-7} y2={-7} style={{ stroke: COR_BIG_BAG.stroke, strokeWidth: 1.25 }} />
      </m.g>
      <AnimatePresence>
        {estado.bigbag.valvula === "COM" && (
          <m.g
            key="valvula"
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            transition={MOLA}
          >
            <path
              d="M62 127 H78 V140 Q70 146 62 140 Z"
              style={{ ...COR_BIG_BAG, strokeWidth: 1.25 }}
            />
            <line x1={62} x2={78} y1={134} y2={134} style={{ stroke: COR_BIG_BAG.stroke, strokeWidth: 1.25 }} />
          </m.g>
        )}
      </AnimatePresence>
    </svg>
  );
}

/** O rolo da fita de arquear: a fita mais larga engrossa o rolo e a ponta solta. */
const ANEL_ARQUEAR: Record<LarguraArquear, number> = { "12": 15, "16": 20, "19": 25 };

function DesenhoArquear({ estado }: { estado: Estado }) {
  const anel = ANEL_ARQUEAR[estado.arquear.largura];

  return (
    <div className="relative grid place-items-center">
      <m.div
        className="rounded-full grid place-items-center"
        style={{
          width: 104,
          height: 104,
          border: "1px solid var(--tinta)",
          background: "repeating-radial-gradient(circle, var(--tinta) 0 2px, var(--tinta-2) 2px 3px)",
        }}
        initial={false}
        animate={{ padding: anel }}
        transition={MOLA}
      >
        {/* O tubo de papelão no meio. */}
        <span
          className="block size-full rounded-full"
          style={{ background: "var(--placa-sol)", border: "1px solid var(--placa-sol-traco)" }}
        />
      </m.div>
      {/* A ponta solta, que dá a volta na carga. */}
      <m.span
        className="absolute rounded-[2px]"
        style={{ background: "var(--tinta)", right: -30, bottom: 8, width: 46 }}
        initial={false}
        animate={{ height: 3 + anel / 5 }}
        transition={MOLA}
      />
    </div>
  );
}

/** O rolo de plástico bolha: alonga com a largura, e as bolhas crescem com o tamanho. */
const COMPRIMENTO_BOLHA: Record<LarguraBolha, number> = { "100": 96, "130": 116, "150": 132 };
const COR_BOLHA = { fundo: "var(--placa-menta)", traco: "var(--placa-menta-traco)" };
const DIAMETRO_BOLHA = 72;

function DesenhoBolha({ estado }: { estado: Estado }) {
  const { largura, bolha } = estado.bolha;
  const passo = bolha === "Grande" ? 18 : 10;

  return (
    <m.div
      className="relative flex items-center"
      initial={false}
      animate={{ width: COMPRIMENTO_BOLHA[largura] }}
      transition={MOLA}
    >
      {/* O filme enrolado, com as bolhas. */}
      <m.div
        className="flex-1 rounded-r-[14px]"
        style={{
          height: DIAMETRO_BOLHA,
          border: `1px solid ${COR_BOLHA.traco}`,
          backgroundColor: COR_BOLHA.fundo,
          backgroundImage: `radial-gradient(circle, color-mix(in srgb, ${COR_BOLHA.traco} 45%, transparent) 0 30%, transparent 34%)`,
        }}
        initial={false}
        animate={{ backgroundSize: `${passo}px ${passo}px` }}
        transition={{ duration: 0.3, ease: SUAVE }}
      />
      {/* A boca do rolo, com o tubo no meio. */}
      <div
        className="absolute left-0 -translate-x-1/2 rounded-[50%] grid place-items-center"
        style={{
          height: DIAMETRO_BOLHA,
          width: DIAMETRO_BOLHA * 0.42,
          border: `1px solid ${COR_BOLHA.traco}`,
          background: COR_BOLHA.fundo,
        }}
      >
        <span className="w-1/2 h-[30%] rounded-[50%]" style={{ background: "var(--placa-sol-traco)", opacity: 0.55 }} />
      </div>
    </m.div>
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
