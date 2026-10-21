/**
 * Planilha do Excel (.xlsx) mínima, montada à mão.
 *
 * Existe porque o CSV não guarda a largura das colunas: o Excel abria tudo
 * com a largura padrão, e quem exportava tinha de alargar coluna por coluna
 * para ler "R$ 12.345,67" em vez de "########". O .xlsx leva a largura, o
 * cabeçalho fixo e o filtro — e os valores chegam como número e data de
 * verdade, não como texto que por sorte o Excel em português reconhecia.
 *
 * Uma aba, sem fórmulas e sem textos compartilhados (`inlineStr`): é o
 * mínimo que o Excel, o LibreOffice e o Google Planilhas abrem sem reclamar.
 */

import Decimal from "decimal.js";
import { strToU8, zipSync } from "fflate";

export type TipoColuna = "texto" | "inteiro" | "moeda" | "percentual" | "data";

export interface ColunaPlanilha {
  titulo: string;
  tipo: TipoColuna;
}

/** Célula vazia é `null`; número e moeda vêm como texto decimal ("1234.5"). */
export type ValorCelula = string | Date | null;

/*
 * Índices em `cellXfs` do styles.xml abaixo. Os formatos de número vão no
 * padrão invariável do arquivo (ponto decimal, vírgula de milhar): é o Excel
 * que os mostra em português — "R$ 1.234,56", "21/10/2026".
 */
const ESTILO: Record<TipoColuna | "cabecalho", number> = {
  texto: 0,
  cabecalho: 1,
  moeda: 2,
  data: 3,
  percentual: 4,
  inteiro: 5,
};

/** Largura mínima e máxima, em caracteres — a unidade de largura do Excel. */
const LARGURA_MINIMA = 8;
const LARGURA_MAXIMA = 60;

/** Dia 0 do Excel: as datas são dias contados a partir de 30/12/1899. */
const EPOCA_EXCEL = Date.UTC(1899, 11, 30);

export function gerarPlanilha(
  nomeAba: string,
  colunas: ColunaPlanilha[],
  linhas: ValorCelula[][],
): Uint8Array {
  const arquivos: Record<string, Uint8Array> = {
    "[Content_Types].xml": strToU8(TIPOS),
    "_rels/.rels": strToU8(RELACOES_RAIZ),
    "xl/workbook.xml": strToU8(pastaDeTrabalho(nomeAba)),
    "xl/_rels/workbook.xml.rels": strToU8(RELACOES_PASTA),
    "xl/styles.xml": strToU8(ESTILOS),
    "xl/worksheets/sheet1.xml": strToU8(aba(colunas, linhas)),
  };
  return zipSync(arquivos, { level: 6 });
}

/**
 * Quantos caracteres a coluna precisa para mostrar o maior valor dela como o
 * Excel vai exibi-lo — moeda com "R$" e separadores, data com dez dígitos —
 * mais uma folga para a seta do filtro no cabeçalho.
 */
export function larguraDaColuna(coluna: ColunaPlanilha, valores: ValorCelula[]): number {
  const maior = Math.max(
    coluna.titulo.length + 3,
    ...valores.map((valor) => comprimentoExibido(coluna.tipo, valor)),
  );
  // Os 10% são para nome em maiúsculas ("FRIGORÍFICO SERRA VERDE"), mais
  // largo que a média de caracteres em que a largura do Excel é medida.
  return Math.min(LARGURA_MAXIMA, Math.max(LARGURA_MINIMA, Math.ceil(maior * 1.1) + 2));
}

function comprimentoExibido(tipo: TipoColuna, valor: ValorCelula): number {
  if (valor === null || valor === "") return 0;
  if (valor instanceof Date) return 10;
  if (tipo === "moeda") {
    // "R$ " + inteiro com separador de milhar + ",00"
    const inteiro = new Decimal(valor).abs().toFixed(0).length;
    return 3 + inteiro + Math.floor((inteiro - 1) / 3) + 3 + (valor.startsWith("-") ? 1 : 0);
  }
  if (tipo === "percentual") return new Decimal(valor).toFixed(2).length;
  return valor.length;
}

function aba(colunas: ColunaPlanilha[], linhas: ValorCelula[][]): string {
  const larguras = colunas.map((coluna, i) =>
    larguraDaColuna(
      coluna,
      linhas.map((linha) => linha[i] ?? null),
    ),
  );
  const ultimaColuna = letraDaColuna(colunas.length - 1);
  const ultimaLinha = linhas.length + 1;

  const cabecalho = colunas
    .map((coluna, i) => celulaTexto(`${letraDaColuna(i)}1`, coluna.titulo, ESTILO.cabecalho))
    .join("");

  const corpo = linhas
    .map((linha, l) => {
      const n = l + 2;
      const celulas = colunas
        .map((coluna, i) => celula(`${letraDaColuna(i)}${n}`, coluna.tipo, linha[i] ?? null))
        .join("");
      return `<row r="${n}">${celulas}</row>`;
    })
    .join("");

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    // Cabeçalho congelado: rolando duzentos pedidos, o título continua à vista.
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<cols>${larguras
      .map((largura, i) => `<col min="${i + 1}" max="${i + 1}" width="${largura}" customWidth="1"/>`)
      .join("")}</cols>` +
    `<sheetData><row r="1">${cabecalho}</row>${corpo}</sheetData>` +
    `<autoFilter ref="A1:${ultimaColuna}${ultimaLinha}"/>` +
    `</worksheet>`
  );
}

function celula(ref: string, tipo: TipoColuna, valor: ValorCelula): string {
  if (valor === null || valor === "") return "";
  if (valor instanceof Date) {
    const dias = (valor.getTime() - EPOCA_EXCEL) / 86_400_000;
    return `<c r="${ref}" s="${ESTILO.data}"><v>${dias}</v></c>`;
  }
  if (tipo === "texto") return celulaTexto(ref, valor, ESTILO.texto);
  return `<c r="${ref}" s="${ESTILO[tipo]}"><v>${new Decimal(valor).toString()}</v></c>`;
}

function celulaTexto(ref: string, texto: string, estilo: number): string {
  // `xml:space` mantém espaço no começo ou no fim, que o XML jogaria fora.
  return `<c r="${ref}" t="inlineStr" s="${estilo}"><is><t xml:space="preserve">${escaparXml(texto)}</t></is></c>`;
}

/** 0 → A, 25 → Z, 26 → AA. */
export function letraDaColuna(indice: number): string {
  let letra = "";
  for (let n = indice + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    letra = String.fromCharCode(65 + ((n - 1) % 26)) + letra;
  }
  return letra;
}

function escaparXml(texto: string): string {
  return (
    texto
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      // Caractere de controle quebra o XML e o Excel recusa o arquivo inteiro.
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
  );
}

/** O nome da aba aceita no máximo 31 caracteres e não aceita : \ / ? * [ ]. */
function pastaDeTrabalho(nomeAba: string): string {
  const nome = nomeAba.replace(/[:\\/?*[\]]/g, " ").slice(0, 31) || "Planilha";
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets><sheet name="${escaparXml(nome)}" sheetId="1" r:id="rId1"/></sheets>` +
    `</workbook>`
  );
}

const TIPOS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="xml" ContentType="application/xml"/>` +
  `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
  `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
  `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
  `</Types>`;

const RELACOES_RAIZ =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
  `</Relationships>`;

const RELACOES_PASTA =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
  `<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
  `</Relationships>`;

/*
 * cellXfs, na ordem de `ESTILO`: texto, cabeçalho (negrito, fundo cinza),
 * moeda, data (formato 14, a data curta do idioma do Excel), percentual com
 * duas casas e inteiro.
 */
const ESTILOS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<numFmts count="1"><numFmt numFmtId="164" formatCode="&quot;R$&quot;\\ #,##0.00;\\-&quot;R$&quot;\\ #,##0.00"/></numFmts>` +
  `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
  `<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FFE7E9EE"/><bgColor indexed="64"/></patternFill></fill></fills>` +
  `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="6">` +
  `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/>` +
  `<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `<xf numFmtId="14" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `<xf numFmtId="2" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `<xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
  `</cellXfs>` +
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
  `</styleSheet>`;
