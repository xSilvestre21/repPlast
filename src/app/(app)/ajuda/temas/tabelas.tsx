"use client";

/**
 * "Tabelas de preço": de onde sai o preço do saco, mexendo nas medidas.
 *
 * A conta é a do sistema (`precoUnitario`, `pesoMilheiroKg`): a página não
 * reinventa nada, então o número que aparece aqui é o que apareceria no pedido.
 */

import Decimal from "decimal.js";
import Link from "next/link";
import { useState } from "react";

import { Botao, formatarMoeda } from "@/components/ui";
import { DENSIDADE_PADRAO, pesoMilheiroKg } from "@/lib/precificacao";
import { precoUnitario } from "@/lib/produto-preco";

import { LinhaConta, Onde, Pulo, Quadro, Regua, Texto } from "../pecas";

const NUMERO = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });
const FATOR_INICIAL = "14.5";

export function Tabelas() {
  const [largura, setLargura] = useState(30);
  const [comprimento, setComprimento] = useState(40);
  const [espessura, setEspessura] = useState(0.08);
  const [fator, setFator] = useState(new Decimal(FATOR_INICIAL));

  const medidas = { larguraCm: largura, comprimentoCm: comprimento, espessuraMm: espessura };
  const peso = pesoMilheiroKg(medidas);
  const preco = precoUnitario({ familia: "SACO", ...medidas, fatorKg: fator }, "MIL") ?? new Decimal(0);
  const reajustado = !fator.equals(FATOR_INICIAL);

  return (
    <div className="space-y-5">
      <Texto>
        Cada indústria tem a sua tabela de <strong className="text-tinta">materiais</strong>: o preço do quilo
        de cada um. Ao cadastrar um saco, esse valor entra como o “fator kg” do produto, e o sistema faz a
        conta do peso pelas medidas e multiplica pelo fator. Mexa nas medidas e veja o preço do milheiro mudar.
      </Texto>

      <div className="grid gap-4 md:grid-cols-2">
        <Quadro className="space-y-4">
          <Regua rotulo="Largura" valor={largura} aoMudar={setLargura} minimo={10} maximo={100} escrito={`${largura} cm`} />
          <Regua
            rotulo="Comprimento"
            valor={comprimento}
            aoMudar={setComprimento}
            minimo={10}
            maximo={150}
            escrito={`${comprimento} cm`}
          />
          <Regua
            rotulo="Espessura"
            valor={espessura}
            aoMudar={setEspessura}
            minimo={0.02}
            maximo={0.3}
            passo={0.01}
            escrito={`${NUMERO.format(espessura)} mm`}
          />
        </Quadro>

        <Quadro>
          <LinhaConta
            rotulo="Largura × comprimento × espessura"
            valor={`${largura} × ${comprimento} × ${NUMERO.format(espessura)}`}
          />
          <LinhaConta rotulo="× densidade do material" valor={NUMERO.format(Number(DENSIDADE_PADRAO))} />
          <LinhaConta rotulo="= peso do milheiro" valor={`${NUMERO.format(peso.toNumber())} kg`} />
          <LinhaConta rotulo="× fator kg do produto"valor={`${formatarMoeda(fator.toFixed(2))}/kg`} />
          <LinhaConta rotulo="Preço do milheiro" valor={<Pulo>{formatarMoeda(preco.toFixed(2))}</Pulo>} forte />
        </Quadro>
      </div>

      <Quadro>
        <h3 className="text-corpo font-semibold text-tinta">A indústria reajustou?</h3>
        <p className="text-corpo text-tinta-2 mt-1 max-w-2xl">
          Abra a indústria, clique em Editar e troque o valor na linha do material — não precisa remover e
          cadastrar de novo. Atenção: a tabela é a <strong className="text-tinta">sugestão</strong> para o
          produto novo. O fator kg de um saco já cadastrado é do produto, e o reajuste da tabela não mexe
          nele: para o preço novo valer num produto antigo, abra o produto e troque o fator kg. Pedidos já
          lançados nunca mudam.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Botao
            type="button"
            variante="secundaria"
            tamanho="compacto"
            onClick={() => setFator(fator.times("1.05").toDecimalPlaces(2))}
          >
            Simular um reajuste de 5%
          </Botao>
          {reajustado && (
            <button
              type="button"
              onClick={() => setFator(new Decimal(FATOR_INICIAL))}
              className="text-corpo text-tinta-2 hover:text-tinta cursor-pointer"
            >
              Voltar ao valor de antes
            </button>
          )}
        </div>
      </Quadro>

      <ul className="space-y-1.5 text-corpo text-tinta-2 list-disc pl-5 max-w-2xl">
        <li>
          <strong className="text-tinta">Aditivos</strong> (deslizante, antiestático…) também ficam na tabela da
          indústria e entram na conta e na descrição do item.
        </li>
        <li>
          <strong className="text-tinta">Fita, frasco, bombona e tampa</strong> não têm conta de peso: o preço é
          o da tabela da indústria, digitado no produto.
        </li>
        <li>
          Preço saiu diferente do esperado? Abra o produto e confira as medidas e o fator kg dele — é o do
          produto que vale, não o da tabela.
        </li>
      </ul>

      <Onde>
        <Link href="/fornecedores" className="text-carimbo hover:underline">Fornecedores</Link> → a indústria →
        Materiais
      </Onde>
    </div>
  );
}
