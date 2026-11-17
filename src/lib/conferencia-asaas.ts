/**
 * A conferência diária com o Asaas: cada escritório comparado com a
 * assinatura dele lá, para o aviso (webhook) que se perdeu não deixar ninguém
 * pagando e bloqueado, nem usando sem pagar.
 *
 * O Asaas repete o aviso que falha, mas depois de várias falhas PAUSA a fila
 * inteira — e um evento que o sistema não soube ligar ao escritório nunca muda
 * nada. Rodando todo dia (`api/rotinas/conferencia-asaas`, chamada pelo cron
 * do servidor — README, "A conferência diária com o Asaas"), a divergência
 * dura no máximo um dia.
 *
 * O que fazer com cada divergência é `divergencia-asaas.ts`. Aqui: perguntar
 * ao Asaas, perguntar de novo antes de bloquear alguém, e gravar só se o
 * escritório não mudou desde a leitura — o webhook pode ter chegado no meio.
 * Toda correção e todo alerta vão para o log como erro, e daí para o Sentry.
 *
 * Os escritórios "sem cobrança" (`semCobranca`) ficam de fora.
 */

import "server-only";

import { assinaturaDoCliente, assinaturaNoAsaas, cobrancasDaAssinatura, pagamentoConfigurado } from "./asaas";
import { dbAdministrativo } from "./db";
import { type Conclusao, concluir, type Vista } from "./divergencia-asaas";
import { valorMensal } from "./planos";

export interface ResultadoDaConferencia {
  conferidos: number;
  corrigidos: { escritorio: string; nome: string; de: string; para: string; motivo: string }[];
  alertas: { escritorio: string; nome: string; alerta: string }[];
  /** Os que o Asaas não respondeu — tentados de novo amanhã. */
  naoConferidos: { escritorio: string; nome: string }[];
}

type Escritorio = Awaited<ReturnType<typeof escritoriosAConferir>>[number];

function escritoriosAConferir() {
  return dbAdministrativo().organizacao.findMany({
    where: { ativa: true, semCobranca: false },
    select: {
      id: true,
      nome: true,
      plano: true,
      assinatura: true,
      acessoAte: true,
      testeAte: true,
      asaasAssinaturaId: true,
      asaasClienteId: true,
      _count: { select: { usuarios: { where: { papel: "REPRESENTANTE", ativo: true } } } },
    },
    orderBy: { criadaEm: "asc" },
  });
}

/**
 * Os clientes do Asaas que aparecem em mais de um escritório (o mesmo CPF/CNPJ
 * assinando duas vezes): a assinatura nova de um deles pode ser do outro, e
 * ligá-la seria um palpite.
 */
async function clientesRepetidos(): Promise<Set<string>> {
  const comCliente = await dbAdministrativo().organizacao.findMany({
    where: { asaasClienteId: { not: null } },
    select: { asaasClienteId: true },
  });
  const vistos = new Set<string>();
  const repetidos = new Set<string>();
  for (const { asaasClienteId } of comCliente) {
    if (!asaasClienteId) continue;
    if (vistos.has(asaasClienteId)) repetidos.add(asaasClienteId);
    vistos.add(asaasClienteId);
  }
  return repetidos;
}

/** O que o Asaas mostra deste escritório. Lança `ErroAsaas` se ele não responder. */
async function verNoAsaas(escritorio: Escritorio, repetidos: Set<string>): Promise<Vista> {
  const vista: Vista = {};

  if (escritorio.asaasAssinaturaId) {
    const gravada = await assinaturaNoAsaas(escritorio.asaasAssinaturaId);
    vista.gravada = gravada && {
      ...gravada,
      cobrancas: gravada.ativa ? await cobrancasDaAssinatura(escritorio.asaasAssinaturaId) : [],
    };
  }

  // A gravada não cobra mais (ou nunca houve): o cliente assinou de novo?
  if (!vista.gravada?.ativa && escritorio.asaasClienteId) {
    const id = await assinaturaDoCliente(escritorio.asaasClienteId);
    if (id && id !== escritorio.asaasAssinaturaId) {
      const nova = await assinaturaNoAsaas(id);
      if (nova?.ativa) {
        const dona = await dbAdministrativo().organizacao.findFirst({
          where: { asaasAssinaturaId: id, id: { not: escritorio.id } },
          select: { id: true },
        });
        vista.nova = {
          id,
          valor: nova.valor,
          cobrancas: await cobrancasDaAssinatura(id),
          deOutro: dona !== null || repetidos.has(escritorio.asaasClienteId),
        };
      }
    }
  }

  return vista;
}

function concluirSobre(escritorio: Escritorio, vista: Vista, agora: Date): Conclusao {
  return concluir(
    {
      assinatura: escritorio.assinatura,
      acessoAte: escritorio.acessoAte,
      testeAte: escritorio.testeAte,
      devido: valorMensal(escritorio.plano, escritorio._count.usuarios),
    },
    vista,
    agora,
  );
}

export async function conferirComOAsaas(agora: Date = new Date()): Promise<ResultadoDaConferencia> {
  if (!pagamentoConfigurado()) {
    throw new Error("[conferencia-asaas] o Asaas não está configurado, e a conferência não rodou.");
  }

  const db = dbAdministrativo();
  const [escritorios, repetidos] = await Promise.all([escritoriosAConferir(), clientesRepetidos()]);
  const resultado: ResultadoDaConferencia = { conferidos: 0, corrigidos: [], alertas: [], naoConferidos: [] };

  // Um por vez: são poucas consultas por escritório, e o Asaas limita as simultâneas.
  for (const escritorio of escritorios) {
    try {
      const { correcao, alertas } = concluirSobre(escritorio, await verNoAsaas(escritorio, repetidos), agora);

      for (const alerta of alertas) {
        console.error(`[conferencia-asaas] escritório ${escritorio.id}: ${alerta}`);
        resultado.alertas.push({ escritorio: escritorio.id, nome: escritorio.nome, alerta });
      }

      if (correcao) {
        // Bloquear quem entrava só com o Asaas dizendo a mesma coisa de novo: a
        // pessoa pode ter pagado entre a primeira pergunta e agora.
        const confirmada = correcao.bloqueia
          ? concluirSobre(escritorio, await verNoAsaas(escritorio, repetidos), agora).correcao
          : correcao;

        if (confirmada && confirmada.situacao === correcao.situacao && confirmada.ligar === correcao.ligar) {
          // Só se nada mudou desde a leitura: o webhook pode ter chegado no meio.
          const gravado = await db.organizacao.updateMany({
            where: {
              id: escritorio.id,
              assinatura: escritorio.assinatura,
              asaasAssinaturaId: escritorio.asaasAssinaturaId,
            },
            data: {
              assinatura: correcao.situacao,
              ...(correcao.situacao === "ATIVA" && { acessoAte: null }),
              ...(correcao.ligar && { asaasAssinaturaId: correcao.ligar }),
            },
          });

          if (gravado.count === 1) {
            console.error(
              `[conferencia-asaas] escritório ${escritorio.id} corrigido de ${escritorio.assinatura} para ` +
                `${correcao.situacao}: ${correcao.motivo}.`,
            );
            resultado.corrigidos.push({
              escritorio: escritorio.id,
              nome: escritorio.nome,
              de: escritorio.assinatura,
              para: correcao.situacao,
              motivo: correcao.motivo,
            });
          }
        }
      }

      resultado.conferidos += 1;
    } catch (erro) {
      // `warn` um a um (não vai ao Sentry) e um erro só no fim: com o Asaas
      // fora do ar, seria um alerta por escritório.
      console.warn(`[conferencia-asaas] escritório ${escritorio.id} não conferido:`, erro);
      resultado.naoConferidos.push({ escritorio: escritorio.id, nome: escritorio.nome });
    }
  }

  if (resultado.naoConferidos.length > 0) {
    console.error(
      `[conferencia-asaas] ${resultado.naoConferidos.length} de ${escritorios.length} escritórios não foram ` +
        "conferidos (o Asaas não respondeu). A rotina de amanhã tenta de novo.",
    );
  }

  return resultado;
}
