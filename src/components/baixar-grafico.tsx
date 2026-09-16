"use client";

import { useState } from "react";
import { Download } from "lucide-react";

import {
  desenharBarras,
  desenharSerie,
  tintaDoTema,
  type Marca,
} from "@/lib/grafico/desenho-canvas";
import { FORMATO, type Unidade } from "@/lib/grafico/formato";
import type { ItemBarra, PontoSerie } from "@/lib/grafico/geometria";

/**
 * Baixa o gráfico como PNG.
 *
 * Mora num arquivo próprio, e não em `ui.tsx`, pela razão já documentada em
 * `campo-mascarado.tsx`: aquele arquivo é importado por página de servidor, e
 * um `"use client"` lá em cima arrastaria a biblioteca inteira para o bundle.
 *
 * PNG e não SVG porque o destino é uma conversa: imagem cola no WhatsApp, SVG
 * vira anexo que o celular não abre.
 */

export type DadosDoGrafico =
  | { tipo: "barras"; itens: ItemBarra[]; teto?: number; rotuloResiduo?: string; mostrarTotal?: boolean }
  | {
      tipo: "serie";
      pontos: PontoSerie[];
      series: { rotulo: string; cor: string; preencher?: boolean }[];
    };

export function BaixarGrafico({
  titulo,
  periodo,
  unidade = "moeda",
  dados,
}: {
  titulo: string;
  periodo: string;
  unidade?: Unidade;
  dados: DadosDoGrafico;
}) {
  const [erro, setErro] = useState<string | null>(null);

  function baixar() {
    try {
      const canvas = document.createElement("canvas");
      const tinta = tintaDoTema();
      const formatar = FORMATO[unidade];

      // O período viaja DENTRO da imagem: fora da tela ela não tem cabeçalho de
      // página para dizer de que mês fala, e um gráfico sem período é um número
      // sem contexto na conversa de outra pessoa.
      const marca: Marca = { titulo, periodo, rodape: "RepPlast" };

      if (dados.tipo === "barras") {
        desenharBarras(canvas, dados.itens, {
          marca,
          formatar,
          tinta,
          teto: dados.teto,
          rotuloResiduo: dados.rotuloResiduo,
          mostrarTotal: dados.mostrarTotal,
        });
      } else {
        desenharSerie(canvas, dados.pontos, { marca, formatar, tinta, series: dados.series });
      }

      canvas.toBlob((blob) => {
        if (!blob) {
          setErro("Não foi possível gerar a imagem.");
          return;
        }

        const endereco = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = endereco;
        link.download = `${nomeDeArquivo(titulo)}-${nomeDeArquivo(periodo)}.png`;

        // O link precisa estar NO documento: fora dele, o Firefox ignora o
        // clique e o download simplesmente não acontece, sem erro nenhum.
        document.body.append(link);
        link.click();
        link.remove();

        // E o endereço só é liberado depois. Revogar na mesma volta do laço
        // corre com o início do download, e é uma corrida que dá para perder.
        setTimeout(() => URL.revokeObjectURL(endereco), 60_000);
      }, "image/png");
    } catch {
      setErro("Não foi possível gerar a imagem.");
    }
  }

  return (
    <button
      type="button"
      onClick={baixar}
      title={erro ?? "Baixar como imagem"}
      className="grid place-items-center size-8 rounded-full text-tinta-3 cursor-pointer
        transition-colors hover:bg-folha-2 hover:text-carimbo"
    >
      <Download size={15} strokeWidth={1.5} aria-hidden="true" />
      <span className="sr-only">Baixar {titulo} como imagem</span>
    </button>
  );
}

/** "Comissão por cliente" → "comissao-por-cliente". */
function nomeDeArquivo(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
