/**
 * Preenche o peso em quilo dos pedidos que vieram da importação sem ele.
 *
 * COMO RODAR
 *
 *   npm run db:peso -- --escritorio "Val & Amaral"            # ensaio
 *   npm run db:peso -- --escritorio "Val & Amaral" --gravar
 *
 * POR QUE EXISTE
 *
 * `Pedido.pesoTotalKg` e `PedidoItem.pesoKg` existem desde o começo e a
 * aplicação os grava corretamente ao salvar um item (`pedidos/acoes.ts`). A
 * importação do SICOV, não: os 193 pedidos entraram com 0,000, e toda conta em
 * quilo — faixa de preço do material, meta em tonelada, peso para frete — lia
 * zero sem nada na tela dizendo por quê.
 *
 * O peso sai do SNAPSHOT do produto gravado em cada item do backup, não do
 * produto de hoje: é o peso de quando o pedido foi feito, como o resto da linha.
 *
 * Como o ensaio, roda tudo numa transação e desfaz com ROLLBACK quando não é
 * `--gravar`. Um ensaio que passa é a prova de que a gravação passa.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import "dotenv/config";
import { createReadStream } from "node:fs";
import { createGunzip } from "node:zlib";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

const argv = process.argv.slice(2);
const arg = (nome: string) => {
  const i = argv.indexOf(`--${nome}`);
  return i >= 0 ? argv[i + 1] : null;
};

const ESCRITORIO = arg("escritorio");
const ARQUIVO = arg("arquivo") ?? "referencia/sicov-backup-2026-09-13-18h30.json.gz";
const GRAVAR = argv.includes("--gravar");

if (!ESCRITORIO) {
  console.error('\nInforme o escritório:  --escritorio "Val & Amaral"\n');
  process.exit(1);
}

const UNIDADE: Record<string, string> = { thousand: "MIL", kg: "KG", unit: "UN", box: "CX" };

/** O mesmo cálculo de `pesoDoItemImportado` na importação. */
function pesoDoItem(snap: any, unidade: string, quantidade: number): number {
  if (unidade === "KG") return quantidade;

  const m = snap?.technicalData?.measurements ?? {};
  const densidade = snap?.commercialData?.density;

  if (unidade !== "MIL" || !m.width || !m.length || !m.thickness || !densidade) return 0;

  return m.width * m.length * m.thickness * densidade * quantidade;
}

async function lerBackup(caminho: string): Promise<any> {
  const pedacos: Buffer[] = [];
  for await (const p of createReadStream(caminho).pipe(createGunzip())) pedacos.push(p as Buffer);
  return JSON.parse(Buffer.concat(pedacos).toString("utf8"));
}

class Rollback extends Error {}

async function principal() {
  const sicov = await lerBackup(ARQUIVO);
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
    transactionOptions: { maxWait: 15_000, timeout: 120_000 },
  });

  // O peso de cada pedido do backup, por NÚMERO — que é como os dois lados se
  // reconhecem: o id do Mongo não sobreviveu à migração.
  const pesoPorNumero = new Map<number, number[]>();
  for (const o of sicov.orders as any[]) {
    pesoPorNumero.set(
      Number(o.orderNumber),
      ((o.items ?? []) as any[]).map((i: any) =>
        pesoDoItem(
          i.productSnapshot ?? {},
          UNIDADE[i.productSnapshot?.saleMode] ?? "UN",
          Number(i.quantity ?? 0),
        ),
      ),
    );
  }

  let pedidosTocados = 0;
  let itensTocados = 0;
  let semCorrespondencia = 0;
  let pesoTotal = 0;

  try {
    await db.$transaction(async (tx) => {
      const org = await tx.organizacao.findFirst({
        where: { nome: ESCRITORIO! },
        select: { id: true },
      });
      if (!org) throw new Error(`Escritório "${ESCRITORIO}" não encontrado.`);

      const pedidos = await tx.pedido.findMany({
        where: { organizacaoId: org.id },
        select: { id: true, numero: true, itens: { select: { id: true, ordem: true } } },
        orderBy: { numero: "asc" },
      });

      for (const pedido of pedidos) {
        const pesos = pesoPorNumero.get(pedido.numero);
        if (!pesos) {
          semCorrespondencia++;
          continue;
        }

        let soma = 0;

        for (const item of pedido.itens) {
          // `ordem` foi gravada como `indice + 1` na importação.
          const peso = pesos[item.ordem - 1] ?? 0;
          soma += peso;

          await tx.pedidoItem.update({
            where: { id: item.id },
            data: { pesoKg: peso.toFixed(3) },
          });
          itensTocados++;
        }

        await tx.pedido.update({
          where: { id: pedido.id },
          data: { pesoTotalKg: soma.toFixed(3) },
        });
        pedidosTocados++;
        pesoTotal += soma;
      }

      if (!GRAVAR) throw new Rollback();
    });
  } catch (erro) {
    if (!(erro instanceof Rollback)) throw erro;
  } finally {
    await db.$disconnect();
  }

  const kg = (n: number) => n.toLocaleString("pt-BR", { maximumFractionDigits: 3 });

  console.log(`\n${GRAVAR ? "GRAVADO" : "ENSAIO (nada foi gravado)"}`);
  console.log(`  pedidos ......... ${pedidosTocados}`);
  console.log(`  itens ........... ${itensTocados}`);
  console.log(`  peso total ...... ${kg(pesoTotal)} kg`);
  if (semCorrespondencia > 0)
    console.log(`  sem par no backup ${semCorrespondencia} (pedidos criados depois da importação)`);
  if (!GRAVAR) console.log("\n  Repita com --gravar para valer.\n");
}

principal().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
