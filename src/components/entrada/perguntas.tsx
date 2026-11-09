/**
 * Perguntas de quem está decidindo se assina.
 *
 * `<details>` nativo: abre com teclado, lê em leitor de tela e funciona sem
 * JavaScript. A animação de abrir é só CSS (`.pergunta` em `globals.css`).
 */

import { Plus } from "lucide-react";

import { PLANOS } from "@/lib/planos";
import { DIAS_DE_TESTE } from "@/lib/teste-gratis";

import { Revelar } from "./revelar";

const MOEDA = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const PERGUNTAS: { pergunta: string; resposta: string }[] = [
  {
    pergunta: "Que produtos dá para cadastrar?",
    resposta:
      "Sacos (pelo preço da medida), filmes stretch, shrink e bobina (por quilo), fitas (por caixa " +
      "ou rolo), frascos, bombonas, tampas e papelão (pela tabela da indústria, por milheiro ou " +
      "unidade). Frasco e bombona podem ir em conjunto com a tampa, que pode ser de outra indústria. " +
      "O que não se encaixa em nenhuma linha entra como avulso, com o preço digitado.",
  },
  {
    pergunta: "O que é um preposto?",
    resposta:
      "É o vendedor que trabalha para o seu escritório de representação. No plano Max cada " +
      "preposto tem o próprio login, vê só os clientes e as indústrias que você liberar, e a " +
      "comissão dos pedidos dele é rateada automaticamente.",
  },
  {
    pergunta: `Como funcionam os ${DIAS_DE_TESTE} dias grátis?`,
    resposta:
      "Ao criar o escritório, você cadastra o cartão na página do Asaas, e nada é cobrado. Durante " +
      `${DIAS_DE_TESTE} dias você usa tudo; a primeira mensalidade só é cobrada no ${DIAS_DE_TESTE}º dia ` +
      "depois do cadastro — a data aparece na tela antes de você assinar, numa faixa dentro do " +
      "sistema e num e-mail dois dias antes. Cancelou antes disso, em Configurações → Plano e " +
      "mensalidade, não paga nada. O teste vale uma vez por CPF/CNPJ.",
  },
  {
    pergunta: "Como funciona o pagamento?",
    resposta:
      "A assinatura é mensal, no cartão de crédito, cobrada pelo Asaas. Depois dos " +
      `${DIAS_DE_TESTE} dias grátis, a cobrança se repete todo mês na mesma data, sem fidelidade. ` +
      "Quem já usou o teste com o mesmo CPF/CNPJ paga a primeira mensalidade no dia do cadastro.",
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
      "de preposto. Você mesmo troca, em Configurações → Plano e mensalidade.",
  },
  {
    pergunta: "Como cancelo?",
    resposta:
      "Pelo botão “Cancelar a assinatura”, em Configurações, quando quiser. A cobrança para na " +
      "hora, o acesso continua até o fim do mês já pago, e não há multa. Nos " +
      `${DIAS_DE_TESTE} dias grátis, nada é cobrado, e você usa até o último dia do teste.`,
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
