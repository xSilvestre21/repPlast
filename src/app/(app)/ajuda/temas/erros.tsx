"use client";

/**
 * "Quando algo não dá certo": os tropeços mais comuns, um por vez.
 *
 * Sanfona de uma aberta só: a lista inteira cabe na tela, e a pessoa acha a
 * frase dela antes de ler a resposta de todas.
 */

import { ChevronDown } from "lucide-react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import Link from "next/link";
import { useId, useState, type ReactNode } from "react";

import { DIAS_DE_TESTE } from "@/lib/teste-gratis";

import { SUAVE, Texto } from "../pecas";

type Duvida = { pergunta: string; resposta: ReactNode; soAdmin?: boolean };

const DUVIDAS: Duvida[] = [
  {
    pergunta: "Apareceu uma frase vermelha embaixo de um campo",
    resposta:
      "É o sistema dizendo o que falta, no lugar exato. A frase conta o que houve e como resolver — " +
      "corrija aquele campo e salve de novo. O que você já tinha digitado nos outros campos continua lá.",
  },
  {
    pergunta: "Não consigo digitar letra num campo de valor ou medida",
    resposta:
      "É de propósito: campo de número só aceita número, para “abc” não virar zero no pedido. Use vírgula " +
      "nos centavos e ponto no milhar, como 1.250,00.",
  },
  {
    pergunta: "O pedido abriu e não deixa mexer",
    resposta:
      "Depois de salvo, o pedido (e o orçamento) abre só para leitura, para ninguém alterar sem querer. " +
      "Clique em Editar, no alto da página. A edição fica registrada.",
  },
  {
    pergunta: "Errei a senha e o sistema bloqueou a entrada",
    resposta: (
      <>
        Cinco senhas erradas fecham aquele e-mail por 15 minutos — é proteção contra quem tenta adivinhar.
        Espere os 15 minutos, ou use{" "}
        <Link href="/esqueci-senha" className="text-carimbo hover:underline">Esqueceu sua senha?</Link> na tela de
        entrada: redefinir a senha libera na hora.
      </>
    ),
  },
  {
    pergunta: "Procurei um pedido e ele não apareceu",
    resposta:
      "A busca acha por pedaço: do número (22 acha o 2224), do cliente, da indústria, do pedido do cliente " +
      "e até da medida do produto. Confira também os filtros ao lado da busca — “Enviados”, “Cancelados”, o " +
      "preposto — e use “Limpar filtro”. Em Comissões, confira o mês: o pedido entra no mês da entrega.",
  },
  {
    pergunta: "O e-mail do pedido não sai",
    resposta: (
      <>
        Falta ligar a sua caixa de e-mail, ou a senha de app deixou de valer (trocar a senha do Gmail apaga
        as senhas de app). Veja <a href="#senha-de-app" className="text-carimbo hover:underline">E-mail: a senha de app</a>{" "}
        e use o “Testar” da conta, em Configurações.
      </>
    ),
    soAdmin: true,
  },
  {
    pergunta: "A comissão de um pedido não está no mês que eu esperava",
    resposta: (
      <>
        Ela conta no mês em que a indústria paga: o da entrega, ou um ou dois meses à frente quando a
        indústria tem dia de faturamento. Veja{" "}
        <a href="#faturamento" className="text-carimbo hover:underline">Dia de faturamento</a>.
      </>
    ),
  },
  {
    pergunta: "Cancelei um pedido e ele continua na lista",
    resposta:
      "Continua, e é assim mesmo: o pedido cancelado fica riscado, sai da soma da comissão e guarda o " +
      "motivo que você escreveu. Apagar esconderia a história; reabrir o pedido também é possível.",
  },
  {
    pergunta: "O preço do produto saiu diferente do da tabela da indústria",
    resposta: (
      <>
        O preço do saco usa o fator kg do <strong className="text-tinta">produto</strong>. Reajustar a tabela
        da indústria vale para os produtos novos; nos antigos, abra o produto e troque o fator kg. Veja{" "}
        <a href="#tabelas" className="text-carimbo hover:underline">Tabelas de preço</a>.
      </>
    ),
  },
  {
    pergunta: "Vou ser cobrado no teste grátis?",
    resposta:
      `Não nos ${DIAS_DE_TESTE} primeiros dias. A primeira cobrança é no ${DIAS_DE_TESTE}º dia, e você recebe ` +
      "um e-mail dois dias antes com a data, o valor e como cancelar. Cancelando no teste, nada é cobrado.",
    soAdmin: true,
  },
];

export function Erros({ ehAdmin }: { ehAdmin: boolean }) {
  const [aberta, setAberta] = useState<number | null>(0);
  const id = useId();
  const duvidas = DUVIDAS.filter((d) => ehAdmin || !d.soAdmin);

  return (
    <div className="space-y-4">
      <Texto>O que mais trava quem está começando — e a saída de cada um.</Texto>

      <ul className="divide-y divide-filete border-y border-filete">
        {duvidas.map((duvida, i) => {
          const expandida = aberta === i;

          return (
            <li key={duvida.pergunta}>
              <button
                type="button"
                onClick={() => setAberta(expandida ? null : i)}
                aria-expanded={expandida}
                aria-controls={`${id}-${i}`}
                className="flex w-full items-center justify-between gap-4 py-3.5 text-left cursor-pointer group"
              >
                <span className={`text-corpo font-medium ${expandida ? "text-tinta" : "text-tinta-2 group-hover:text-tinta"}`}>
                  {duvida.pergunta}
                </span>
                <m.span
                  initial={false}
                  animate={{ rotate: expandida ? 180 : 0 }}
                  transition={{ duration: 0.25, ease: SUAVE }}
                  className="shrink-0 text-tinta-3"
                >
                  <ChevronDown size={17} aria-hidden="true" />
                </m.span>
              </button>
              <AnimatePresence initial={false}>
                {expandida && (
                  <m.div
                    id={`${id}-${i}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.28, ease: SUAVE }}
                    className="overflow-hidden"
                  >
                    <p className="pb-4 text-corpo text-tinta-2 max-w-2xl">{duvida.resposta}</p>
                  </m.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
