"use client";

/**
 * A janela que uma linha da apuração abre: o acerto de um pedido, o pagamento
 * de um preposto.
 *
 * Abria DENTRO da lista, embaixo da linha. Bom para ir conferindo o extrato sem
 * perder a lista de vista — mas, observando quem usa pouco o computador, o
 * painel ficava aberto depois do serviço feito, a lista empurrada para baixo, e
 * a pessoa se perdia. Agora é uma janela por cima, com o fundo desfocado, como
 * a do "tem certeza?": enquanto ela está aberta, só ela existe; para sair, há
 * um "Fechar" grande embaixo, além do X.
 *
 * No celular continua a folha que sobe de baixo — que já é uma janela por cima.
 *
 * Diferenças que são de propósito:
 *   - no computador, o conteúdo nasce limpo a cada abertura (`Dialogo`): fechar
 *     é desistir. Por isso o clique fora da caixa NÃO fecha — um clique escapado
 *     jogaria fora o que foi digitado;
 *   - no celular, a folha guarda o que foi digitado (`FolhaDeBaixo`), como já
 *     guardava: o dedo que desliza para baixo fecha sem querer com facilidade.
 */

import type { ReactNode } from "react";

import { Dialogo } from "@/components/dialogo";
import { FolhaDeBaixo } from "@/components/folha-de-baixo";
import { useTelaEstreita } from "@/components/tela-estreita";
import { Botao } from "@/components/ui";

export function JanelaDaLinha({
  aberto,
  aoFechar,
  titulo,
  descricao,
  id,
  children,
}: {
  aberto: boolean;
  aoFechar: () => void;
  titulo: string;
  descricao?: string;
  /** Para o `aria-controls` do botão que a abre. */
  id?: string;
  children: ReactNode;
}) {
  const estreita = useTelaEstreita();

  const conteudo = (
    <>
      {children}
      {/* A saída, à vista: o X do canto passava despercebido. */}
      <div className="mt-6 pt-4 border-t border-filete flex justify-end max-sm:justify-stretch">
        <Botao type="button" variante="secundaria" onClick={aoFechar} className="max-sm:w-full max-sm:py-3">
          Fechar
        </Botao>
      </div>
    </>
  );

  if (estreita) {
    return (
      <FolhaDeBaixo id={id} aberto={aberto} aoFechar={aoFechar} titulo={titulo} descricao={descricao}>
        {conteudo}
      </FolhaDeBaixo>
    );
  }

  return (
    <Dialogo aberto={aberto} aoFechar={aoFechar} titulo={titulo} descricao={descricao} largo fecharNoFundo={false}>
      {conteudo}
    </Dialogo>
  );
}
