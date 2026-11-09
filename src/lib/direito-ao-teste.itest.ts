/**
 * O teste grátis é um por CPF/CNPJ: quem já passou do cartão em outro
 * escritório não ganha outro; o cadastro largado no checkout não gasta nada.
 *
 * Exige banco configurado. Rode com:  npm run test:db
 */

import { randomUUID } from "node:crypto";

import { afterAll, describe, expect, it } from "vitest";

import { dbAdministrativo } from "./db";
import { documentoJaTestou } from "./direito-ao-teste";

const admin = dbAdministrativo();
const sufixo = randomUUID().slice(0, 8);
const criadas: string[] = [];

/** Um CPF de mentira, único por teste: o documento é o que se procura. */
function documento(rotulo: string) {
  return `T${rotulo}${sufixo}`.toUpperCase();
}

async function escritorio(
  doc: string,
  dados: { assinatura: "AGUARDANDO_PAGAMENTO" | "ATIVA" | "CANCELADA"; asaasAssinaturaId?: string },
) {
  const { id } = await admin.organizacao.create({
    data: { nome: `DIREITO ${sufixo} ${criadas.length}`, cobrancaDocumento: doc, ...dados },
    select: { id: true },
  });
  criadas.push(id);
  return id;
}

afterAll(async () => {
  await admin.organizacao.deleteMany({ where: { id: { in: criadas } } });
});

describe("documentoJaTestou", () => {
  it("documento novo: tem direito ao teste", async () => {
    expect(await documentoJaTestou(documento("novo"))).toBe(false);
  });

  it("o cadastro largado no checkout, sem cartão, não gasta o teste", async () => {
    const doc = documento("largado");
    await escritorio(doc, { assinatura: "AGUARDANDO_PAGAMENTO" });

    expect(await documentoJaTestou(doc)).toBe(false);
  });

  it("o escritório que cadastrou o cartão gasta — em teste, pagando ou já cancelado", async () => {
    const emTeste = documento("ativo");
    await escritorio(emTeste, { assinatura: "ATIVA", asaasAssinaturaId: `sub_dir1_${sufixo}` });
    const cancelado = documento("cancelado");
    await escritorio(cancelado, { assinatura: "CANCELADA" });

    expect(await documentoJaTestou(emTeste)).toBe(true);
    expect(await documentoJaTestou(cancelado)).toBe(true);
  });

  it("o próprio escritório não conta contra ele mesmo", async () => {
    const doc = documento("proprio");
    const id = await escritorio(doc, { assinatura: "AGUARDANDO_PAGAMENTO", asaasAssinaturaId: `sub_dir2_${sufixo}` });

    expect(await documentoJaTestou(doc, id)).toBe(false);
    expect(await documentoJaTestou(doc)).toBe(true);
  });
});
