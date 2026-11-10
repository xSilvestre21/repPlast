"use client";

/**
 * "Comissões e acerto": previsto, recebido e a acertar — e o rateio com o
 * preposto, que é a mesma conta vista do outro lado.
 *
 * As contas são `comissaoDoPedido` e `ratearComissao`, as de Comissões.
 */

import * as m from "motion/react-m";
import Link from "next/link";
import { useState } from "react";

import { Segmentado, formatarMoeda } from "@/components/ui";
import { comissaoDoPedido, ratearComissao } from "@/lib/comissao";

import { LinhaConta, Onde, Pulo, Quadro, Regua, SUAVE, Texto } from "../pecas";

const BASE = 10000;
const PERCENTUAL = 5;

export function Comissoes() {
  const [acertado, setAcertado] = useState<"nao" | "sim">("nao");
  const [recebida, setRecebida] = useState(9000);

  const previsto = comissaoDoPedido(BASE, PERCENTUAL);
  const recebido = comissaoDoPedido(recebida, PERCENTUAL);
  const comAcerto = acertado === "sim";

  return (
    <div className="space-y-5">
      <Texto>
        Cada pedido enviado entra em Comissões como <strong className="text-tinta">previsto</strong>: a venda
        sem IPI vezes o percentual da indústria. Quando a indústria paga, você lança o{" "}
        <strong className="text-tinta">acerto</strong> — e o previsto vira recebido. O sistema nunca acerta
        sozinho: a diferença entre o previsto e o pago é negociação.
      </Texto>

      <Quadro className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="rotulo text-tinta-2">A indústria já pagou este pedido?</span>
          <Segmentado
            nome="A indústria já pagou este pedido"
            atual={acertado}
            aoEscolher={setAcertado}
            opcoes={[
              { valor: "nao", rotulo: "Ainda não" },
              { valor: "sim", rotulo: "Pagou — lançar o acerto" },
            ]}
          />
        </div>

        {comAcerto && (
          <m.div initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: SUAVE }}>
            <Regua
              rotulo="Valor recebido (a base que a indústria pagou)"
              valor={recebida}
              aoMudar={setRecebida}
              minimo={5000}
              maximo={BASE}
              passo={100}
              escrito={formatarMoeda(recebida)}
            />
          </m.div>
        )}

        <div>
          <LinhaConta rotulo={`Venda de ${formatarMoeda(BASE)} × ${PERCENTUAL}%`} valor={`previsto ${formatarMoeda(previsto.toFixed(2))}`} />
          <LinhaConta
            rotulo="Recebido"
            valor={<Pulo>{comAcerto ? formatarMoeda(recebido.toFixed(2)) : "—"}</Pulo>}
          />
          <LinhaConta
            rotulo="A acertar"
            valor={<Pulo>{comAcerto ? formatarMoeda(0) : formatarMoeda(previsto.toFixed(2))}</Pulo>}
            forte
          />
        </div>
      </Quadro>

      <ul className="space-y-1.5 text-corpo text-tinta-2 list-disc pl-5 max-w-2xl">
        <li>
          O pedido entra no mês da <strong className="text-tinta">entrega</strong> (ou no mês que o dia de
          faturamento da indústria manda), não no mês em que foi lançado.
        </li>
        <li>
          Conferindo o extrato da indústria? Digite um pedaço do número na <strong className="text-tinta">Busca</strong>{" "}
          (22 já acha o 2224) ou troque a <strong className="text-tinta">Ordem</strong> para “Nº do pedido”.
        </li>
        <li>
          A indústria pagou base menor ou percentual menor? No acerto dá para mudar os dois. Lançou errado?
          “Desfazer acerto” volta o pedido a previsto.
        </li>
        <li>O pedido cancelado continua na lista do mês, riscado e fora da soma, com o motivo escrito.</li>
      </ul>

      <Onde>
        avatar (canto de cima) → <Link href="/comissoes" className="text-carimbo hover:underline">Comissões</Link> →
        clique na linha do pedido
      </Onde>
    </div>
  );
}

export function Rateio() {
  const [fatia, setFatia] = useState(50);
  const rateio = ratearComissao(BASE, PERCENTUAL, fatia);

  return (
    <div className="space-y-5">
      <Texto>
        O preposto recebe uma fatia <strong className="text-tinta">da comissão</strong>, não da venda: 50 quer
        dizer metade do que a indústria pagar. Se a indústria pagar menos, os dois recebem menos, na mesma
        proporção.
      </Texto>

      <Quadro className="space-y-4">
        <Regua
          rotulo="Fatia do preposto"
          valor={fatia}
          aoMudar={setFatia}
          minimo={0}
          maximo={100}
          passo={5}
          escrito={`${fatia}% da comissão`}
        />

        <div className="flex h-9 overflow-hidden rounded-full border border-filete bg-folha" aria-hidden="true">
          <m.div
            className="bg-carimbo"
            initial={false}
            animate={{ width: `${fatia}%` }}
            transition={{ duration: 0.35, ease: SUAVE }}
          />
        </div>

        <div>
          <LinhaConta rotulo={`Comissão do pedido (${formatarMoeda(BASE)} × ${PERCENTUAL}%)`} valor={formatarMoeda(rateio.total.toFixed(2))} />
          <LinhaConta rotulo="Do preposto" valor={<Pulo>{formatarMoeda(rateio.doPreposto.toFixed(2))}</Pulo>} />
          <LinhaConta rotulo="Fica com o escritório" valor={<Pulo>{formatarMoeda(rateio.doEscritorio.toFixed(2))}</Pulo>} forte />
        </div>
      </Quadro>

      <ul className="space-y-1.5 text-corpo text-tinta-2 list-disc pl-5 max-w-2xl">
        <li>
          A fatia vem do cadastro do preposto e fica <strong className="text-tinta">congelada no pedido</strong>:
          renegociar depois não reescreve o que ele já vendeu.
        </li>
        <li>
          A comissão é de quem é dono do <strong className="text-tinta">cliente</strong>, não de quem digitou:
          você pode lançar um pedido para a carteira do preposto e a parte dele continua dele.
        </li>
        <li>O preposto vê só a carteira e a comissão dele; o que fica com o escritório não aparece para ele.</li>
      </ul>

      <Onde>
        avatar (canto de cima) → <Link href="/prepostos" className="text-carimbo hover:underline">Prepostos</Link>
      </Onde>
    </div>
  );
}
