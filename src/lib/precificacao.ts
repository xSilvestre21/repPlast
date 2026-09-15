/**
 * Motor de precificação — embalagens plásticas.
 *
 * Módulo puro: sem I/O, sem banco, sem framework. É a peça mais crítica do
 * sistema, porque erro aqui vira dinheiro errado no pedido e na comissão.
 *
 * A fórmula do saco foi extraída por engenharia reversa de pedidos reais
 * (2253/MARIOL e 2256/LEMEPACK, indústria QUALYPLAST) e confirmada pelo usuário.
 * Os testes em `precificacao.test.ts` usam esses pedidos como fixtures.
 */

import Decimal from "decimal.js";

Decimal.set({ rounding: Decimal.ROUND_HALF_UP, precision: 40 });

export type Familia = "SACO" | "FITA" | "STRETCH" | "BOBINA" | "AVULSO";

/**
 * Onde o valor do aditivo é somado — antes ou depois da fórmula.
 *
 * `POR_METRO_LINEAR` existe no cadastro para a tabela da indústria caber
 * inteira, mas NÃO ENTRA na conta do saco, e isso é escolha: ele depende da
 * metragem do produto, que o saco não tem. O sistema antigo somava o valor
 * cru ao preço do milheiro — o que dava, num saco, quinze centavos por mil
 * peças em vez de por metro. Preferimos não aplicar a aplicar errado.
 */
export type TipoAditivo = "POR_KG" | "POR_MILHEIRO" | "POR_METRO_LINEAR";

export interface Aditivo {
  nome: string;
  /** Sufixo que entra na descrição impressa, ex.: "C/ DESLIZANTE". */
  sufixoDescricao: string;
  tipo: TipoAditivo;
  /** Valor absoluto somado — nunca percentual. */
  valor: Decimal.Value;
}

export interface MedidasSaco {
  larguraCm: Decimal.Value;
  comprimentoCm: Decimal.Value;
  espessuraMm: Decimal.Value;
}

export interface SacoPrecificavel extends MedidasSaco {
  /** Fator kg do produto. Aditivos POR_KG são somados em cima dele. */
  fatorKg: Decimal.Value;
  /** Densidade do material. Omitida, vale `DENSIDADE_PADRAO`. */
  densidade?: Decimal.Value | null;
  aditivos?: Aditivo[];
}

/**
 * Densidade usada quando o produto não tem uma.
 *
 * 0,1 é EXATAMENTE o "÷ 10" que era constante aqui. A troca de um divisor fixo
 * por uma densidade por material foi confirmada pelo usuário contra o pedido
 * 2253, e este padrão é o que garante que produto cadastrado antes da tabela de
 * materiais existir continue valendo o mesmo centavo.
 */
export const DENSIDADE_PADRAO = new Decimal("0.1");

const CASAS_DINHEIRO = 2;

/**
 * Arredonda para centavos. Só deve ser usado na exibição e nas linhas de
 * totalização — nunca no meio de uma cadeia de cálculo.
 *
 * Regra descoberta nos PDFs reais: 1.774,872 × 6 = 10.649,23 (correto),
 * enquanto 1.774,87 × 6 = 10.649,22 (erra por um centavo).
 */
export function arredondarDinheiro(valor: Decimal.Value): Decimal {
  return new Decimal(valor).toDecimalPlaces(CASAS_DINHEIRO);
}

/** Fator kg do produto acrescido dos aditivos cobrados por quilo. */
export function fatorEfetivo(
  fatorKg: Decimal.Value,
  aditivos: Aditivo[] = [],
): Decimal {
  return aditivos
    .filter((a) => a.tipo === "POR_KG")
    .reduce<Decimal>((acc, a) => acc.plus(a.valor), new Decimal(fatorKg));
}

/**
 * Peso do milheiro, na convenção do ramo.
 *
 *     peso(kg) = largura(cm) × comprimento(cm) × espessura(mm) × densidade
 *
 * CONFIRMADO pelo usuário: é esta a conta, e o preço do milheiro é ela vezes o
 * fator kg. Foi o que substituiu o divisor 10 que vivia fixo aqui — 10 era a
 * densidade do PEAD (0,1) embutida no código, e materiais diferentes têm
 * densidades diferentes.
 *
 * Note que este valor NÃO é o peso físico do plástico: é a convenção comercial
 * usada na formação do preço, e a "densidade" daqui segue essa convenção.
 */
export function pesoMilheiroKg(
  medidas: MedidasSaco,
  densidade: Decimal.Value | null = DENSIDADE_PADRAO,
): Decimal {
  return new Decimal(medidas.larguraCm)
    .times(medidas.comprimentoCm)
    .times(medidas.espessuraMm)
    .times(densidade ?? DENSIDADE_PADRAO);
}

/**
 * Preço de um milheiro (1.000 unidades) de saco plástico.
 *
 *     preço = peso do milheiro × fator efetivo
 *             + aditivos cobrados por milheiro
 *
 * ou, aberto:
 *
 *     preço = largura(cm) × comprimento(cm) × espessura(mm) × densidade
 *             × fator efetivo + aditivos por milheiro
 *
 * Retorna o valor SEM arredondar, de propósito: quem multiplica pela quantidade
 * precisa da precisão cheia.
 */
export function precoMilheiroSaco(saco: SacoPrecificavel): Decimal {
  const aditivos = saco.aditivos ?? [];

  const base = pesoMilheiroKg(saco, saco.densidade).times(
    fatorEfetivo(saco.fatorKg, aditivos),
  );

  return aditivos
    .filter((a) => a.tipo === "POR_MILHEIRO")
    .reduce<Decimal>((acc, a) => acc.plus(a.valor), base);
}

/**
 * Quanto se deixa de faturar por milheiro ao vender abaixo do piso do material.
 *
 * Devolve `null` quando o fator está no piso ou acima — é o caso normal, e quem
 * chama usa isso para decidir se mostra o aviso.
 *
 * A comparação é contra `fatorKg`, NÃO contra o fator efetivo: o piso é do
 * material, e os aditivos por quilo somam igual dos dois lados da conta, então
 * incluí-los mudaria os dois termos sem mudar a diferença.
 *
 * O que se perde aqui não é só faturamento: a comissão é um percentual sobre um
 * total menor, então ela encolhe junto. Por isso a função existe em vez de a
 * tela só comparar dois números — este valor vira dinheiro na mão do
 * representante, e coisa que vira dinheiro tem teste neste projeto.
 */
export function faltaParaOMinimo(
  medidas: MedidasSaco,
  densidade: Decimal.Value | null | undefined,
  fatorKg: Decimal.Value,
  precoMinimoKg: Decimal.Value,
): Decimal | null {
  const faltaPorKg = new Decimal(precoMinimoKg).minus(fatorKg);
  if (faltaPorKg.lessThanOrEqualTo(0)) return null;

  return pesoMilheiroKg(medidas, densidade).times(faltaPorKg);
}

/* -------------------------------------------------------------------------- */
/* Faixas de peso                                                             */
/* -------------------------------------------------------------------------- */

export interface FaixaDePreco {
  /** Nulo = sem piso. */
  pesoDeKg?: Decimal.Value | null;
  /** Nulo = sem teto. */
  pesoAteKg?: Decimal.Value | null;
  precoKg: Decimal.Value;
}

/**
 * O preço do quilo para um pedido de determinado peso.
 *
 * Algumas indústrias cobram mais barato quanto maior a compra. A primeira faixa
 * que contém o peso vence; não havendo nenhuma, vale `precoPadrao` — que é o
 * `Material.precoKg`, o caso da esmagadora maioria dos materiais.
 *
 * O peso pode cair num BURACO entre faixas: a tabela real da SELPACK vai até
 * 300 e recomeça em 301, então 300,5 kg não pertence a faixa alguma. Cair no
 * preço padrão nesse caso é deliberado — inventar a faixa "mais próxima" seria
 * o sistema decidir um preço que ninguém cadastrou.
 *
 * É REFERÊNCIA, não cálculo automático: o preço do produto continua congelado
 * nele. Isto existe para a tela mostrar qual faixa se aplica.
 */
export function precoDaFaixa(
  faixas: FaixaDePreco[],
  pesoKg: Decimal.Value,
  precoPadrao: Decimal.Value,
): Decimal {
  const peso = new Decimal(pesoKg);

  const faixa = faixas.find((f) => {
    const acimaDoPiso = f.pesoDeKg === null || f.pesoDeKg === undefined
      ? true
      : peso.greaterThanOrEqualTo(f.pesoDeKg);

    const abaixoDoTeto = f.pesoAteKg === null || f.pesoAteKg === undefined
      ? true
      : peso.lessThanOrEqualTo(f.pesoAteKg);

    return acimaDoPiso && abaixoDoTeto;
  });

  return new Decimal(faixa ? faixa.precoKg : precoPadrao);
}
