/**
 * "O que você vende por aqui": uma linha de produto por cartão.
 *
 * Quem chega por indicação vende frasco, tampa ou caixa de papelão, e precisa
 * ver logo que o sistema é para ele — não só para quem vende saco. Cada cartão
 * diz como a linha se vende e traz uma descrição de exemplo montada pelas
 * mesmas funções do cadastro (`descricaoSaco`, `descricaoDoTipo`…): é assim que
 * ela sai no pedido e no PDF, não um texto escrito para a vitrine.
 */

import {
  Barrel,
  CircleDot,
  CupSoda,
  Cylinder,
  Disc3,
  Droplet,
  Milk,
  Package,
  PackageOpen,
  PaintBucket,
  Ribbon,
  Shapes,
  ShoppingBag,
  SprayCan,
  TestTube,
  type LucideIcon,
} from "lucide-react";

import { Placa } from "@/components/ui";
import { descricaoFita, descricaoRolo, descricaoSaco } from "@/lib/descricao";
import { camposDaEmbalagem, descricaoDoTipo, tipoPorValor } from "@/lib/tipos-produto";

import { Revelar } from "./revelar";

type Tom = "sol" | "mar" | "menta" | "pessego" | "lilas";

const LINHAS: {
  icone: LucideIcon;
  tom: Tom;
  titulo: string;
  vende: string;
  texto: string;
  /** A descrição como sai no pedido. Sem ela, o cartão diz o que entra. */
  exemplo?: string;
  /** Ocupa duas colunas: é o que fecha a grade. */
  largo?: boolean;
}[] = [
  {
    icone: ShoppingBag,
    tom: "sol",
    titulo: "Sacos",
    vende: "Milheiro ou quilo",
    texto: "O preço sai das medidas e do fator da indústria, com os aditivos somados.",
    exemplo: descricaoSaco({ larguraCm: 40, comprimentoCm: 60, espessuraMm: 0.1, material: "PEAD" }),
  },
  {
    icone: Cylinder,
    tom: "mar",
    titulo: "Filmes",
    vende: "Quilo",
    texto: "Stretch, shrink e bobina, com o preço do quilo na tabela da indústria.",
    exemplo: descricaoRolo({ material: "FILME STRETCH", larguraMm: "500", micragem: 25 }),
  },
  {
    icone: Disc3,
    tom: "pessego",
    titulo: "Fitas",
    vende: "Caixa ou rolo",
    texto: "A caixa sai pelo preço do rolo vezes quantos vêm nela — você cadastra.",
    exemplo: descricaoFita({
      material: "Fita adesiva",
      larguraMm: "48",
      metragemM: "100",
      complemento: "transparente",
    }),
  },
  {
    icone: Milk,
    tom: "menta",
    titulo: "Frascos",
    vende: "Milheiro ou unidade",
    texto:
      "Capacidade, material e formato; sozinho ou em conjunto com a tampa. Serigrafia e rótulo somam no milheiro.",
    exemplo: descricaoDoTipo(
      tipoPorValor("FRASCO_TAMPA"),
      camposDaEmbalagem({
        capacidade: "500",
        capacidadeUnidade: "mL",
        material: "PEAD",
        complemento: "Cilíndrico",
        diametroMm: "28",
        materialTampa: "PP",
        complementoTampa: "Flip Top",
      }),
    ),
  },
  {
    icone: Barrel,
    tom: "lilas",
    titulo: "Bombonas",
    vende: "Milheiro ou unidade",
    texto: "Capacidade, boca, fechamento e homologação; com ou sem a tampa no conjunto.",
    exemplo: descricaoDoTipo(
      tipoPorValor("BOMBONA"),
      camposDaEmbalagem({
        capacidade: "20",
        capacidadeUnidade: "L",
        material: "PEAD",
        complemento: "Tampa Rosca Homologada UN",
      }),
    ),
  },
  {
    icone: CircleDot,
    tom: "sol",
    titulo: "Tampas",
    vende: "Milheiro ou unidade",
    texto: "Pelo diâmetro e pelo modelo. No conjunto, a tampa pode vir de outra indústria.",
    exemplo: descricaoDoTipo(
      tipoPorValor("TAMPA"),
      camposDaEmbalagem({ diametroMm: "38", material: "PP", complemento: "Lacre" }),
    ),
  },
  {
    icone: PaintBucket,
    tom: "menta",
    titulo: "Potes e baldes",
    vende: "Milheiro ou unidade",
    texto:
      "Capacidade, boca e alça; sozinhos ou em conjunto com a tampa. Rótulo IML e serigrafia somam no milheiro.",
    exemplo: descricaoDoTipo(
      tipoPorValor("BALDE_TAMPA"),
      camposDaEmbalagem({
        capacidade: "20",
        capacidadeUnidade: "L",
        material: "PP",
        complemento: "Alça Metálica",
        diametroMm: "290",
        materialTampa: "PP",
        complementoTampa: "Lacre",
      }),
    ),
  },
  {
    icone: TestTube,
    tom: "mar",
    titulo: "Pré-formas",
    vende: "Milheiro",
    texto: "Pelo peso em gramas e pelo gargalo da garrafa que ela vai virar.",
    exemplo: descricaoDoTipo(
      tipoPorValor("PREFORMA"),
      camposDaEmbalagem({
        capacidade: "18",
        capacidadeUnidade: "g",
        material: "PET",
        complemento: "PCO 1881 Cristal",
      }),
    ),
  },
  {
    icone: SprayCan,
    tom: "pessego",
    titulo: "Gatilhos e válvulas",
    vende: "Milheiro ou unidade",
    texto: "Pelo gargalo em que entram — 28/410, 24/410 —, com o jato ou a dosagem.",
    exemplo: descricaoDoTipo(
      tipoPorValor("GATILHO"),
      camposDaEmbalagem({ diametroMm: "28", material: "PP", complemento: "28/410 Spray e Jato" }),
    ),
  },
  {
    icone: Droplet,
    tom: "lilas",
    titulo: "Batoques e alças",
    vende: "Milheiro ou unidade",
    texto: "Também pelo gargalo: batoque cego, com furo ou conta-gotas, e a alça do galão.",
    exemplo: descricaoDoTipo(
      tipoPorValor("BATOQUE"),
      camposDaEmbalagem({ diametroMm: "18", material: "PE", complemento: "Conta-Gotas P/ Tampa Lacre" }),
    ),
  },
  {
    icone: Package,
    tom: "sol",
    titulo: "Papelão",
    vende: "Milheiro ou unidade",
    texto: "Caixa, chapa, bandeja e divisória: comprimento × largura × altura, onda e parede.",
    exemplo: descricaoDoTipo(
      tipoPorValor("PAPELAO"),
      camposDaEmbalagem({
        material: "Caixa de papelão",
        comprimentoCm: "40",
        larguraCm: "30",
        alturaCm: "25",
        complemento: "Onda C Parede Simples Kraft",
      }),
    ),
  },
  {
    icone: PackageOpen,
    tom: "menta",
    titulo: "Ráfia e big bag",
    vende: "Unidade ou milheiro",
    texto: "A ráfia pela medida, gramatura e carga; o big bag pela base e altura, cobrado por unidade.",
    exemplo: descricaoDoTipo(
      tipoPorValor("BIG_BAG"),
      camposDaEmbalagem({
        comprimentoCm: "90",
        larguraCm: "90",
        alturaCm: "120",
        material: "PP",
        complemento: "1000 kg 4 Alças",
      }),
    ),
  },
  {
    icone: Ribbon,
    tom: "mar",
    titulo: "Fechamento de carga",
    vende: "Quilo, rolo ou unidade",
    texto: "Fita de arquear por quilo, com o selo; plástico bolha por rolo; cantoneira por peça.",
    exemplo: descricaoDoTipo(
      tipoPorValor("FITA_ARQUEAR"),
      camposDaEmbalagem({ larguraMm: "12", espessuraMm: "0,6", material: "PP", complemento: "Preta" }),
    ),
  },
  {
    icone: CupSoda,
    tom: "pessego",
    titulo: "Descartáveis",
    vende: "Caixa ou milheiro",
    texto: "Copo, pote, bandeja e embalagem articulada, pelo modelo e pela capacidade.",
    exemplo: descricaoDoTipo(
      tipoPorValor("DESCARTAVEL"),
      camposDaEmbalagem({
        material: "Copo descartável",
        capacidade: "200",
        capacidadeUnidade: "mL",
        complemento: "PP Transparente Caixa C/ 2500",
      }),
    ),
  },
  {
    icone: Shapes,
    tom: "lilas",
    titulo: "Avulsos",
    vende: "A unidade que você escolher",
    texto:
      "O que não se encaixa em nenhuma linha — palete, etiqueta, o que a indústria vender — entra com o preço digitado.",
    largo: true,
  },
];

export function LinhasDeProduto() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {LINHAS.map((linha, i) => (
        <Revelar
          key={linha.titulo}
          como="li"
          atraso={(i % 4) * 0.06}
          className={linha.largo ? "sm:col-span-2" : ""}
        >
          <div className="folha elevavel h-full p-5 flex flex-col">
            <div className="flex items-center justify-between gap-3">
              <Placa icone={linha.icone} tom={linha.tom} />
              <span className="text-mini font-semibold text-tinta-2 text-right">{linha.vende}</span>
            </div>
            <h3 className="mt-4 text-medio font-semibold text-tinta">{linha.titulo}</h3>
            <p className="mt-1.5 text-corpo text-tinta-2 leading-relaxed flex-1">{linha.texto}</p>
            {linha.exemplo && (
              <p className="mt-4 rounded-[var(--radius-miudo)] bg-folha-2 px-3 py-2 text-mini text-tinta-2 leading-snug">
                <span className="sr-only">Exemplo de descrição: </span>
                {linha.exemplo}
              </p>
            )}
          </div>
        </Revelar>
      ))}
    </ul>
  );
}
