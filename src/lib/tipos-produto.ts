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
  formatarNumero,
  medidaCaixa,
  medidaCapacidade,
  medidaDiametro,
  medidaEm,
  medidasEmPartes,
} from "./descricao";
import { lerNumeroBr } from "./numero-br";
import type { Familia, UnidadeVenda } from "./produto-preco";

/** "g" é o peso da pré-forma, que mora na mesma coluna da capacidade. */
export type UnidadeCapacidade = "L" | "mL" | "g";

/**
 * O que forma a medida na descrição. A capacidade tem a escolha da unidade, e
 * por isso tela própria; as outras são uma lista de campos (`CAMPOS_DA_MEDIDA`).
 */
export type Medida =
  | "CAPACIDADE"
  | "CAIXA"
  | "DIAMETRO"
  | "PLANA"
  | "ROLO"
  | "ARQUEAR"
  | "LARGURA"
  | "CANTONEIRA";

/** As colunas de medida que os tipos por milheiro usam. */
export type CampoMedidaEmbalagem =
  | "comprimentoCm"
  | "larguraCm"
  | "alturaCm"
  | "diametroMm"
  | "larguraMm"
  | "metragemM"
  | "espessuraMm"
  | "larguraM"
  | "comprimentoMm";

export interface CampoDeMedida {
  campo: CampoMedidaEmbalagem;
  rotulo: string;
  /** Com artigo, para a frase de erro: "Informe a aba, como 50". */
  naFrase: string;
  sufixo: string;
  exemplo: string;
  /** Sem ela o produto não grava: é a medida que diz que peça é. */
  obrigatorio: boolean;
}

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
  medida?: Medida;
  /**
   * A medida pode ficar em branco. É o descartável: o copo se pede por mL, mas a
   * bandeja e a embalagem articulada se pedem pelo modelo.
   */
  medidaOpcional?: boolean;
  /** Em que se mede a capacidade; a primeira é a que o campo abre. */
  unidadesCapacidade?: readonly UnidadeCapacidade[];
  /** O nome do campo de capacidade quando ele é outra coisa: na pré-forma, o peso. */
  rotuloCapacidade?: { rotulo: string; naFrase: string };
  /**
   * Em que unidades o cadastro pode pôr o preço; a primeira é a que abre. Sem
   * ela, o preço é sempre o do milheiro. Big bag se cobra por unidade, fita de
   * arquear por quilo, plástico bolha por rolo: a indústria é quem diz.
   */
  unidadesVenda?: readonly UnidadeVenda[];
  /** O que a unidade é, quando não é óbvio: no plástico bolha, o rolo. */
  dicaUnidade?: string;
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

/** A cor de peça de nome feminino: tampa, alça, válvula. */
const COR_FEMININA: GrupoComplemento = {
  titulo: "Cor",
  umaSo: true,
  opcoes: ["Branca", "Preta", "Azul", "Vermelha", "Amarela", "Verde", "Natural"],
};

/** E a de nome masculino: batoque, balde, gatilho. */
const COR_MASCULINA: GrupoComplemento = {
  titulo: "Cor",
  umaSo: true,
  opcoes: ["Natural", "Branco", "Preto", "Azul", "Vermelho", "Amarelo", "Verde"],
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
  COR_MASCULINA,
];

/*
 * As famílias que vieram depois do batoque: o que o representante de embalagem
 * plástica vende e que antes só cabia no avulso, sem medida nem atalho.
 */

const COMPLEMENTOS_POTE: readonly GrupoComplemento[] = [
  { titulo: "Formato", umaSo: true, opcoes: ["Redondo", "Quadrado", "Retangular", "Oval"] },
  // As bocas das tampas de pote da Alemolde (80, 90 e 100 mm) e as vizinhas.
  {
    titulo: "Boca",
    umaSo: true,
    opcoes: ["Boca 63mm", "Boca 70mm", "Boca 80mm", "Boca 90mm", "Boca 100mm", "Boca 120mm"],
  },
  { titulo: "Fechamento", umaSo: true, opcoes: ["Tampa Rosca", "Tampa Pressão"] },
  { titulo: "Extras", opcoes: ["C/ Lacre", "Empilhável", "Parede Dupla", "Microondas", "Freezer"] },
  {
    titulo: "Aplicação",
    umaSo: true,
    opcoes: ["Alimento", "Sorvete", "Cosmético", "Farmacêutico", "Limpeza"],
  },
  {
    titulo: "Cor",
    umaSo: true,
    opcoes: ["Natural", "Transparente", "Branco", "Preto", "Âmbar", "Colorido"],
  },
];

const COMPLEMENTOS_BALDE: readonly GrupoComplemento[] = [
  { titulo: "Formato", umaSo: true, opcoes: ["Redondo", "Quadrado", "Retangular", "Oval"] },
  { titulo: "Alça", umaSo: true, opcoes: ["Alça Plástica", "Alça Metálica", "Sem Alça"] },
  { titulo: "Fechamento", umaSo: true, opcoes: ["Tampa Pressão", "Tampa Rosca"] },
  { titulo: "Extras", opcoes: ["C/ Lacre", "C/ Vedação", "Empilhável", "C/ Bico"] },
  { titulo: "Certificação", opcoes: ["Homologado UN", "Homologado INMETRO"] },
  {
    titulo: "Aplicação",
    umaSo: true,
    opcoes: ["Tinta", "Alimento", "Sorvete", "Construção", "Químico"],
  },
  COR_MASCULINA,
];

/** Gatilho e válvula entram no gargalo de rosca: 28/410 é o diâmetro e o acabamento dela. */
const COMPLEMENTOS_GATILHO: readonly GrupoComplemento[] = [
  { titulo: "Gargalo", umaSo: true, opcoes: ["28/400", "28/410", "28/415", "24/410"] },
  { titulo: "Jato", umaSo: true, opcoes: ["Spray", "Jato", "Spray e Jato", "Espuma"] },
  { titulo: "Extras", opcoes: ["C/ Trava", "C/ Tubo Pescador"] },
  COR_MASCULINA,
];

const COMPLEMENTOS_VALVULA: readonly GrupoComplemento[] = [
  { titulo: "Modelo", umaSo: true, opcoes: ["Pump", "Spray", "Espuma", "Dosadora"] },
  { titulo: "Gargalo", umaSo: true, opcoes: ["18/410", "20/410", "24/410", "28/410"] },
  { titulo: "Dosagem", umaSo: true, opcoes: ["0,15 mL", "0,2 mL", "1 mL", "2 mL", "4 mL"] },
  { titulo: "Extras", opcoes: ["C/ Trava", "C/ Sobretampa", "C/ Tubo Pescador"] },
  COR_FEMININA,
];

/** O gargalo é o da garrafa que ela vai virar: 30/25 é água, 55 mm é garrafão de 20 L. */
const COMPLEMENTOS_PREFORMA: readonly GrupoComplemento[] = [
  {
    titulo: "Gargalo",
    umaSo: true,
    opcoes: ["PCO 1810", "PCO 1881", "30/25", "38mm", "48mm", "55mm"],
  },
  { titulo: "Uso", umaSo: true, opcoes: ["Água", "Refrigerante", "Suco", "Óleo", "Limpeza"] },
  { titulo: "Cor", umaSo: true, opcoes: ["Cristal", "Âmbar", "Verde", "Azul", "Branca"] },
];

/**
 * A ráfia se cobra pela gramatura do tecido, e não pela espessura: por isso não
 * é saco, cuja fórmula parte da espessura.
 */
const COMPLEMENTOS_RAFIA: readonly GrupoComplemento[] = [
  {
    titulo: "Gramatura",
    umaSo: true,
    opcoes: ["50g/m²", "60g/m²", "70g/m²", "80g/m²", "90g/m²", "100g/m²"],
  },
  // A carga é como o mercado chama o saco: "60x90 para 50 kg".
  { titulo: "Carga", umaSo: true, opcoes: ["P/ 25 kg", "P/ 50 kg", "P/ 60 kg"] },
  { titulo: "Laminação", umaSo: true, opcoes: ["Laminado", "Não Laminado"] },
  { titulo: "Extras", opcoes: ["C/ Liner", "C/ Válvula", "C/ Alça", "Fundo Costurado"] },
  {
    titulo: "Impressão",
    umaSo: true,
    opcoes: ["Sem Impressão", "Impresso 1 Cor", "Impresso 2 Cores", "Impresso 3 Cores"],
  },
  {
    titulo: "Cor",
    umaSo: true,
    opcoes: ["Branco", "Bege", "Verde", "Azul", "Laranja", "Preto", "Transparente"],
  },
];

const COMPLEMENTOS_BIG_BAG: readonly GrupoComplemento[] = [
  {
    titulo: "Carga",
    umaSo: true,
    opcoes: ["500 kg", "750 kg", "1000 kg", "1200 kg", "1500 kg", "2000 kg"],
  },
  { titulo: "Alças", umaSo: true, opcoes: ["4 Alças", "2 Alças", "1 Alça"] },
  {
    titulo: "Topo",
    umaSo: true,
    opcoes: ["Topo Aberto", "Topo C/ Saia", "Topo C/ Válvula", "Topo C/ Tampa"],
  },
  { titulo: "Fundo", umaSo: true, opcoes: ["Fundo Plano", "Fundo C/ Válvula"] },
  { titulo: "Fator de segurança", umaSo: true, opcoes: ["Fator 5:1", "Fator 6:1"] },
  { titulo: "Extras", opcoes: ["Laminado", "C/ Liner", "Antiestático", "Porta-Documento"] },
  { titulo: "Cor", umaSo: true, opcoes: ["Branco", "Bege", "Azul", "Preto"] },
];

const COMPLEMENTOS_BOLHA: readonly GrupoComplemento[] = [
  { titulo: "Bolha", umaSo: true, opcoes: ["Bolha Pequena", "Bolha Média", "Bolha Grande"] },
  // A espessura do filme, que é o que os anúncios trazem ("20 micras").
  { titulo: "Espessura", umaSo: true, opcoes: ["20 Micras", "25 Micras", "30 Micras"] },
  { titulo: "Camadas", umaSo: true, opcoes: ["2 Camadas", "3 Camadas"] },
  { titulo: "Extras", opcoes: ["Antiestático", "Picotado"] },
  { titulo: "Cor", umaSo: true, opcoes: ["Natural", "Rosa", "Preto"] },
];

const COMPLEMENTOS_FITA_ARQUEAR: readonly GrupoComplemento[] = [
  { titulo: "Superfície", umaSo: true, opcoes: ["Gofrada", "Lisa"] },
  { titulo: "Aplicação", umaSo: true, opcoes: ["Manual", "Semiautomática", "Automática"] },
  {
    titulo: "Cor",
    umaSo: true,
    opcoes: ["Preta", "Branca", "Verde", "Azul", "Amarela", "Vermelha", "Natural"],
  },
];

/** O selo (ou a fivela) que fecha a fita de arquear: vai junto dela no pedido. */
const COMPLEMENTOS_SELO_ARQUEAR: readonly GrupoComplemento[] = [
  { titulo: "Modelo", umaSo: true, opcoes: ["Aberto", "Fechado", "Fivela"] },
  { titulo: "Uso", umaSo: true, opcoes: ["P/ Fita PP", "P/ Fita PET", "P/ Fita de Aço"] },
];

const COMPLEMENTOS_CANTONEIRA: readonly GrupoComplemento[] = [
  { titulo: "Formato", umaSo: true, opcoes: ["Em L", "Em U"] },
  { titulo: "Extras", opcoes: ["Impermeável", "Impressa"] },
  { titulo: "Cor", umaSo: true, opcoes: ["Parda", "Branca", "Preta"] },
];

/**
 * Os termoformados. O modelo (copo, bandeja, embalagem articulada) é o nome da
 * peça e abre a descrição; o plástico, por isso, vem aqui.
 */
const COMPLEMENTOS_DESCARTAVEL: readonly GrupoComplemento[] = [
  { titulo: "Material", umaSo: true, opcoes: ["PP", "PS", "PET", "PLA", "EPS"] },
  { titulo: "Formato", umaSo: true, opcoes: ["Redondo", "Quadrado", "Retangular"] },
  { titulo: "Extras", opcoes: ["C/ Tampa", "Articulada", "Microondas", "Freezer", "Biodegradável"] },
  { titulo: "Cor", umaSo: true, opcoes: ["Transparente", "Cristal", "Branco", "Preto"] },
  {
    titulo: "Embalagem",
    umaSo: true,
    opcoes: ["Pacote C/ 50", "Pacote C/ 100", "Caixa C/ 1000", "Caixa C/ 2500"],
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

const MATERIAIS_POTE = ["PP", "PEAD", "PET", "PS"];
const MATERIAIS_BALDE = ["PP", "PEAD", "PP Reciclado"];
const MATERIAIS_GATILHO_E_VALVULA = ["PP", "PE"];

/* -------------------------------------------------------------------------- */
/* Medidas                                                                    */
/* -------------------------------------------------------------------------- */

const campo = (
  campo: CampoMedidaEmbalagem,
  rotulo: string,
  naFrase: string,
  sufixo: string,
  exemplo: string,
  obrigatorio = true,
): CampoDeMedida => ({ campo, rotulo, naFrase, sufixo, exemplo, obrigatorio });

type ValorDaMedida = (campo: CampoMedidaEmbalagem) => number | null;

/**
 * Os campos de cada medida, na ordem da tela, e como ela sai escrita.
 *
 * A ordem é a de quem pede: saco de ráfia é largura por comprimento, como o
 * saco plástico ("60x90cm"); a cantoneira, aba por aba por espessura e depois o
 * comprimento ("50x50x5x1200mm").
 */
export const CAMPOS_DA_MEDIDA: Record<
  Exclude<Medida, "CAPACIDADE">,
  { campos: readonly CampoDeMedida[]; escrever: (valor: ValorDaMedida) => string | null }
> = {
  CAIXA: {
    campos: [
      campo("comprimentoCm", "Comprimento", "o comprimento", "cm", "30"),
      campo("larguraCm", "Largura", "a largura", "cm", "20"),
      // A chapa não tem altura.
      campo("alturaCm", "Altura", "a altura", "cm", "15", false),
    ],
    escrever: (v) => medidaCaixa(v("comprimentoCm"), v("larguraCm"), v("alturaCm")),
  },
  DIAMETRO: {
    campos: [campo("diametroMm", "Diâmetro", "o diâmetro", "mm", "28")],
    escrever: (v) => medidaDiametro(v("diametroMm")),
  },
  PLANA: {
    campos: [
      campo("larguraCm", "Largura", "a largura", "cm", "60"),
      campo("comprimentoCm", "Comprimento", "o comprimento", "cm", "90"),
    ],
    escrever: (v) => medidaEm([v("larguraCm"), v("comprimentoCm")], "cm"),
  },
  // O plástico bolha: "1,30 x 100m", a largura em metros com duas casas, como
  // o mercado escreve.
  ROLO: {
    campos: [
      campo("larguraM", "Largura", "a largura", "m", "1,30"),
      campo("metragemM", "Metragem", "a metragem", "m", "100"),
    ],
    escrever: (v) => {
      const largura = v("larguraM");
      const metragem = v("metragemM");
      if (largura === null) return medidaEm([metragem], "m");
      const texto = formatarNumero(largura, 2);
      return metragem === null ? `${texto}m` : `${texto} x ${formatarNumero(metragem)}m`;
    },
  },
  ARQUEAR: {
    campos: [
      campo("larguraMm", "Largura", "a largura", "mm", "12"),
      campo("espessuraMm", "Espessura", "a espessura", "mm", "0,6", false),
      campo("metragemM", "Metragem", "a metragem", "m", "1500", false),
    ],
    escrever: (v) =>
      medidasEmPartes([
        medidaEm([v("larguraMm"), v("espessuraMm")], "mm"),
        medidaEm([v("metragemM")], "m"),
      ]),
  },
  LARGURA: {
    campos: [campo("larguraMm", "Largura da fita", "a largura da fita", "mm", "12")],
    escrever: (v) => medidaEm([v("larguraMm")], "mm"),
  },
  // Tudo em mm, o comprimento também: "50x50x5x1200mm".
  CANTONEIRA: {
    campos: [
      campo("larguraMm", "Aba", "a aba", "mm", "50"),
      campo("espessuraMm", "Espessura", "a espessura", "mm", "5"),
      campo("comprimentoMm", "Comprimento", "o comprimento", "mm", "1200"),
    ],
    escrever: (v) =>
      medidaEm([v("larguraMm"), v("larguraMm"), v("espessuraMm"), v("comprimentoMm")], "mm"),
  },
};

/**
 * Os campos de medida do tipo, já com o nome que ele usa. Na capacidade, nenhum:
 * ela tem tela própria. No conjunto, só a medida da peça — o diâmetro da tampa
 * é da seção dela.
 */
export function camposDaMedida(tipo: TipoProduto): readonly CampoDeMedida[] {
  if (!tipo.medida || tipo.medida === "CAPACIDADE") return [];
  const { campos } = CAMPOS_DA_MEDIDA[tipo.medida];

  return campos.map((c) => {
    const ajustado =
      c.campo === "diametroMm" && tipo.rotuloDiametro
        ? {
            ...c,
            rotulo: tipo.rotuloDiametro,
            naFrase: `o ${tipo.rotuloDiametro.toLowerCase()}`,
            exemplo: tipo.exemploDiametro ?? c.exemplo,
          }
        : c;
    return tipo.medidaOpcional ? { ...ajustado, obrigatorio: false } : ajustado;
  });
}

/** A unidade em que o preço do tipo está: a escolhida, se ele aceita; senão a primeira. */
export function unidadeDeVenda(tipo: TipoProduto, unidade: string): UnidadeVenda {
  const unidades = tipo.unidadesVenda ?? ["MIL"];
  return unidades.find((u) => u === unidade) ?? unidades[0];
}

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
    valor: "POTE",
    familia: "POTE",
    rotulo: "Pote",
    nome: "Pote",
    materialAbre: false,
    rotuloMaterial: "Material",
    materiais: MATERIAIS_POTE,
    complementos: COMPLEMENTOS_POTE,
    acabamentos: ACABAMENTOS,
    medida: "CAPACIDADE",
    unidadesCapacidade: ["mL", "L"],
    exemploCapacidade: "500",
  },
  {
    valor: "POTE_TAMPA",
    familia: "POTE_TAMPA",
    rotulo: "Pote + Tampa",
    nome: "Pote",
    materialAbre: false,
    rotuloMaterial: "Material do pote",
    materiais: MATERIAIS_POTE,
    rotuloComplemento: "Complemento do pote",
    complementos: semGrupo(COMPLEMENTOS_POTE, "Fechamento"),
    acabamentos: ACABAMENTOS,
    medida: "CAPACIDADE",
    unidadesCapacidade: ["mL", "L"],
    exemploCapacidade: "500",
    comTampa: true,
  },
  {
    valor: "BALDE",
    familia: "BALDE",
    rotulo: "Balde",
    nome: "Balde",
    materialAbre: false,
    rotuloMaterial: "Material",
    materiais: MATERIAIS_BALDE,
    complementos: COMPLEMENTOS_BALDE,
    acabamentos: ACABAMENTOS,
    medida: "CAPACIDADE",
    unidadesCapacidade: ["L"],
    exemploCapacidade: "20",
  },
  {
    valor: "BALDE_TAMPA",
    familia: "BALDE_TAMPA",
    rotulo: "Balde + Tampa",
    nome: "Balde",
    materialAbre: false,
    rotuloMaterial: "Material do balde",
    materiais: MATERIAIS_BALDE,
    rotuloComplemento: "Complemento do balde",
    complementos: semGrupo(COMPLEMENTOS_BALDE, "Fechamento"),
    acabamentos: ACABAMENTOS,
    medida: "CAPACIDADE",
    unidadesCapacidade: ["L"],
    exemploCapacidade: "20",
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
    // A que protege a quina da carga no palete, junto do stretch.
    valor: "CANTONEIRA",
    familia: "CANTONEIRA",
    rotulo: "Cantoneira",
    nome: "Cantoneira",
    materialAbre: false,
    rotuloMaterial: "Material",
    materiais: ["Papelão", "Papelão Kraft", "Plástica"],
    complementos: COMPLEMENTOS_CANTONEIRA,
    medida: "CANTONEIRA",
    unidadesVenda: ["UN", "MIL"],
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
    valor: "GATILHO",
    familia: "GATILHO",
    rotulo: "Gatilho",
    nome: "Gatilho",
    materialAbre: false,
    rotuloMaterial: "Material",
    materiais: MATERIAIS_GATILHO_E_VALVULA,
    complementos: COMPLEMENTOS_GATILHO,
    medida: "DIAMETRO",
    rotuloDiametro: "Diâmetro do gargalo",
    exemploDiametro: "28",
  },
  {
    valor: "VALVULA",
    familia: "VALVULA",
    rotulo: "Válvula",
    nome: "Válvula",
    materialAbre: false,
    rotuloMaterial: "Material",
    materiais: MATERIAIS_GATILHO_E_VALVULA,
    complementos: COMPLEMENTOS_VALVULA,
    medida: "DIAMETRO",
    rotuloDiametro: "Diâmetro do gargalo",
    exemploDiametro: "24",
  },
  {
    // Pela massa: a de 18 g vira a garrafa de 500 mL; o gargalo vai no complemento.
    valor: "PREFORMA",
    familia: "PREFORMA",
    rotulo: "Pré-forma",
    nome: "Pré-forma",
    materialAbre: false,
    rotuloMaterial: "Material",
    materiais: ["PET", "PET PCR", "PET Reciclado"],
    complementos: COMPLEMENTOS_PREFORMA,
    medida: "CAPACIDADE",
    unidadesCapacidade: ["g"],
    rotuloCapacidade: { rotulo: "Peso", naFrase: "o peso" },
    exemploCapacidade: "18",
  },
  {
    valor: "RAFIA",
    familia: "RAFIA",
    rotulo: "Saco de ráfia",
    nome: "Saco de ráfia",
    materialAbre: false,
    rotuloMaterial: "Material",
    materiais: ["PP", "PP Reciclado"],
    complementos: COMPLEMENTOS_RAFIA,
    medida: "PLANA",
    unidadesVenda: ["MIL", "UN"],
  },
  {
    valor: "BIG_BAG",
    familia: "BIG_BAG",
    rotulo: "Big bag",
    nome: "Big bag",
    materialAbre: false,
    rotuloMaterial: "Material",
    materiais: ["PP"],
    complementos: COMPLEMENTOS_BIG_BAG,
    medida: "CAIXA",
    unidadesVenda: ["UN", "MIL"],
  },
  {
    valor: "BOLHA",
    familia: "BOLHA",
    rotulo: "Plástico bolha",
    nome: "Plástico bolha",
    materialAbre: false,
    rotuloMaterial: "Material",
    materiais: ["PEBD", "PEBD Reciclado"],
    complementos: COMPLEMENTOS_BOLHA,
    medida: "ROLO",
    unidadesVenda: ["UN", "KG"],
    dicaUnidade: "A unidade é o rolo.",
  },
  {
    valor: "FITA_ARQUEAR",
    familia: "FITA_ARQUEAR",
    rotulo: "Fita de arquear",
    nome: "Fita de arquear",
    materialAbre: false,
    rotuloMaterial: "Material",
    materiais: ["PP", "PET", "PP Reciclado", "Aço"],
    complementos: COMPLEMENTOS_FITA_ARQUEAR,
    medida: "ARQUEAR",
    unidadesVenda: ["KG", "UN"],
  },
  {
    valor: "SELO_ARQUEAR",
    familia: "SELO_ARQUEAR",
    rotulo: "Selo de fita de arquear",
    nome: "Selo para fita de arquear",
    materialAbre: false,
    rotuloMaterial: "Material",
    materiais: ["Aço Galvanizado", "Aço Zincado", "Plástico"],
    complementos: COMPLEMENTOS_SELO_ARQUEAR,
    medida: "LARGURA",
    unidadesVenda: ["MIL", "CX", "KG"],
  },
  {
    valor: "DESCARTAVEL",
    familia: "DESCARTAVEL",
    rotulo: "Descartável",
    nome: "Copo descartável",
    materialAbre: true,
    rotuloMaterial: "Modelo",
    materiais: [
      "Copo descartável",
      "Pote descartável",
      "Tampa descartável",
      "Bandeja",
      "Marmita",
      "Embalagem articulada",
    ],
    complementos: COMPLEMENTOS_DESCARTAVEL,
    medida: "CAPACIDADE",
    medidaOpcional: true,
    unidadesCapacidade: ["mL", "L"],
    exemploCapacidade: "200",
    unidadesVenda: ["CX", "MIL", "UN"],
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
  C extends {
    familia: string;
    material: string;
    capacidadeUnidade: string;
    unidadeAvulsa?: string;
  },
>(
  anterior: TipoProduto | null,
  novo: TipoProduto,
  atuais: C,
  vazios: C,
  manter: readonly (keyof C)[] = [],
): C {
  const mesmaFamilia = anterior?.familia === novo.familia;
  const base = mesmaFamilia
    ? atuais
    : ({ ...vazios, ...Object.fromEntries(manter.map((c) => [c, atuais[c]])) } as C);

  return {
    ...base,
    familia: novo.familia,
    material: materialAoTrocarDeTipo(anterior, novo, atuais.material),
    capacidadeUnidade: unidadeDaCapacidade(novo, base.capacidadeUnidade),
    // O tipo que escolhe a unidade do preço abre na de costume dele — big bag
    // por unidade, fita de arquear por quilo —, e não no "UN" que o vazio traz
    // para o avulso. Os outros ficam como estavam.
    ...(novo.unidadesVenda && base.unidadeAvulsa !== undefined
      ? {
          unidadeAvulsa: mesmaFamilia
            ? unidadeDeVenda(novo, base.unidadeAvulsa)
            : novo.unidadesVenda[0],
        }
      : {}),
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
  larguraMm: string;
  metragemM: string;
  espessuraMm: string;
  larguraM: string;
  comprimentoMm: string;
  /** Em que unidade está o preço, nos tipos que a escolhem. */
  unidadeAvulsa: string;
  precoAvulso: string;
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
    larguraMm: "",
    metragemM: "",
    espessuraMm: "",
    larguraM: "",
    comprimentoMm: "",
    unidadeAvulsa: "",
    precoAvulso: "",
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
  const medida = !tipo.medida
    ? null
    : tipo.medida === "CAPACIDADE"
      ? medidaCapacidade(
          lerNumeroBr(campos.capacidade),
          unidadeDaCapacidade(tipo, campos.capacidadeUnidade),
        )
      : CAMPOS_DA_MEDIDA[tipo.medida].escrever((c) => lerNumeroBr(campos[c]));

  return descricaoEmbalagem({
    nome: tipo.materialAbre ? campos.material : tipo.nome,
    medida,
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
