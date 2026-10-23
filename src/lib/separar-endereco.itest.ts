/**
 * Teste de integração de `separar_numero_do_endereco`, a função do banco que
 * repartiu os endereços antigos ("Rua X, 123 Galpão F") em rua, número e
 * complemento — e que o importador do SICOV continua usando.
 *
 * Os casos vêm dos cadastros reais. O que se protege: o número certo sai da
 * rua, o resto vira complemento, e o que não tem número claro (rodovia com km,
 * fazenda) fica inteiro na rua — número errado é pior que número nenhum.
 *
 * Rode com:  npx vitest run --config vitest.integration.config.mts separar-endereco
 */

import { describe, expect, it } from "vitest";

import { dbAdministrativo } from "./db";

const admin = dbAdministrativo();

async function separar(texto: string) {
  const [linha] = await admin.$queryRaw<{ rua: string | null; numero: string | null; complemento: string | null }[]>`
    SELECT * FROM separar_numero_do_endereco(${texto})`;
  return linha;
}

describe("separar_numero_do_endereco", () => {
  it.each([
    ["Rua Carlos Fatuto, 170", "Rua Carlos Fatuto", "170", null],
    ["Avenida Waldo Zanucci,400", "Avenida Waldo Zanucci", "400", null],
    ["AV FRANCISCO MONTEIRO ,  1887", "AV FRANCISCO MONTEIRO", "1887", null],
    ["Av. A, nº 500", "Av. A", "500", null],
    ["Av. Prefeito Antonio Gonçalves, 1.000", "Av. Prefeito Antonio Gonçalves", "1.000", null],
    ["Rua José Amauri Augusto, 651B", "Rua José Amauri Augusto", "651B", null],
    ["Rua José de Sousa Costa, 116/126", "Rua José de Sousa Costa", "116/126", null],
    ["Rua João Vicente Sobrinho, s/n", "Rua João Vicente Sobrinho", "S/N", null],
    ["Rua Alvares Cabral, 1151 Galpão F", "Rua Alvares Cabral", "1151", "Galpão F"],
    ["Rua Vinte e Oito de Outubro, 231 Apto 158B", "Rua Vinte e Oito de Outubro", "231", "Apto 158B"],
    ["Rua do Mecânico, 46/66 - Jd. Ind. Werner Plaas", "Rua do Mecânico", "46/66", "Jd. Ind. Werner Plaas"],
    ["RUA DO ELETRICISTA, 320 – JD.IND.WERNER PLASS", "RUA DO ELETRICISTA", "320", "JD.IND.WERNER PLASS"],
    ["Rua 14 (Rua João do Prado Arantes), 410 W", "Rua 14 (Rua João do Prado Arantes)", "410", "W"],
    ["Av. Dom Pedro I   1154", "Av. Dom Pedro I", "1154", null],
    ["Estrada do Mirante S/N", "Estrada do Mirante", "S/N", null],
  ])("%s", async (texto, rua, numero, complemento) => {
    expect(await separar(texto)).toEqual({ rua, numero, complemento });
  });

  it.each([
    "Rodovia Comendador Pedro Monteleone, Km 172",
    "Fazenda Santa Rita Rodovia SP 215 (entradas no Km131,0 ou Km 122,2)",
    "Estrada dos Pires, Galpao 01 Quadra 485 A",
    "Nucleo Rural Vargem da Benção, cácara 38",
    "Estrada dos Romeiros SP312 KM74+630M - Galpão",
    "Rodovia Anhanguera SP 330",
  ])("sem número claro, fica inteiro na rua: %s", async (texto) => {
    expect(await separar(texto)).toEqual({ rua: texto, numero: null, complemento: null });
  });

  it("vazio continua vazio", async () => {
    expect(await separar("   ")).toEqual({ rua: null, numero: null, complemento: null });
  });
});
