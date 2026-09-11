"use client";

import { useActionState, useMemo, useState } from "react";

import { ListOrdered } from "lucide-react";

import { Botao, Campo, MensagemErro, SecaoCartao, Selecao, formatarMoeda } from "@/components/ui";
import { escreverNumeroBr, lerNumeroBr } from "@/lib/numero-br";
import type { Aditivo } from "@/lib/precificacao";
import {
  ROTULO_COLUNA_PRECO,
  ROTULO_UNIDADE,
  type Familia,
  type UnidadeVenda,
  precoUnitario,
  unidadesComPreco,
} from "@/lib/produto-preco";

import type { EstadoFormulario } from "../acoes";

export type ProdutoOpcao = {
  id: string;
  descricao: string;
  familia: Familia;
  codigoFornecedor: string | null;
  larguraCm: string | null;
  comprimentoCm: string | null;
  espessuraMm: string | null;
  fatorKg: string | null;
  precoUnidade: string | null;
  precoCaixa: string | null;
  precoKg: string | null;
  unidadesPorCaixa: number | null;
  aditivos: Aditivo[];
};

export type ItemPedido = {
  id: string;
  familia: Familia;
  codigoFornecedor: string | null;
  codigoCliente: string | null;
  descricao: string;
  unidade: UnidadeVenda;
  quantidade: string;
  precoUnitario: string;
  /** Se ESTA linha é tributada. Só significa algo quando o pedido cobra IPI. */
  comIpi: boolean;
  totalSemIpi: string;
  valorIpi: string;
  total: string;
};

export type Totais = {
  subtotalSemIpi: string;
  valorIpi: string;
  totalGeral: string;
  ipiPercentual: string;
  comIpi: boolean;
};

export function SecaoItens({
  itens,
  produtos,
  totais,
  editavel,
  adicionar,
  atualizar,
  remover,
}: {
  itens: ItemPedido[];
  produtos: ProdutoOpcao[];
  totais: Totais;
  editavel: boolean;
  adicionar: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  atualizar: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  remover: (formData: FormData) => void | Promise<void>;
}) {
  const [estadoAdicao, enviarAdicao, adicionando] = useActionState(adicionar, {});

  /** Rótulo da coluna de preço: muda por família, como nos pedidos reais. */
  const rotuloPreco = itens.length > 0 ? ROTULO_COLUNA_PRECO[itens[0].familia] : "PREÇO";

  return (
    <SecaoCartao
      icone={ListOrdered}
      titulo={`Itens (${itens.length})`}
      descricao={
        editavel
          ? "As colunas são as mesmas do PDF que a indústria vai receber."
          : "Pedido travado: desmarque o envio para editar."
      }
    >
      {itens.length === 0 ? (
        <p className="text-sm text-tinta-3 mb-4">Nenhum item ainda.</p>
      ) : (
        <div className="overflow-x-auto -mx-1 px-1 mb-4">
          <table className="w-full text-sm border-collapse min-w-160">
            <thead>
              <tr className="text-xs text-tinta-3 text-left border-b border-filete">
                <th className="py-2 pr-3 font-normal">COD.FORN</th>
                <th className="py-2 pr-3 font-normal">COD.CLI</th>
                <th className="py-2 pr-3 font-normal">DESCRIÇÃO</th>
                <th className="py-2 pr-3 font-normal text-right">QNT</th>
                <th className="py-2 pr-3 font-normal">UN</th>
                <th className="py-2 pr-3 font-normal text-right">{rotuloPreco}</th>
                <th className="py-2 pr-3 font-normal text-right">TOT S/IPI</th>
                <th className="py-2 pr-3 font-normal text-right">IPI</th>
                <th className="py-2 pr-3 font-normal text-right">TOTAL</th>
                {editavel && <th className="py-2" />}
              </tr>
            </thead>

            <tbody className="divide-y divide-filete">
              {itens.map((item) => (
                <LinhaItem
                  key={item.id}
                  item={item}
                  editavel={editavel}
                  pedidoComIpi={totais.comIpi}
                  atualizar={atualizar}
                  remover={remover}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-col items-end gap-1 text-sm numerico border-t border-filete pt-4">
        <div className="flex gap-8">
          <span className="text-tinta-2">Subtotal s/ IPI:</span>
          <span className="w-32 text-right">{formatarMoeda(totais.subtotalSemIpi)}</span>
        </div>
        <div className="flex gap-8">
          <span className="text-tinta-2">
            {totais.comIpi
              ? `IPI (${Number(totais.ipiPercentual).toLocaleString("pt-BR")}%):`
              : "Sem IPI:"}
          </span>
          <span className="w-32 text-right">{formatarMoeda(totais.valorIpi)}</span>
        </div>
        <div className="flex gap-8 text-base font-semibold mt-1">
          <span>TOTAL GERAL:</span>
          <span className="w-32 text-right cifra">{formatarMoeda(totais.totalGeral)}</span>
        </div>
      </div>

      {editavel && (
        <div className="mt-5 pt-5 border-t border-filete">
          <MensagemErro>{estadoAdicao.erro}</MensagemErro>
          <FormularioAdicao
            produtos={produtos}
            pedidoComIpi={totais.comIpi}
            enviar={enviarAdicao}
            enviando={adicionando}
          />
        </div>
      )}
    </SecaoCartao>
  );
}

function LinhaItem({
  item,
  editavel,
  pedidoComIpi,
  atualizar,
  remover,
}: {
  item: ItemPedido;
  editavel: boolean;
  /** Do PEDIDO. Com ele desligado não há o que isentar, e a caixa some. */
  pedidoComIpi: boolean;
  atualizar: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  remover: (formData: FormData) => void | Promise<void>;
}) {
  const [, enviar, salvando] = useActionState(atualizar, {});

  const celula = "py-2 pr-3 align-middle";

  return (
    <tr>
      <td className={`${celula} numerico text-tinta-2`}>{item.codigoFornecedor ?? "—"}</td>
      <td className={`${celula} numerico text-tinta-2`}>{item.codigoCliente ?? ""}</td>
      <td className={`${celula} font-mono text-xs`}>{item.descricao}</td>

      {editavel ? (
        <>
          <td className={celula}>
            <form action={enviar} id={`item-${item.id}`}>
              <input type="hidden" name="itemId" value={item.id} />
              {/*
                Diz ao servidor que ESTE formulário tem opinião sobre IPI.
                Sem ele, caixa desmarcada — que o navegador não envia — seria
                indistinguível de formulário sem caixa, e desmarcar nunca
                salvaria. Só existe quando a caixa existe.
              */}
              {pedidoComIpi && <input type="hidden" name="comIpiItemDefinido" value="1" />}
              <input
                name="quantidade"
                inputMode="decimal"
                defaultValue={escreverNumeroBr(item.quantidade, 0)}
                aria-label="Quantidade"
                className="w-20 rounded border border-filete bg-folha-2 px-2 py-1 text-right numerico outline-none focus:border-carimbo"
              />
            </form>
          </td>
          <td className={`${celula} text-tinta-2`}>{ROTULO_UNIDADE[item.unidade]}</td>
          <td className={celula}>
            <input
              form={`item-${item.id}`}
              name="precoUnitario"
              inputMode="decimal"
              // Até 6 casas: é a precisão que o banco guarda, e cortá-la aqui
              // faria o total errar centavos ao salvar a linha.
              defaultValue={escreverNumeroBr(item.precoUnitario, 2, 6)}
              aria-label="Preço unitário"
              className="w-28 rounded border border-filete bg-folha-2 px-2 py-1 text-right numerico outline-none focus:border-carimbo"
            />
          </td>
        </>
      ) : (
        <>
          <td className={`${celula} text-right numerico`}>
            {escreverNumeroBr(item.quantidade, 0)}
          </td>
          <td className={`${celula} text-tinta-2`}>{ROTULO_UNIDADE[item.unidade]}</td>
          <td className={`${celula} text-right numerico`}>{formatarMoeda(item.precoUnitario)}</td>
        </>
      )}

      <td className={`${celula} text-right numerico`}>{formatarMoeda(item.totalSemIpi)}</td>
      {/*
        A caixa fica NA COLUNA DO IPI, e não numa coluna nova.

        É onde o olho já procura o valor, e marcar/desmarcar muda justamente o
        número ao lado — a causa e o efeito ficam no mesmo lugar. Uma coluna
        extra só para a caixa empurraria a tabela para a rolagem horizontal no
        celular sem dizer nada a mais.
      */}
      <td className={`${celula} text-right numerico text-tinta-2`}>
        {editavel && pedidoComIpi ? (
          <label
            className="flex items-center justify-end gap-2 cursor-pointer"
            title={item.comIpi ? "Tributado. Desmarque para isentar." : "Isento de IPI."}
          >
            <input
              form={`item-${item.id}`}
              type="checkbox"
              name="comIpiItem"
              defaultChecked={item.comIpi}
              aria-label={`Cobrar IPI de ${item.descricao}`}
              className="accent-carimbo"
            />
            <span className={item.comIpi ? "" : "text-tinta-3"}>
              {formatarMoeda(item.valorIpi)}
            </span>
          </label>
        ) : (
          formatarMoeda(item.valorIpi)
        )}
      </td>
      <td className={`${celula} text-right numerico`}>{formatarMoeda(item.total)}</td>

      {editavel && (
        <td className={`${celula} whitespace-nowrap`}>
          <button
            type="submit"
            form={`item-${item.id}`}
            disabled={salvando}
            className="text-xs text-tinta-3 hover:text-carimbo transition-colors px-1 disabled:opacity-50"
          >
            {salvando ? "…" : "salvar"}
          </button>
          <form action={remover} className="inline">
            <input type="hidden" name="itemId" value={item.id} />
            <button
              type="submit"
              aria-label={`Remover ${item.descricao}`}
              className="text-xs text-tinta-3 hover:text-perigo transition-colors px-1"
            >
              remover
            </button>
          </form>
        </td>
      )}
    </tr>
  );
}

function FormularioAdicao({
  produtos,
  pedidoComIpi,
  enviar,
  enviando,
}: {
  produtos: ProdutoOpcao[];
  /** Do PEDIDO: sem ele a caixa de isenção não aparece. */
  pedidoComIpi: boolean;
  enviar: (formData: FormData) => void;
  enviando: boolean;
}) {
  const [produtoId, setProdutoId] = useState("");
  const [unidade, setUnidade] = useState<UnidadeVenda | "">("");
  const [quantidade, setQuantidade] = useState("");
  const [precoManual, setPrecoManual] = useState<string | null>(null);

  const produto = produtos.find((p) => p.id === produtoId);

  const unidades = useMemo(
    () => (produto ? unidadesComPreco(produto) : []),
    [produto],
  );

  const unidadeEfetiva = (unidade || unidades[0]) as UnidadeVenda | undefined;

  /** Preço sugerido pelo motor de preço — o usuário pode sobrescrever. */
  const precoCalculado = useMemo(() => {
    if (!produto || !unidadeEfetiva) return null;
    return precoUnitario(produto, unidadeEfetiva);
  }, [produto, unidadeEfetiva]);

  // O preço vai para o campo com a precisão cheia, e não arredondado para
  // centavos: no pedido 2253 o milheiro é 1.774,872, e enviar 1.774,87 faria
  // o item fechar em 10.649,22 em vez dos 10.649,23 que a indústria recebeu.
  const preco =
    precoManual ?? (precoCalculado ? escreverNumeroBr(precoCalculado.toFixed(6), 2, 6) : "");

  const totalPrevisto = useMemo(() => {
    const qtd = lerNumeroBr(quantidade);
    const unit = lerNumeroBr(preco);
    if (qtd === null || unit === null) return null;
    return qtd * unit;
  }, [quantidade, preco]);

  return (
    <form
      action={(formData) => {
        enviar(formData);
        setProdutoId("");
        setUnidade("");
        setQuantidade("");
        setPrecoManual(null);
      }}
      className="space-y-3"
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-start lg:gap-3">
        <Selecao
          name="produtoId"
          rotulo="Produto"
          required
          value={produtoId}
          onChange={(e) => {
            setProdutoId(e.target.value);
            setUnidade("");
            setPrecoManual(null);
          }}
        >
          <option value="">Escolha…</option>
          {produtos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.descricao}
            </option>
          ))}
        </Selecao>

        <Selecao
          name="unidade"
          rotulo="Unidade"
          required
          value={unidadeEfetiva ?? ""}
          onChange={(e) => {
            setUnidade(e.target.value as UnidadeVenda);
            setPrecoManual(null);
          }}
          className="lg:w-28"
        >
          {unidades.length === 0 && <option value="">—</option>}
          {unidades.map((u) => (
            <option key={u} value={u}>
              {ROTULO_UNIDADE[u]}
            </option>
          ))}
        </Selecao>

        <Campo
          name="quantidade"
          rotulo="Quantidade"
          inputMode="decimal"
          required
          value={quantidade}
          onChange={(e) => setQuantidade(e.target.value)}
          className="lg:w-32"
        />

        <Campo
          name="precoUnitario"
          rotulo="Preço"
          inputMode="decimal"
          value={preco}
          onChange={(e) => setPrecoManual(e.target.value)}
          dica={precoCalculado ? "Calculado — dá para ajustar." : undefined}
          className="lg:w-36"
        />

        {/*
          A caixa nasce MARCADA, que é o caso comum: num pedido com IPI quase
          toda linha tem IPI. Quem precisa isentar desmarca antes de adicionar,
          e ainda pode corrigir depois direto na tabela.
        */}
        {pedidoComIpi && (
          <label className="flex items-end gap-2 text-sm pb-2 whitespace-nowrap">
            <input type="hidden" name="comIpiItemDefinido" value="1" />
            <input
              type="checkbox"
              name="comIpiItem"
              defaultChecked
              className="accent-carimbo mb-0.5"
            />
            <span className="text-tinta-2">Com IPI</span>
          </label>
        )}

        <div className="flex items-end">
          <Botao type="submit" variante="secundaria" disabled={enviando || !produtoId}>
            {enviando ? "Adicionando…" : "Adicionar"}
          </Botao>
        </div>
      </div>

      {totalPrevisto !== null && (
        <p className="text-xs text-tinta-3 numerico">
          Este item entra por {formatarMoeda(totalPrevisto)} antes do IPI.
        </p>
      )}
    </form>
  );
}
