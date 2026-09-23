"use client";

import { useActionState, useMemo, useRef, useState, type ReactNode } from "react";

import { ListOrdered, Package } from "lucide-react";

import {
  Botao,
  BotaoTexto,
  CLASSE_CONTROLE_CELULA,
  Campo,
  Celula,
  EstadoVazio,
  MensagemErro,
  SecaoCartao,
  Selecao,
  Tabela,
  formatarMoeda,
} from "@/components/ui";
import { SelecaoBuscavel } from "@/components/selecao-buscavel";
import { CAMPO_IPI, CAMPO_IPI_DEFINIDO } from "@/lib/ipi-do-formulario";
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

/**
 * O retorno de qualquer ação de item. Declarado aqui, e não importado de um
 * módulo de ações, porque este componente serve DOIS documentos — pedido e
 * orçamento — e amarrá-lo às ações de um deles seria escolher um dono.
 */
export type EstadoFormulario = { erro?: string };

/**
 * A tabela de itens, compartilhada pelo pedido e pelo orçamento.
 *
 * São o mesmo documento em momentos diferentes da conversa: as mesmas colunas,
 * o mesmo IPI por linha, o mesmo congelamento. O que muda é quem recebe e o
 * que acontece depois — e isso mora nas ações, que chegam por parâmetro.
 */
export type ProdutoOpcao = {
  id: string;
  descricao: string;
  familia: Familia;
  codigoFornecedor: string | null;
  larguraCm: string | null;
  comprimentoCm: string | null;
  espessuraMm: string | null;
  fatorKg: string | null;
  densidade: string | null;
  precoUnidade: string | null;
  precoCaixa: string | null;
  precoKg: string | null;
  unidadeAvulsa: UnidadeVenda | null;
  precoAvulso: string | null;
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
};

export function SecaoItens({
  itens,
  produtos,
  totais,
  editavel,
  motivoTravado = "Pedido travado: desmarque o envio para editar.",
  semProdutos,
  adicionar,
  atualizar,
  remover,
  definirIpiDeTodos,
}: {
  itens: ItemPedido[];
  produtos: ProdutoOpcao[];
  totais: Totais;
  editavel: boolean;
  /** Por que não dá para mexer. Cada documento trava pelo seu próprio motivo. */
  motivoTravado?: string;
  /** O que dizer quando não há produto nenhum para escolher. */
  semProdutos?: ReactNode;
  adicionar: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  atualizar: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  remover: (formData: FormData) => void | Promise<void>;
  definirIpiDeTodos: (formData: FormData) => void | Promise<void>;
}) {
  const [estadoAdicao, enviarAdicao, adicionando] = useActionState(adicionar, {});

  /** Rótulo da coluna de preço: muda por família, como nos pedidos reais. */
  const rotuloPreco = itens.length > 0 ? ROTULO_COLUNA_PRECO[itens[0].familia] : "PREÇO";

  /** Há formulário embaixo? Sem isso, o vazio convidaria a escolher o que não existe. */
  const podeAdicionar = produtos.length > 0 || !semProdutos;

  return (
    <SecaoCartao
      icone={ListOrdered}
      titulo={`Itens (${itens.length})`}
      descricao={
        editavel ? "As colunas são as mesmas do PDF que a indústria vai receber." : motivoTravado
      }
    >
      {itens.length === 0 ? (
        <div className="mb-4">
          <EstadoVazio discreto icone={Package}>
            {editavel && podeAdicionar
              ? "Nenhum item ainda. Escolha um produto abaixo para começar."
              : "Nenhum item lançado."}
          </EstadoVazio>
        </div>
      ) : (
        <Tabela
          className="mb-4"
          colunas={[
            { rotulo: "COD.FORN" },
            { rotulo: "COD.CLI" },
            { rotulo: "DESCRIÇÃO" },
            { rotulo: "QNT", alinhamento: "numero" },
            { rotulo: "UN" },
            { rotulo: rotuloPreco, alinhamento: "numero" },
            { rotulo: "TOT S/IPI", alinhamento: "numero" },
            {
              alinhamento: "numero",
              rotulo: (
                <span className="whitespace-nowrap">
                  IPI
                  {/*
                    O atalho fica no CABEÇALHO da coluna que ele governa, e só
                    aparece com item na tabela. É o que substitui o antigo
                    interruptor do pedido: isentar doze linhas continua sendo
                    um clique, mas agora a decisão mora onde ela se lê.
                  */}
                  {editavel && itens.length > 0 && (
                    <form action={definirIpiDeTodos} className="inline">
                      <input
                        type="hidden"
                        name="ligado"
                        value={itens.every((i) => i.comIpi) ? "0" : "1"}
                      />
                      <BotaoTexto type="submit" className="ml-2">
                        {itens.every((i) => i.comIpi) ? "nenhum" : "todos"}
                      </BotaoTexto>
                    </form>
                  )}
                </span>
              ),
            },
            { rotulo: "TOTAL", alinhamento: "numero" },
            ...(editavel ? [{ rotulo: "", alinhamento: "acao" as const }] : []),
          ]}
        >
          {itens.map((item) => (
            <LinhaItem
              key={item.id}
              item={item}
              editavel={editavel}
              atualizar={atualizar}
              remover={remover}
            />
          ))}
        </Tabela>
      )}

      <div className="flex flex-col items-end gap-1 text-corpo numerico border-t border-filete pt-4">
        <div className="flex gap-8">
          <span className="text-tinta-2">Subtotal s/ IPI:</span>
          <span className="w-32 text-right">{formatarMoeda(totais.subtotalSemIpi)}</span>
        </div>
        <div className="flex gap-8">
          <span className="text-tinta-2">
            {/*
              O rótulo lê o ESTADO DAS LINHAS, e não um campo do pedido:
              "Sem IPI" agora significa que nenhuma linha é tributada.
            */}
            {itens.length > 0 && itens.every((i) => !i.comIpi)
              ? "Sem IPI:"
              : `IPI (${Number(totais.ipiPercentual).toLocaleString("pt-BR")}%):`}
          </span>
          <span className="w-32 text-right">{formatarMoeda(totais.valorIpi)}</span>
        </div>
        <div className="flex gap-8 text-medio font-semibold mt-1">
          <span>TOTAL GERAL:</span>
          <span className="w-32 text-right cifra">{formatarMoeda(totais.totalGeral)}</span>
        </div>
      </div>

      {editavel && (
        <div className="mt-5 pt-5 border-t border-filete">
          <MensagemErro>{estadoAdicao.erro}</MensagemErro>
          {/*
            Sem produto para escolher, o formulário viraria uma armadilha: três
            campos habilitados e uma lista vazia, sem dizer o que falta. O aviso
            ocupa o lugar dele e aponta onde resolver.
          */}
          {!podeAdicionar ? (
            semProdutos
          ) : (
            <FormularioAdicao produtos={produtos} enviar={enviarAdicao} enviando={adicionando} />
          )}
        </div>
      )}
    </SecaoCartao>
  );
}

function LinhaItem({
  item,
  editavel,
  atualizar,
  remover,
}: {
  item: ItemPedido;
  editavel: boolean;
  atualizar: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  remover: (formData: FormData) => void | Promise<void>;
}) {
  const [estado, enviar, salvando] = useActionState(atualizar, {});

  /*
   * O que o campo valia quando a pessoa entrou nele.
   *
   * É o que responde à única pergunta que importa para gravar: "mexeram nisto
   * agora?". Comparar com o valor do item não serviria — quem digita `1000`
   * num campo que se lê `1.000` teria a linha regravada sem ter mudado nada.
   */
  const valorAoEntrar = useRef("");

  /**
   * Grava a linha, e só se houve mudança.
   *
   * Existia um botão "salvar" nesta célula, e ele não fazia sentido ao lado de
   * uma caixa de IPI que já gravava sozinha: a mesma linha pedia clique para
   * metade do que ela tem e para a outra metade não. Agora a linha inteira se
   * comporta igual — sair do campo ou teclar Enter grava, e o total se
   * atualizando é o aviso de que gravou.
   */
  function gravar(campo: HTMLInputElement) {
    if (campo.value === valorAoEntrar.current) return;
    valorAoEntrar.current = campo.value;
    campo.form?.requestSubmit();
  }

  /** Os mesmos três tratadores na quantidade e no preço. */
  const gravaSozinho = {
    onFocus: (evento: React.FocusEvent<HTMLInputElement>) => {
      valorAoEntrar.current = evento.currentTarget.value;
    },
    onBlur: (evento: React.FocusEvent<HTMLInputElement>) => gravar(evento.currentTarget),
    onKeyDown: (evento: React.KeyboardEvent<HTMLInputElement>) => {
      if (evento.key !== "Enter") return;
      // Sem isto o Enter faria a submissão implícita do navegador por cima da
      // ação do React, e a página recarregaria.
      evento.preventDefault();
      gravar(evento.currentTarget);
    },
  };

  return (
    <tr>
      <Celula className="numerico text-tinta-2">{item.codigoFornecedor ?? "—"}</Celula>
      <Celula className="numerico text-tinta-2">{item.codigoCliente ?? ""}</Celula>
      <Celula className="font-mono text-mini">{item.descricao}</Celula>

      {editavel ? (
        <>
          <Celula alinhamento="numero">
            <form action={enviar} id={`item-${item.id}`}>
              <input type="hidden" name="itemId" value={item.id} />
              {/*
                Diz ao servidor que ESTE formulário tem opinião sobre IPI.
                Sem ele, caixa desmarcada — que o navegador não envia — seria
                indistinguível de formulário sem caixa, e desmarcar nunca
                salvaria. Só existe quando a caixa existe.
              */}
              <input type="hidden" name={CAMPO_IPI_DEFINIDO} value="1" />
              <input
                name="quantidade"
                inputMode="decimal"
                defaultValue={escreverNumeroBr(item.quantidade, 0)}
                {...gravaSozinho}
                aria-label="Quantidade"
                className={`${CLASSE_CONTROLE_CELULA} w-20 text-right numerico`}
              />
            </form>
          </Celula>
          <Celula className="text-tinta-2">{ROTULO_UNIDADE[item.unidade]}</Celula>
          <Celula alinhamento="numero">
            <input
              form={`item-${item.id}`}
              name="precoUnitario"
              inputMode="decimal"
              // Até 6 casas: é a precisão que o banco guarda, e cortá-la aqui
              // faria o total errar centavos ao salvar a linha.
              defaultValue={escreverNumeroBr(item.precoUnitario, 2, 6)}
              {...gravaSozinho}
              aria-label="Preço unitário"
              className={`${CLASSE_CONTROLE_CELULA} w-28 text-right numerico`}
            />
          </Celula>
        </>
      ) : (
        <>
          <Celula alinhamento="numero">{escreverNumeroBr(item.quantidade, 0)}</Celula>
          <Celula className="text-tinta-2">{ROTULO_UNIDADE[item.unidade]}</Celula>
          <Celula alinhamento="numero">{formatarMoeda(item.precoUnitario)}</Celula>
        </>
      )}

      <Celula alinhamento="numero">{formatarMoeda(item.totalSemIpi)}</Celula>
      {/*
        A caixa fica NA COLUNA DO IPI, e não numa coluna nova.

        É onde o olho já procura o valor, e marcar/desmarcar muda justamente o
        número ao lado — a causa e o efeito ficam no mesmo lugar. Uma coluna
        extra só para a caixa empurraria a tabela para a rolagem horizontal no
        celular sem dizer nada a mais.
      */}
      <Celula alinhamento="numero" className="text-tinta-2">
        {editavel ? (
          <label
            className="flex items-center justify-end gap-2 cursor-pointer"
            title={item.comIpi ? "Tributado. Desmarque para isentar." : "Isento de IPI."}
          >
            <input
              form={`item-${item.id}`}
              type="checkbox"
              name={CAMPO_IPI}
              defaultChecked={item.comIpi}
              disabled={salvando}
              /*
               * Marcar JÁ aplica — sem passar pelo "salvar".
               *
               * Uma caixa de marcação promete efeito imediato, e o número que
               * ela muda está a dois centímetros dali. Exigir um segundo
               * clique num botão ao lado fazia a marca parecer quebrada: o
               * usuário marcava, o IPI continuava zero, e não havia nada na
               * tela dizendo que faltava confirmar.
               *
               * `requestSubmit` e não `submit`: o primeiro dispara o envio
               * pelo React, com validação; o segundo passaria por cima da
               * ação do formulário e recarregaria a página.
               */
              onChange={(evento) => evento.currentTarget.form?.requestSubmit()}
              aria-label={`Cobrar IPI de ${item.descricao}`}
              className="accent-carimbo disabled:opacity-50"
            />
            <span className={item.comIpi ? "" : "text-tinta-3"}>
              {formatarMoeda(item.valorIpi)}
            </span>
          </label>
        ) : (
          formatarMoeda(item.valorIpi)
        )}
      </Celula>
      <Celula alinhamento="numero">{formatarMoeda(item.total)}</Celula>

      {editavel && (
        <Celula alinhamento="acao">
          {/*
            O erro era descartado: `useActionState` devolvia o estado e ninguém
            o lia. Com o botão "salvar" ali dava para clicar de novo e perceber;
            gravando sozinho, uma falha muda seria a linha simplesmente não
            mudando de valor, sem nada na tela explicando.
          */}
          {estado.erro && (
            <span className="block text-mini text-perigo mb-1">{estado.erro}</span>
          )}
          <form action={remover} className="inline">
            <input type="hidden" name="itemId" value={item.id} />
            <BotaoTexto
              type="submit"
              perigoso
              disabled={salvando}
              aria-label={`Remover ${item.descricao}`}
            >
              remover
            </BotaoTexto>
          </form>
        </Celula>
      )}
    </tr>
  );
}

function FormularioAdicao({
  produtos,
  enviar,
  enviando,
}: {
  produtos: ProdutoOpcao[];
  enviar: (formData: FormData) => void;
  enviando: boolean;
}) {
  const [produtoId, setProdutoId] = useState("");
  const [unidade, setUnidade] = useState<UnidadeVenda | "">("");
  const [quantidade, setQuantidade] = useState("");
  const [precoManual, setPrecoManual] = useState<string | null>(null);

  const produto = produtos.find((p) => p.id === produtoId);

  /*
   * O código da indústria entra como detalhe porque também é buscável: quem
   * está com a tabela da fábrica na mão procura pelo código, não pela
   * descrição inteira.
   */
  const opcoesDeProduto = useMemo(
    () =>
      produtos.map((p) => ({
        id: p.id,
        rotulo: p.descricao,
        detalhe: p.codigoFornecedor ?? undefined,
      })),
    [produtos],
  );

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
      {/*
        Colunas nomeadas e `items-start`.

        Todo campo desta linha é rótulo em cima e caixa embaixo, de alturas
        diferentes — o preço às vezes ganha uma dica por baixo. Alinhar pelo
        TOPO é o que mantém as caixas na mesma linha; alinhar pelo centro ou
        pela base faria cada uma subir conforme o que tem embaixo dela.
      */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,2fr)_7rem_8rem_9.5rem_auto_auto] lg:items-start">
        <SelecaoBuscavel
          name="produtoId"
          rotulo="Produto"
          required
          opcoes={opcoesDeProduto}
          value={produtoId}
          aoEscolher={(id) => {
            setProdutoId(id);
            setUnidade("");
            setPrecoManual(null);
          }}
          placeholder="Digite para achar…"
          /*
           * Sempre para cima, e não "para onde couber".
           *
           * Esta linha é a última coisa do cartão e fica no pé de uma página
           * longa: embaixo dela não há espaço nenhum. Deixar a medida escolher
           * fazia o mesmo campo abrir ora para um lado ora para o outro conforme
           * a rolagem — e um controle que muda de comportamento sem a pessoa ter
           * mudado nada é pior que um controle que abre sempre no mesmo lugar.
           */
          lado="cima"
        />

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

          Ela é montada como os outros campos — rótulo em cima, caixa
          preenchida embaixo, mesmo padding — porque é isso que a põe na mesma
          linha. Um checkbox solto, sem rótulo e sem fundo, flutuava fora da
          régua dos vizinhos.
        */}
        <label className="block">
            <span className="rotulo block mb-1.5">IPI</span>
            <span className="flex items-center gap-2 px-3.5 py-2.5 rounded-suave bg-folha-2 border border-transparent">
              <input type="hidden" name={CAMPO_IPI_DEFINIDO} value="1" />
              <input
                type="checkbox"
                name={CAMPO_IPI}
                defaultChecked
                className="accent-carimbo"
              />
              <span className="text-corpo text-tinta-2 whitespace-nowrap">Cobrar</span>
            </span>
        </label>

        {/*
          O botão não tem rótulo, mas precisa da altura de um para descer até a
          régua das caixas. O espaçador invisível faz isso sem número mágico:
          ele é uma cópia do rótulo dos vizinhos, só que sem tinta.
        */}
        <div className="block">
          <span className="rotulo block mb-1.5 invisible select-none" aria-hidden="true">
            &nbsp;
          </span>
          <Botao
            type="submit"
            variante="secundaria"
            className="w-full lg:w-auto"
            disabled={enviando || !produtoId}
          >
            {enviando ? "Adicionando…" : "Adicionar"}
          </Botao>
        </div>
      </div>

      {totalPrevisto !== null && (
        <p className="text-mini text-tinta-3 numerico">
          Este item entra por {formatarMoeda(totalPrevisto)} antes do IPI.
        </p>
      )}
    </form>
  );
}
