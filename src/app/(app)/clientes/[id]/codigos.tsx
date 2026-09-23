/**
 * Os produtos deste cliente — em leitura.
 *
 * Já foi uma tela de vincular: havia uma tabela de ligação produto↔cliente, e
 * era aqui que a linha dela nascia. Só que o produto JÁ dizia de quem era, no
 * próprio cadastro, e eram duas verdades para o mesmo fato — cadastrar produto
 * preenchia uma, lançar item lia a outra, e o produto do cliente não aparecia
 * na hora de montar o pedido.
 *
 * Agora o dono e o código são campos do produto, e esta seção passa a mostrar o
 * que existe em vez de criar: quem precisa mexer clica na linha e vai à ficha
 * onde o preço também está.
 */

import { Hash } from "lucide-react";

import { Cartao, EstadoVazio, LinhaLista, SecaoCartao } from "@/components/ui";

export type ProdutoDoCliente = {
  id: string;
  descricao: string;
  fornecedor: string;
  /** Nulo quando o cliente não numera este produto — ele é dele do mesmo jeito. */
  codigo: string | null;
};

export function SecaoCodigos({ produtos }: { produtos: ProdutoDoCliente[] }) {
  return (
    <SecaoCartao
      icone={Hash}
      titulo="Produtos deste cliente"
      descricao="São estes que aparecem ao lançar pedido ou proposta para ele. De quem é o produto e o código que ELE usa saem da ficha do produto."
    >
      {produtos.length === 0 ? (
        <EstadoVazio discreto icone={Hash}>
          Nenhum produto é deste cliente ainda. Na ficha de um produto, escolha-o no campo
          Cliente e ele passa a aparecer aqui.
        </EstadoVazio>
      ) : (
        <Cartao className="divide-y divide-filete overflow-hidden">
          {produtos.map((produto) => (
            <LinhaLista key={produto.id} href={`/produtos/${produto.id}`}>
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{produto.descricao}</div>
                <div className="text-mini text-tinta-3">{produto.fornecedor}</div>
              </div>

              {produto.codigo ? (
                <span className="font-mono text-corpo text-carimbo numerico shrink-0">
                  {produto.codigo}
                </span>
              ) : (
                <span className="text-mini text-tinta-3 shrink-0">sem código</span>
              )}
            </LinhaLista>
          ))}
        </Cartao>
      )}
    </SecaoCartao>
  );
}
