/**
 * O e-mail de "o teste grátis está acabando", dois dias antes da primeira
 * cobrança — a promessa do cadastro, dos Termos e da faixa do sistema.
 *
 * Roda uma vez por dia, chamado pelo cron do servidor
 * (`api/rotinas/lembrete-do-teste`, ver README, "Produção"). Às 9h de
 * Brasília, quem tem a cobrança dali a até 48 horas recebe: no dia D-2, em
 * geral; no D-1, se o cron falhou na véspera. Cada escritório recebe uma vez
 * só — `lembreteTesteEm` é gravado ANTES do envio, como trava contra duas
 * rotinas ao mesmo tempo, e volta a nulo se nenhum e-mail sair, para o dia
 * seguinte tentar de novo.
 *
 * Fora da rota para ser testado contra o banco (`lembrete-do-teste.itest.ts`).
 */

import "server-only";

import { timingSafeEqual } from "node:crypto";

import { dbAdministrativo } from "./db";
import { enviarDoSistema, urlDoSistema } from "./email-sistema";
import { montarEmailSistema } from "./email-sistema-html";
import { CONTROLADOR } from "./lgpd";
import { PLANOS, valorMensal } from "./planos";
import { escreverDia, ultimoDiaGratis } from "./teste-gratis";

/** Com quanta antecedência da cobrança o aviso sai. */
const ANTECEDENCIA_MS = 48 * 60 * 60 * 1000;

const MOEDA = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

/** `Authorization: Bearer <ROTINA_TOKEN>`, comparado em tempo constante. */
export function tokenDaRotinaConfere(cabecalho: string | null): boolean {
  const esperado = process.env.ROTINA_TOKEN?.trim();
  const recebido = cabecalho?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!esperado || !recebido) return false;

  const a = Buffer.from(esperado);
  const b = Buffer.from(recebido);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function enviarLembretesDoTeste(agora: Date = new Date()): Promise<{ avisados: number }> {
  const db = dbAdministrativo();

  const escritorios = await db.organizacao.findMany({
    where: {
      assinatura: "ATIVA",
      lembreteTesteEm: null,
      testeAte: { gt: agora, lte: new Date(agora.getTime() + ANTECEDENCIA_MS) },
    },
    select: {
      id: true,
      nome: true,
      plano: true,
      testeAte: true,
      usuarios: {
        where: { papel: "ADMIN", ativo: true },
        select: { nome: true, email: true },
      },
      _count: { select: { usuarios: { where: { papel: "REPRESENTANTE", ativo: true } } } },
    },
  });

  let avisados = 0;
  for (const escritorio of escritorios) {
    if (!escritorio.testeAte || escritorio.usuarios.length === 0) continue;

    // A trava: outra rotina rodando junto já pegou este escritório.
    const pego = await db.organizacao.updateMany({
      where: { id: escritorio.id, lembreteTesteEm: null },
      data: { lembreteTesteEm: agora },
    });
    if (pego.count === 0) continue;

    const ultimoDia = ultimoDiaGratis(escritorio.testeAte);
    const cobranca = escreverDia(escritorio.testeAte);
    const plano = PLANOS[escritorio.plano];
    const valor = MOEDA.format(valorMensal(escritorio.plano, escritorio._count.usuarios).toNumber());

    const enviados = await Promise.all(
      escritorio.usuarios.map((admin) =>
        enviarDoSistema({
          para: admin.email,
          assunto: `Seu teste grátis do RepPlast termina em ${ultimoDia}`,
          ...montarEmailSistema({
            nome: admin.nome,
            paragrafos: [
              `O teste grátis do escritório ${escritorio.nome} vai até ${ultimoDia}. No dia ${cobranca}, a ` +
                `primeira mensalidade do plano ${plano.nome}, de ${valor}, é cobrada no cartão cadastrado — e ` +
                "depois todo mês, nessa data.",
              "Para continuar, não precisa fazer nada. Se não quiser continuar, cancele até " +
                `${ultimoDia} em Configurações → Plano e mensalidade, e nada é cobrado.`,
            ],
            botao: { rotulo: "Ver o plano", url: `${urlDoSistema()}/configuracoes#escritorio` },
            notas: [
              "Este aviso sai uma vez só, dois dias antes da primeira cobrança.",
              `Dúvidas? Escreva para ${CONTROLADOR.email}.`,
            ],
          }),
        }),
      ),
    );

    if (enviados.some(Boolean)) {
      avisados += 1;
    } else {
      // Nenhum saiu (o SMTP fora do ar): solta a trava, e amanhã tenta de novo.
      await db.organizacao.update({ where: { id: escritorio.id }, data: { lembreteTesteEm: null } });
    }
  }

  return { avisados };
}
