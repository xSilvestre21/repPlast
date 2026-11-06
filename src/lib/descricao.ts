/**
 * Geração automática da descrição impressa do produto.
 *
 * O usuário digita as medidas e a descrição se monta sozinha, no formato exato
 * que sai na tabela do PDF. Formatos confirmados em pedidos reais:
 *
 *     99x166x0,08 SF 13,50 PEAD
 *     105x100x0,08 SF 15 PEAD
 *     77x150x0,05 SF 09 PEAD C/ DESLIZANTE
 */

import Decimal from "decimal.js";

/**
 * Número no padrão brasileiro, com vírgula decimal.
 *
 * `minCasas` garante um mínimo de casas sem truncar o que vier além: a espessura
 * 0,08 sai "0,08" e a 0,006 sai "0,006".
 */
export function formatarNumero(valor: Decimal.Value, minCasas = 0): string {
  const texto = new Decimal(valor).toFixed();
  const [inteira, decimal = ""] = texto.split(".");
  const casas = decimal.padEnd(minCasas, "0");
  return casas.length > 0 ? `${inteira},${casas}` : inteira;
}

export interface DescricaoSaco {
  larguraCm: Decimal.Value;
  comprimentoCm: Decimal.Value;
  espessuraMm: Decimal.Value;
  /**
   * Sanfona: TEXTO LIVRE, de propósito.
   *
   * Os pedidos reais trazem "13,50", "15" e "09" — três formatações diferentes
   * do mesmo campo. O "09" com zero à esquerda mostra que o valor é digitado,
   * não formatado a partir de um número. Guardar como texto preserva
   * exatamente o que o usuário escreveu.
   *
   * A sanfona não entra em nenhum cálculo — só na descrição.
   */
  sanfona?: string;
  /** Material, ex.: "PEAD", "PEBD". No saco ele vem DEPOIS das medidas. */
  material: string;
  /** Texto livre ao fim, ex.: cor ou acabamento. */
  complemento?: string | null;
  /** Sufixos vindos dos aditivos, ex.: ["C/ DESLIZANTE"]. */
  adicionais?: string[];
}

export function descricaoSaco(saco: DescricaoSaco): string {
  const medidas = [
    formatarNumero(saco.larguraCm),
    formatarNumero(saco.comprimentoCm),
    formatarNumero(saco.espessuraMm, 2),
  ].join("x");

  const sanfona = saco.sanfona?.trim();

  return juntar([
    medidas,
    /*
     * Sem sanfona, a descrição diz "S/SF" — não fica calada.
     *
     * É informação para quem produz: o saco sem sanfona é outro produto, e o
     * silêncio seria lido como "esqueceram de preencher". O sistema anterior
     * imprimia sempre um dos dois, e 116 dos 121 sacos sem sanfona do acervo
     * trazem o "S/SF" escrito.
     */
    sanfona ? `SF ${sanfona}` : "S/SF",
    saco.material,
    saco.complemento,
    ...(saco.adicionais ?? []),
  ]);
}

function juntar(partes: (string | null | undefined)[]): string {
  return partes
    .map((p) => p?.trim())
    .filter((p): p is string => Boolean(p))
    .join(" ");
}

/* -------------------------------------------------------------------------- */
/* Demais famílias                                                            */
/*                                                                            */
/* Formatos extraídos dos pedidos reais 133 e 146 (indústria BETAPACK):        */
/*                                                                            */
/*     Fita adesiva 45x100 transparente                                       */
/*     FILM STRETCH 500X25 BOBINA 4KG PESO LÍQUIDO                            */
/*                                                                            */
/* Diferente do saco, aqui o `material` ABRE a descrição ("Fita adesiva",     */
/* "FILM STRETCH") e o `complemento` a fecha ("transparente",                 */
/* "BOBINA 4KG PESO LÍQUIDO"). Note que não há sufixo de unidade nas medidas: */
/* é "45x100", não "45mm x 100m".                                             */
/* -------------------------------------------------------------------------- */

export interface DescricaoFita {
  /** Texto que abre a descrição, ex.: "Fita adesiva". */
  material?: string | null;
  /** Largura em milímetros, ex.: 45. */
  larguraMm?: Decimal.Value | null;
  /** Metragem do rolo, ex.: 100. */
  metragemM?: Decimal.Value | null;
  /** Texto livre ao fim, ex.: "transparente". */
  complemento?: string | null;
  adicionais?: string[];
}

export function descricaoFita(fita: DescricaoFita): string {
  return juntar([
    fita.material,
    medidasSeparadas([fita.larguraMm, fita.metragemM], "x"),
    fita.complemento,
    ...(fita.adicionais ?? []),
  ]);
}

export interface DescricaoRolo {
  /** Texto que abre a descrição, ex.: "FILM STRETCH". */
  material?: string | null;
  /** Largura em milímetros, ex.: 500. */
  larguraMm?: Decimal.Value | null;
  /** Espessura em micras, ex.: 25. */
  micragem?: Decimal.Value | null;
  /** Texto livre ao fim, ex.: "BOBINA 4KG PESO LÍQUIDO". */
  complemento?: string | null;
  adicionais?: string[];
}

export function descricaoRolo(rolo: DescricaoRolo): string {
  return juntar([
    rolo.material,
    // Maiúsculo porque é assim que a indústria imprime: "500X25".
    medidasSeparadas([rolo.larguraMm, rolo.micragem], "X"),
    rolo.complemento,
    ...(rolo.adicionais ?? []),
  ]);
}

/* -------------------------------------------------------------------------- */
/* Vendidos por milheiro: bombona, frasco, papelão, tampa e conjuntos         */
/*                                                                            */
/* Formato dos catálogos das indústrias: "1,5L" e "20L Bombona" na Greco &    */
/* Guerreiro, "TAMPA 42MM COM BATOQUE" na Soroplast. A diferença para as      */
/* famílias acima é a unidade colada no número: sem ela, "28" não diz se é    */
/* diâmetro ou capacidade, e papelão se pede tanto em cm quanto em mm.        */
/*                                                                            */
/*     Bombona 20L PEAD Tampa Removível C/ Lacre Natural                      */
/*     Caixa de papelão 30x20x15cm Onda B Kraft                               */
/*     Frasco 500mL PEAD Oval Branco + Tampa 28mm PP Flip Top Azul            */
/* -------------------------------------------------------------------------- */

/** "20L", "500mL", "1,5L". */
export function medidaCapacidade(
  capacidade: Decimal.Value | null | undefined,
  unidade: string,
): string | null {
  const texto = medidasSeparadas([capacidade], "");
  return texto ? `${texto}${unidade}` : null;
}

/** "30x20x15cm". A chapa não tem altura: "100x80cm". */
export function medidaCaixa(
  comprimentoCm: Decimal.Value | null | undefined,
  larguraCm: Decimal.Value | null | undefined,
  alturaCm: Decimal.Value | null | undefined,
): string | null {
  const texto = medidasSeparadas([comprimentoCm, larguraCm, alturaCm], "x");
  return texto ? `${texto}cm` : null;
}

/** "28mm". */
export function medidaDiametro(diametroMm: Decimal.Value | null | undefined): string | null {
  const texto = medidasSeparadas([diametroMm], "");
  return texto ? `${texto}mm` : null;
}

export interface DescricaoEmbalagem {
  /** O que abre a descrição, ex.: "Bombona", "Caixa de papelão". */
  nome?: string | null;
  /** A medida já escrita, de `medidaCapacidade`, `medidaCaixa` ou `medidaDiametro`. */
  medida?: string | null;
  material?: string | null;
  complemento?: string | null;
  /** O acabamento é do frasco ou da bombona: sai antes do "+" da tampa. */
  acabamento?: string | null;
  /** A segunda peça do conjunto: sai depois de um "+", com material e complemento dela. */
  tampa?: {
    medida?: string | null;
    material?: string | null;
    complemento?: string | null;
  } | null;
  adicionais?: string[];
}

export function descricaoEmbalagem(embalagem: DescricaoEmbalagem): string {
  const { tampa } = embalagem;

  return juntar([
    embalagem.nome,
    embalagem.medida,
    embalagem.material,
    embalagem.complemento,
    embalagem.acabamento,
    ...(tampa ? ["+", "Tampa", tampa.medida, tampa.material, tampa.complemento] : []),
    ...(embalagem.adicionais ?? []),
  ]);
}

/** Junta as medidas presentes com o separador dado, ou devolve null se não houver nenhuma. */
function medidasSeparadas(
  valores: (Decimal.Value | null | undefined)[],
  separador: string,
): string | null {
  const presentes = valores
    .filter((v) => v !== null && v !== undefined && v !== "")
    .map((v) => formatarNumero(v as Decimal.Value));

  return presentes.length > 0 ? presentes.join(separador) : null;
}
