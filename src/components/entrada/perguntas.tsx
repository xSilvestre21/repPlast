/**
 * Perguntas de quem está decidindo se assina.
 *
 * `<details>` nativo: abre com teclado, lê em leitor de tela e funciona sem
 * JavaScript. A animação de abrir é só CSS (`.pergunta` em `globals.css`).
 */

import { Plus } from "lucide-react";

import { PLANOS } from "@/lib/planos";

import { Revelar } from "./revelar";

const MOEDA = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const PERGUNTAS: { pergunta: string; resposta: string }[] = [
  {
    pergunta: "O que é um preposto?",
    resposta:
      "É o vendedor que trabalha para o seu escritório de representação. No plano Max cada " +
      "preposto tem o próprio login, vê só os clientes e as indústrias que você liberar, e a " +
      "comissão dos pedidos dele é rateada automaticamente.",
  },
  {
    pergunta: "Como funciona o pagamento?",
    resposta:
      "A assinatura é mensal, no cartão de crédito, cobrada pelo Asaas. Você paga a primeira " +
      "mensalidade ao criar o escritório e a cobrança se repete todo mês, sem fidelidade.",
  },
  {
    pergunta: "E se eu tiver mais de três prepostos?",
    resposta:
      `O Max cobre ${PLANOS.PLUS.prepostosInclusos} prepostos ativos. Cada preposto a mais soma ` +
      `${MOEDA.format(PLANOS.PLUS.precoPrepostoExtra!.toNumber())} na mensalidade — e preposto ` +
      "desativado deixa de contar na mensalidade.",
  },
  {
    pergunta: "Posso começar no Solo e passar para o Max depois?",
    resposta:
      "Pode. Seus pedidos, clientes e comissões continuam onde estão; a troca só libera as telas " +
      "de preposto. Fale com o suporte para mudar de plano.",
  },
  {
    pergunta: "Como cancelo?",
    resposta:
      "Peça o cancelamento ao suporte a qualquer momento. A cobrança para no ciclo seguinte e " +
      "não há multa.",
  },
  {
    pergunta: "Meus dados ficam seguros?",
    resposta:
      "Cada escritório fica isolado no próprio banco de dados por regras que o servidor aplica " +
      "em toda consulta — um escritório não enxerga o outro nem por engano. A senha é guardada " +
      "cifrada, e o cartão nem passa pelo RepPlast: ele é digitado na página do Asaas.",
  },
];

export function Perguntas() {
  return (
    <div className="max-w-3xl mx-auto space-y-3">
      {PERGUNTAS.map(({ pergunta, resposta }, i) => (
        <Revelar key={pergunta} atraso={i * 0.04}>
          <details className="pergunta folha group">
            <summary className="flex items-center justify-between gap-4 cursor-pointer px-5 py-4 sm:px-6 text-realce font-semibold text-tinta">
              {pergunta}
              <Plus
                size={18}
                strokeWidth={2}
                className="pergunta-sinal shrink-0 text-tinta-3"
                aria-hidden="true"
              />
            </summary>
            <p className="px-5 pb-5 sm:px-6 text-corpo text-tinta-2 leading-relaxed">{resposta}</p>
          </details>
        </Revelar>
      ))}
    </div>
  );
}
