/**
 * O catálogo dos tipos de produto: o que se escolhe na tela, as medidas de cada
 * um e os complementos prontos.
 *
 * Fonte única do cadastro de produto e do item por conta da proposta. Mudar um
 * material ou um complemento é mudar uma linha aqui, e as duas telas acompanham.
 * Os complementos saíram dos catálogos das indústrias (Soroplast, Alemolde,
 * Greco & Guerreiro, Velaplast, Ibeplas) e são só atalhos: o campo continua aberto
 * para digitar.
 *
 * O TIPO é o que se escolhe; o que vai para o servidor é a FAMÍLIA. Quase sempre
 * são a mesma coisa. O shrink é a exceção: o representante vende e fala dele como
 * coisa própria, mas no cadastro ele é STRETCH — por kg, sem medida de saco —, que
 * é como a importação do SICOV já o grava.
 *
 * Módulo puro: sem I/O, roda no navegador e no servidor.
 */

import type { GrupoComplemento } from "./complemento";
import {
  descricaoEmbalagem,
  medidaCaixa,
  medidaCapacidade,
  medidaDiametro,
} from "./descricao";
import { lerNumeroBr } from "./numero-br";
import type { Familia } from "./produto-preco";

export type UnidadeCapacidade = "L" | "mL";

export interface TipoProduto {
  valor: string;
  familia: Familia;
  rotulo: string;
  /** O que abre a descrição impressa. No saco é vazio: ali abrem as medidas. */
  nome: string;
  /**
   * O campo Material abre a descrição, em vez de vir depois das medidas.
   *
   * É o caso de "Fita adesiva" e "Caixa de papelão": ali o campo é o nome do
   * item, e não um plástico.
   */
  materialAbre: boolean;
  /** Rótulo do campo. Vazio, cada tela usa o seu nome de sempre. */
  rotuloMaterial?: string;
  /** Sugestões do campo: digitar outra coisa continua valendo. */
  materiais: readonly string[];
  /** Rótulo do Complemento, no conjunto em que há dois. */
  rotuloComplemento?: string;
  complementos: readonly GrupoComplemento[];
  /** Os acabamentos que o tipo aceita. Vazio, ele não tem essa seção. */
  acabamentos?: readonly GrupoComplemento[];
  /** Que medida forma a descrição, nas famílias vendidas por milheiro. */
  medida?: "CAPACIDADE" | "CAIXA" | "DIAMETRO";
  /** Em que se mede a capacidade; a primeira é a que o campo abre. */
  unidadesCapacidade?: readonly UnidadeCapacidade[];
  /** O produto leva tampa junto: tem diâmetro, material e complemento dela. */
  comTampa?: boolean;
  /** Exemplo do campo de capacidade. */
  exemploCapacidade?: string;
  /**
   * Nome do campo de diâmetro, quando não é o da própria peça. No batoque e na
   * alça é o do gargalo onde ela entra: o "13" do "Batoque 13" é o modelo, e o
   * gargalo é de 18 mm.
   */
  rotuloDiametro?: string;
  /** Exemplo do campo de diâmetro. */
  exemploDiametro?: string;
}

/* -------------------------------------------------------------------------- */
/* Complementos                                                               */
/* -------------------------------------------------------------------------- */

/** Como a parede é feita: a coex e a fluoretação podem vir juntas. */
const TECNOLOGIA: GrupoComplemento = {
  titulo: "Tecnologia",
  opcoes: ["Monocamada", "Coex", "Fluoretada"],
};

const COMPLEMENTOS_BOMBONA: readonly GrupoComplemento[] = [
  {
    titulo: "Fechamento",
    umaSo: true,
    opcoes: ["Tampa Fixa", "Tampa Removível", "Tampa Rosca"],
  },
  { titulo: "Gargalo", umaSo: true, opcoes: ["Catraca", "Flush"] },
  { titulo: "Boca", umaSo: true, opcoes: ["Boca Estreita", "Boca Larga", "2 Bocais"] },
  {
    titulo: "Bocal",
    umaSo: true,
    opcoes: [
      "Bocal 38mm",
      "Bocal 40mm",
      "Bocal 42mm",
      "Bocal 45mm",
      "Bocal 50mm",
      "Bocal 58mm",
      "Bocal 60mm",
      "Bocal 63mm",
      "Bocal 65mm",
      'Bocal 2"',
    ],
  },
  {
    titulo: "Segurança",
    opcoes: ["C/ Lacre", "Lacre Catraca", "Cinta de Segurança", "Selo de Indução", "Polexan"],
  },
  {
    titulo: "Formato",
    opcoes: [
      "Cilíndrica",
      "Retangular",
      "Empilhável",
      "Auto-Empilhável",
      "Colunada",
      "C/ Alça",
      "Alça Estrangulada",
    ],
  },
  TECNOLOGIA,
  { titulo: "Certificação", opcoes: ["Homologada INMETRO", "Homologada UN"] },
  { titulo: "Cor", umaSo: true, opcoes: ["Natural", "Branca", "Azul", "Preta"] },
];

const COMPLEMENTOS_FRASCO: readonly GrupoComplemento[] = [
  {
    titulo: "Formato",
    umaSo: true,
    opcoes: ["Cilíndrico", "Oval", "Quadrado", "Retangular", "Almotolia"],
  },
  {
    titulo: "Tampa",
    umaSo: true,
    opcoes: [
      "Tampa Rosca",
      "Tampa Lacre",
      "Tampa Flip Top",
      "Tampa Disc Top",
      "Tampa Dosadora",
      "Gatilho",
      "Válvula Pump",
      "Spray",
    ],
  },
  {
    titulo: "Extras",
    opcoes: ["C/ Alça", "Alça Profunda", "C/ Batoque", "C/ Dosador", "C/ Vedante", "Hotfill"],
  },
  {
    titulo: "Bocal",
    umaSo: true,
    opcoes: [
      "Bocal 18mm",
      "Bocal 20mm",
      "Bocal 24mm",
      "Bocal 28mm",
      "Bocal 30mm",
      "Bocal 38mm",
      "Bocal 45mm",
      "Bocal 63mm",
    ],
  },
  { titulo: "Gargalo", umaSo: true, opcoes: ["Catraca", "Flush"] },
  TECNOLOGIA,
  {
    titulo: "Aplicação",
    umaSo: true,
    opcoes: [
      "Lácteo",
      "Detergente",
      "Desinfetante",
      "Sabonete Líquido",
      "Amaciante",
      "Multiuso",
      "Aditivo",
      "Farmacêutico",
    ],
  },
  {
    titulo: "Cor",
    umaSo: true,
    opcoes: ["Natural", "Branco", "Preto", "Âmbar", "Colorido"],
  },
];

const COMPLEMENTOS_PAPELAO: readonly GrupoComplemento[] = [
  {
    titulo: "Onda",
    umaSo: true,
    opcoes: ["Onda B", "Onda C", "Onda E", "Onda BC", "Micro-ondulado"],
  },
  {
    titulo: "Parede",
    umaSo: true,
    opcoes: ["Parede Simples", "Parede Dupla", "Parede Tripla"],
  },
  { titulo: "Papel", umaSo: true, opcoes: ["Kraft", "Semi-Kraft", "Branco", "Reciclado"] },
  {
    titulo: "Formato",
    umaSo: true,
    opcoes: ["Maleta (FEFCO 0201)", "Corte e Vinco", "Tampa e Fundo"],
  },
  { titulo: "Medida", umaSo: true, opcoes: ["Medida Interna", "Medida Externa"] },
  {
    titulo: "Impressão",
    umaSo: true,
    opcoes: ["Sem Impressão", "Impressa 1 Cor", "Impressa 2 Cores"],
  },
];

/** A cor de peça de nome feminino: tampa e alça. */
const COR_FEMININA: GrupoComplemento = {
  titulo: "Cor",
  umaSo: true,
  opcoes: ["Branca", "Preta", "Azul", "Vermelha", "Amarela", "Verde", "Natural"],
};

/**
 * Também os da tampa que acompanha o conjunto.
 *
 * Conferido com o catálogo inteiro da Alemolde (site e PDF): o que separa a
 * "Baixa 38 Lacre" da "Baixa 38 Lacre 3.0" é só o tipo do lacre, e por isso ele
 * tem grupo próprio — e o galão, que tem lacre, não perde o modelo para ele.
 * PCO 38 é o gargalo das tampas de 38 mm; o Finish Europeu é o da Push Pull Alta.
 */
export const COMPLEMENTOS_TAMPA: readonly GrupoComplemento[] = [
  {
    titulo: "Modelo",
    umaSo: true,
    opcoes: [
      "Rosca",
      "Lacre",
      "Flip Top",
      "Disc Top",
      "Push Pull",
      "Dosadora",
      "Copo",
      "Bico Aplicador",
      "Segurança",
      "Galão",
      "Óleo",
      "Spray",
      "Pote",
      "Lenço Umedecido",
    ],
  },
  { titulo: "Altura", umaSo: true, opcoes: ["Baixa", "Alta"] },
  {
    titulo: "Gargalo",
    umaSo: true,
    opcoes: ["PCO 1810", "PCO 1881", "PCO 38", "28/410", "Finish Europeu"],
  },
  {
    titulo: "Tipo de lacre",
    umaSo: true,
    opcoes: ["Lacre Aletas Dobradas", "Lacre Anel Seccionado", "Lacre Catraca"],
  },
  { titulo: "Colocação", umaSo: true, opcoes: ["Por Rosca", "Por Pressão"] },
  { titulo: "Orifício", umaSo: true, opcoes: ["Orifício Aberto", "Orifício Fechado"] },
  {
    titulo: "Vedação",
    opcoes: ["Vedação Própria", "C/ Selo de Indução", "C/ Vedante", "C/ Disco", "C/ Gaxeta"],
  },
  {
    titulo: "Extras",
    opcoes: [
      "C/ Batoque",
      "C/ Copo Dosador",
      "C/ Disco Ventilado",
      "C/ Válvula Gore",
      "C/ Respiro",
      "Dobradiça Borboleta",
    ],
  },
  COR_FEMININA,
];

/**
 * O batoque: a peça que entra sob pressão no gargalo, com ou sem furo. Vende-se
 * solto, por milheiro, e o modelo da tampa com que ele vai fica no Uso — é como
 * a Alemolde os nomeia ("Batoque para Tampa 18 Lacre").
 */
const COMPLEMENTOS_BATOQUE: readonly GrupoComplemento[] = [
  { titulo: "Modelo", umaSo: true, opcoes: ["Cego", "C/ Furo", "Conta-Gotas", "Dosador"] },
  {
    titulo: "Uso",
    umaSo: true,
    opcoes: ["P/ Tampa Lacre", "P/ Tampa Segurança", "P/ Tampa Rosca", "P/ Aromatizante"],
  },
  {
    titulo: "Cor",
    umaSo: true,
    opcoes: ["Natural", "Branco", "Preto", "Azul", "Vermelho", "Amarelo", "Verde"],
  },
];

/**
 * Os acabamentos de frasco e bombona. Só um por peça, em todos os grupos juntos:
 * o que é rotulado não é serigrafado. Fora daqui, a tela aceita um nome digitado.
 *
 * "Manga" costuma ser a tradução de "sleeve"; as duas ficam porque o representante
 * as trata como coisas diferentes.
 */
export const ACABAMENTOS: readonly GrupoComplemento[] = [
  { titulo: "Impressão", opcoes: ["Serigrafado", "Tampografado", "Hot Stamping", "Transfer"] },
  {
    titulo: "Rotulado",
    opcoes: ["Rotulado Adesivo", "Rotulado Manga", "Rotulado Wrap Around", "Rotulado IML"],
  },
  { titulo: "Sleeve", opcoes: ["Sleeve", "Stretch Sleeve"] },
];

/** No conjunto, quem fala da tampa é a seção dela. */
const semGrupo = (grupos: readonly GrupoComplemento[], titulo: string) =>
  grupos.filter((g) => g.titulo !== titulo);

/* -------------------------------------------------------------------------- */
/* Materiais                                                                  */
/* -------------------------------------------------------------------------- */

// Não são todos: cada indústria tem as suas grafias, e por isso o campo aceita
// o que for digitado. Estes são os que os fabricantes mais citam.
const MATERIAIS_BOMBONA = ["PEAD", "PEAD Virgem", "PEAD Reciclado", "PEAD PCR", "PEBD", "PP"];
const MATERIAIS_FRASCO = ["PEAD", "PET", "PP", "PEBD"];

/**
 * Também os da tampa que acompanha o conjunto. "PE" é como a Alemolde escreve o
 * polietileno, sem dizer se é de alta ou de baixa.
 */
export const MATERIAIS_TAMPA = ["PP", "PP Reciclado", "PE", "PEAD", "PEBD"];

/** Batoque e alça: polietileno quase sempre, e PP no batoque de tampa de rosca. */
const MATERIAIS_BATOQUE_E_ALCA = ["PE", "PEBD", "PEAD", "PP"];

/* -------------------------------------------------------------------------- */
/* Os tipos                                                                   */
/* -------------------------------------------------------------------------- */

export const TIPOS: readonly TipoProduto[] = [
  {
    valor: "SACO",
    familia: "SACO",
    rotulo: "Saco plástico",
    nome: "",
    materialAbre: false,
    materiais: [],
    complementos: [],
  },
  // As grafias sugeridas nestes quatro são as do acervo do SICOV.
  {
    valor: "FITA",
    familia: "FITA",
    rotulo: "Fita",
    nome: "Fita adesiva",
    materialAbre: true,
    materiais: ["Fita adesiva"],
    complementos: [],
  },
  {
    valor: "STRETCH",
    familia: "STRETCH",
    rotulo: "Stretch",
    nome: "FILME STRETCH",
    materialAbre: true,
    materiais: ["FILME STRETCH", "FILM STRETCH"],
    complementos: [],
  },
  {
    valor: "SHRINK",
    familia: "STRETCH",
    rotulo: "Shrink",
    nome: "FILME SHRINK",
    materialAbre: true,
    materiais: ["FILME SHRINK", "SHRINK"],
    complementos: [],
  },
  {
    valor: "BOBINA",
    familia: "BOBINA",
    rotulo: "Bobina",
    nome: "BOBINA",
    materialAbre: true,
    materiais: ["BOBINA", "BOBINA TUBULAR", "ECOFILM"],
    complementos: [],
  },
  {
    valor: "BOMBONA",
    familia: "BOMBONA",
    rotulo: "Bombona",
    nome: "Bombona",
    materialAbre: false,
    rotuloMaterial: "Material",
    materiais: MATERIAIS_BOMBONA,
    complementos: COMPLEMENTOS_BOMBONA,
    acabamentos: ACABAMENTOS,
    medida: "CAPACIDADE",
    unidadesCapacidade: ["L"],
    exemploCapacidade: "20",
  },
  {
    valor: "BOMBONA_TAMPA",
    familia: "BOMBONA_TAMPA",
    rotulo: "Bombona + Tampa",
    nome: "Bombona",
    materialAbre: false,
    rotuloMaterial: "Material da bombona",
    materiais: MATERIAIS_BOMBONA,
    rotuloComplemento: "Complemento da bombona",
    complementos: semGrupo(COMPLEMENTOS_BOMBONA, "Fechamento"),
    acabamentos: ACABAMENTOS,
    medida: "CAPACIDADE",
    unidadesCapacidade: ["L"],
    exemploCapacidade: "20",
    comTampa: true,
  },
  {
    valor: "FRASCO",
    familia: "FRASCO",
    rotulo: "Frasco",
    nome: "Frasco",
    materialAbre: false,
    rotuloMaterial: "Material",
    materiais: MATERIAIS_FRASCO,
    complementos: COMPLEMENTOS_FRASCO,
    acabamentos: ACABAMENTOS,
    medida: "CAPACIDADE",
    unidadesCapacidade: ["mL", "L"],
    exemploCapacidade: "500",
  },
  {
    valor: "FRASCO_TAMPA",
    familia: "FRASCO_TAMPA",
    rotulo: "Frasco + Tampa",
    nome: "Frasco",
    materialAbre: false,
    rotuloMaterial: "Material do frasco",
    materiais: MATERIAIS_FRASCO,
    rotuloComplemento: "Complemento do frasco",
    complementos: semGrupo(COMPLEMENTOS_FRASCO, "Tampa"),
    acabamentos: ACABAMENTOS,
    medida: "CAPACIDADE",
    unidadesCapacidade: ["mL", "L"],
    exemploCapacidade: "500",
    comTampa: true,
  },
  {
    valor: "PAPELAO",
    familia: "PAPELAO",
    rotulo: "Papelão",
    nome: "Caixa de papelão",
    materialAbre: true,
    rotuloMaterial: "Modelo",
    materiais: [
      "Caixa de papelão",
      "Chapa de papelão",
      "Bandeja de papelão",
      "Divisória de papelão",
    ],
    complementos: COMPLEMENTOS_PAPELAO,
    medida: "CAIXA",
  },
  {
    valor: "TAMPA",
    familia: "TAMPA",
    rotulo: "Tampa",
    nome: "Tampa",
    materialAbre: false,
    rotuloMaterial: "Material",
    materiais: MATERIAIS_TAMPA,
    complementos: COMPLEMENTOS_TAMPA,
    medida: "DIAMETRO",
  },
  {
    valor: "BATOQUE",
    familia: "BATOQUE",
    rotulo: "Batoque",
    nome: "Batoque",
    materialAbre: false,
    rotuloMaterial: "Material",
    materiais: MATERIAIS_BATOQUE_E_ALCA,
    complementos: COMPLEMENTOS_BATOQUE,
    medida: "DIAMETRO",
    rotuloDiametro: "Diâmetro do gargalo",
    exemploDiametro: "18",
  },
  {
    // A alça que se prende ao gargalo de galão (a da Alemolde aguenta até 10 L).
    valor: "ALCA",
    familia: "ALCA",
    rotulo: "Alça",
    nome: "Alça para gargalo",
    materialAbre: false,
    rotuloMaterial: "Material",
    materiais: MATERIAIS_BATOQUE_E_ALCA,
    complementos: [COR_FEMININA],
    medida: "DIAMETRO",
    rotuloDiametro: "Diâmetro do gargalo",
    exemploDiametro: "48",
  },
  {
    valor: "AVULSO",
    familia: "AVULSO",
    rotulo: "Avulso",
    nome: "",
    materialAbre: true,
    materiais: [],
    complementos: [],
  },
];

export const OPCOES_TIPO = TIPOS.map((t) => ({ id: t.valor, rotulo: t.rotulo }));

export const tipoPorValor = (valor: string): TipoProduto =>
  TIPOS.find((t) => t.valor === valor) ?? TIPOS[0];

/**
 * O tipo de um produto já gravado.
 *
 * O shrink não tem marca própria no banco — é um STRETCH —, então é
 * reconhecido pelo nome: os importados trazem "Shrink" na descrição e o
 * material vazio; os cadastrados aqui, "FILME SHRINK" no material.
 */
export function tipoDoProduto(produto: {
  familia: string;
  material: string;
  descricao: string;
}): TipoProduto {
  if (produto.familia === "STRETCH" && /shrink/i.test(`${produto.material} ${produto.descricao}`)) {
    return tipoPorValor("SHRINK");
  }
  return tipoPorValor(produto.familia);
}

/**
 * O que o campo Material passa a ter ao trocar de tipo.
 *
 * Entre os tipos de nome livre (fita, stretch, shrink, bobina, avulso), o que a
 * pessoa digitou ali — "ECOFILME", "Fita adesiva marrom" — é dela, e trocar de
 * tipo não pode apagar. Nos outros o campo diz respeito à peça: "PEAD" não abre a
 * descrição de uma fita, e "Chapa de papelão" não é material de tampa.
 */
export function materialAoTrocarDeTipo(
  anterior: TipoProduto | null,
  novo: TipoProduto,
  material: string,
): string {
  if (!anterior) return novo.materialAbre ? novo.nome : "";
  if (anterior.valor === novo.valor) return material;

  const entreNomesLivres =
    anterior.materialAbre && novo.materialAbre && !anterior.medida && !novo.medida;
  const digitado = material.trim() !== "" && material !== anterior.nome;

  if (entreNomesLivres && digitado) return material;
  return novo.materialAbre ? novo.nome : "";
}

/**
 * Os campos depois de trocar de tipo.
 *
 * Trocar de família recomeça o produto: medida, preço, complemento e aditivos
 * eram da outra peça, e ficar com eles faria o "Natural" de uma bombona sair
 * impresso numa tampa, com o preço do conjunto. Só atravessa o que vier em
 * `manter`, que é o que não depende do tipo.
 *
 * Dentro da mesma família (stretch ↔ shrink) é o mesmo produto, e tudo fica.
 * Sem tipo ainda (`null`, o começo das duas telas), é como trocar de família.
 */
export function camposAoTrocarDeTipo<
  C extends { familia: string; material: string; capacidadeUnidade: string },
>(
  anterior: TipoProduto | null,
  novo: TipoProduto,
  atuais: C,
  vazios: C,
  manter: readonly (keyof C)[] = [],
): C {
  const base =
    anterior?.familia === novo.familia
      ? atuais
      : ({ ...vazios, ...Object.fromEntries(manter.map((c) => [c, atuais[c]])) } as C);

  return {
    ...base,
    familia: novo.familia,
    material: materialAoTrocarDeTipo(anterior, novo, atuais.material),
    capacidadeUnidade: unidadeDaCapacidade(novo, base.capacidadeUnidade),
  };
}

/** Os campos, como digitados, que formam a descrição de um tipo por milheiro. */
export interface CamposDaEmbalagem {
  material: string;
  complemento: string;
  capacidade: string;
  capacidadeUnidade: string;
  comprimentoCm: string;
  larguraCm: string;
  alturaCm: string;
  diametroMm: string;
  materialTampa: string;
  complementoTampa: string;
  /** A indústria da tampa, ou vazio para a mesma do produto. */
  fornecedorTampaId: string;
  /** "1" quando a tampa muda de fornecedor conforme a compra. */
  fornecedorTampaVariavel: string;
  acabamento: string;
  acabamentoValorCom: string;
  acabamentoValorSem: string;
}

/** Os campos vazios, menos os dados — para montar uma descrição fora do formulário. */
export function camposDaEmbalagem(parte: Partial<CamposDaEmbalagem> = {}): CamposDaEmbalagem {
  return {
    material: "",
    complemento: "",
    capacidade: "",
    capacidadeUnidade: "",
    comprimentoCm: "",
    larguraCm: "",
    alturaCm: "",
    diametroMm: "",
    materialTampa: "",
    complementoTampa: "",
    fornecedorTampaId: "",
    fornecedorTampaVariavel: "",
    acabamento: "",
    acabamentoValorCom: "",
    acabamentoValorSem: "",
    ...parte,
  };
}

/** A unidade da capacidade: a escolhida, se o tipo aceita; senão a primeira dele. */
export function unidadeDaCapacidade(tipo: TipoProduto, unidade: string): string {
  const unidades: readonly string[] = tipo.unidadesCapacidade ?? [];
  return unidades.includes(unidade) ? unidade : (unidades[0] ?? "");
}

/** A descrição de um tipo vendido por milheiro. Vale para as duas telas. */
export function descricaoDoTipo(
  tipo: TipoProduto,
  campos: CamposDaEmbalagem,
  adicionais: string[] = [],
): string {
  const medidas = {
    CAPACIDADE: () =>
      medidaCapacidade(
        lerNumeroBr(campos.capacidade),
        unidadeDaCapacidade(tipo, campos.capacidadeUnidade),
      ),
    CAIXA: () =>
      medidaCaixa(
        lerNumeroBr(campos.comprimentoCm),
        lerNumeroBr(campos.larguraCm),
        lerNumeroBr(campos.alturaCm),
      ),
    DIAMETRO: () => medidaDiametro(lerNumeroBr(campos.diametroMm)),
  };

  return descricaoEmbalagem({
    nome: tipo.materialAbre ? campos.material : tipo.nome,
    medida: tipo.medida ? medidas[tipo.medida]() : null,
    material: tipo.materialAbre ? null : campos.material,
    complemento: campos.complemento,
    acabamento: tipo.acabamentos ? campos.acabamento : null,
    tampa: tipo.comTampa
      ? {
          medida: medidaDiametro(lerNumeroBr(campos.diametroMm)),
          material: campos.materialTampa,
          complemento: campos.complementoTampa,
        }
      : null,
    adicionais,
  });
}
