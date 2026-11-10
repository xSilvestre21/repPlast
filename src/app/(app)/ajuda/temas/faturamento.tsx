"use client";

/**
 * "Dia de faturamento": em que mês a comissão entra.
 *
 * É a dúvida "cadê a comissão deste pedido?" — ela está, só que dois meses à
 * frente. A ficha desliza para o mês que `mesDoRecebimento` devolve, e a frase
 * embaixo diz por quê, com os números que a pessoa escolheu.
 */

import * as m from "motion/react-m";
import Link from "next/link";
import { useState } from "react";

import { Segmentado } from "@/components/ui";
import { mesDoRecebimento } from "@/lib/parcelas";

import { Onde, Quadro, Regua, SUAVE, Texto } from "../pecas";

/** O mês do exemplo: outubro, de 31 dias. Fixo, para a conta não mudar com o calendário. */
const ANO = 2026;
const MES = 10;
const MESES = ["2026-10", "2026-11", "2026-12"];

const NOME = new Intl.DateTimeFormat("pt-BR", { month: "long", timeZone: "UTC" });
const nomeDoMes = (competencia: string) => NOME.format(new Date(`${competencia}-01T00:00:00Z`));

export function Faturamento() {
  const [comFechamento, setComFechamento] = useState<"sim" | "nao">("sim");
  const [fechamento, setFechamento] = useState(20);
  const [vencimento, setVencimento] = useState(25);

  const fecha = comFechamento === "sim" ? fechamento : null;
  const iso = `${ANO}-${MES}-${String(vencimento).padStart(2, "0")}`;
  const entra = mesDoRecebimento(iso, fecha);
  const coluna = Math.max(0, MESES.indexOf(entra));

  const explicacao =
    fecha === null
      ? `Sem dia de faturamento, a comissão conta no próprio mês: ${nomeDoMes(entra)}.`
      : vencimento <= fecha
        ? `Dia ${vencimento} é até o fechamento (dia ${fecha}): entra no faturamento de outubro, e a indústria paga em ${nomeDoMes(entra)}.`
        : `Dia ${vencimento} é depois do fechamento (dia ${fecha}): fica para o faturamento de novembro, e a indústria só paga em ${nomeDoMes(entra)}.`;

  return (
    <div className="space-y-5">
      <Texto>
        Há indústria que fecha o faturamento num dia do mês e só paga a comissão no mês seguinte. Com o dia
        cadastrado, o sistema põe cada pedido (ou parcela) no mês em que o dinheiro entra de verdade — e não
        no mês da entrega.
      </Texto>

      <Quadro className="space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rotulo text-tinta-2">A indústria tem dia de faturamento?</span>
          <Segmentado
            nome="A indústria tem dia de faturamento"
            atual={comFechamento}
            aoEscolher={setComFechamento}
            opcoes={[
              { valor: "sim", rotulo: "Tem" },
              { valor: "nao", rotulo: "Não tem" },
            ]}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Regua
            rotulo="Vencimento em outubro"
            valor={vencimento}
            aoMudar={setVencimento}
            minimo={1}
            maximo={31}
            escrito={`dia ${vencimento}`}
          />
          {fecha !== null && (
            <Regua
              rotulo="Fatura até o dia"
              valor={fechamento}
              aoMudar={setFechamento}
              minimo={1}
              maximo={31}
              escrito={`dia ${fechamento}`}
            />
          )}
        </div>

        {/* Os três meses, e a ficha que desliza até o da comissão. */}
        <div>
          <div className="grid grid-cols-3 gap-2">
            {MESES.map((competencia, i) => (
              <div
                key={competencia}
                className={`rounded-suave border px-2 py-2 text-center text-mini font-semibold capitalize transition-colors duration-300 ${
                  i === coluna ? "border-carimbo text-tinta bg-carimbo-fraco" : "border-filete text-tinta-3 bg-folha"
                }`}
              >
                {nomeDoMes(competencia)}
              </div>
            ))}
          </div>
          <div className="mt-2 relative h-10" aria-hidden="true">
            <m.div
              className="absolute left-0 top-0 w-1/3 px-1"
              initial={false}
              animate={{ x: `${coluna * 100}%` }}
              transition={{ type: "spring", stiffness: 220, damping: 24 }}
            >
              <div className="rounded-full bg-carimbo text-sobre-carimbo text-mini font-semibold text-center py-2 shadow-suave">
                comissão
              </div>
            </m.div>
          </div>
        </div>

        <m.p
          key={explicacao}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, ease: SUAVE }}
          role="status"
          className="text-corpo text-tinta"
        >
          {explicacao}
        </m.p>
      </Quadro>

      <ul className="space-y-1.5 text-corpo text-tinta-2 list-disc pl-5 max-w-2xl">
        <li>
          O dia fica no cadastro da indústria, no campo “Só paga a comissão após faturar até o dia”. Os
          pedidos novos já nascem com ele; em branco, a comissão conta no próprio mês.
        </li>
        <li>
          Um pedido é exceção? Troque o dia só dele, no acerto ou no parcelamento. O cadastro da indústria
          não muda.
        </li>
        <li>
          Fechamento no dia 31 num mês de 30 dias vale como o último dia do mês.
        </li>
        <li>
          Mudar o dia na indústria não mexe nos pedidos que já existem — só nos que forem lançados depois.
        </li>
      </ul>

      <Onde>
        <Link href="/fornecedores" className="text-carimbo hover:underline">Fornecedores</Link> → a indústria →
        Editar → “Só paga a comissão após faturar até o dia”
      </Onde>
    </div>
  );
}
