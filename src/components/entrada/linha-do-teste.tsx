/**
 * Como funcionam os 7 dias grátis, com as datas de verdade — no cadastro, ao
 * lado do formulário, onde se decide.
 *
 * A promessa "7 dias grátis" sozinha esconde o que pesa: o cartão é
 * cadastrado hoje e a cobrança vem sozinha se ninguém cancelar. Escrito como
 * três datas ("hoje", "até 15/11", "16/11") e o valor, não há como ler errado —
 * e o aceite do formulário repete as mesmas datas, para quem pulou este quadro.
 *
 * O checkout do Asaas não sabe do teste no botão: ele diz "Pagar R$ 79,00",
 * com a data certa só no resumo ("Primeira cobrança"). O texto não é nosso, então
 * a explicação vem antes, aqui e no aceite.
 */

import { Bell, CalendarCheck, CreditCard, Gift, type LucideIcon } from "lucide-react";

import { Placa } from "@/components/ui";
import { DIAS_DE_TESTE } from "@/lib/teste-gratis";

export function LinhaDoTeste({
  hoje,
  ultimoDia,
  cobranca,
  valor,
  className = "",
}: {
  /** "09/11" — ver `datasDoTeste`. */
  hoje: string;
  ultimoDia: string;
  cobranca: string;
  /** "R$ 79,00": a mensalidade do plano escolhido. */
  valor: string;
  className?: string;
}) {
  const etapas: { quando: string; titulo: string; texto: string; icone: LucideIcon; destaque?: boolean }[] = [
    {
      quando: `Hoje, ${hoje}`,
      titulo: "Você cadastra o cartão",
      texto:
        `Na página do Asaas. O botão de lá diz “Pagar ${valor}”, mas nada sai do cartão hoje — ` +
        "a data aparece ao lado, em “Primeira cobrança”. O sistema abre na hora.",
      icone: CreditCard,
    },
    {
      quando: `Até ${ultimoDia}`,
      titulo: "Use tudo, sem pagar nada",
      texto:
        "Não gostou? Cancele em Configurações → Plano e mensalidade e não paga nada. " +
        "Dois dias antes da cobrança, avisamos por e-mail.",
      icone: CalendarCheck,
    },
    {
      quando: cobranca,
      titulo: `Primeira mensalidade: ${valor}`,
      texto: "Cobrada no cartão se você não cancelar até a véspera — e depois todo mês, nessa data.",
      icone: Bell,
      destaque: true,
    },
  ];

  return (
    <section
      aria-labelledby="linha-do-teste"
      className={`folha folha-marcada border border-verde/25 p-5 sm:p-6 ${className}`}
    >
      <div className="flex items-center gap-3">
        <Placa icone={Gift} tom="menta" />
        <div>
          <span className="carimbo">{DIAS_DE_TESTE} dias grátis</span>
          <h2 id="linha-do-teste" className="mt-1 text-medio font-bold text-tinta leading-tight">
            Como funciona o teste
          </h2>
        </div>
      </div>

      <ol className="mt-5 space-y-0">
        {etapas.map((etapa, i) => {
          const Icone = etapa.icone;
          const ultima = i === etapas.length - 1;
          return (
            <li key={etapa.quando} className="relative flex gap-3.5 pb-5 last:pb-0">
              {/* O fio que liga as datas: some depois da última. */}
              {!ultima && (
                <span aria-hidden="true" className="absolute left-[0.9375rem] top-8 bottom-0 w-px bg-verde/30" />
              )}
              <span
                aria-hidden="true"
                className={`relative grid size-[1.875rem] shrink-0 place-items-center rounded-full ${
                  etapa.destaque ? "bg-tinta text-papel" : "bg-verde-fraco text-verde"
                }`}
              >
                <Icone size={15} strokeWidth={2} />
              </span>
              <div className="min-w-0 pt-0.5">
                <p className="text-mini font-semibold uppercase tracking-wide text-tinta-3 numerico">
                  {etapa.quando}
                </p>
                <p className="text-corpo font-semibold text-tinta mt-0.5">{etapa.titulo}</p>
                <p className="text-rotulo text-tinta-2 mt-0.5 leading-relaxed">{etapa.texto}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
