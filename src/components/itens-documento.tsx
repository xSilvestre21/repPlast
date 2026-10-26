"use client";

import Link from "next/link";
import { Fragment, useActionState, useMemo, useRef, useState, type ReactNode } from "react";

import { ListOrdered, Package } from "lucide-react";

import {
  Botao,
  BotaoTexto,
  CLASSE_CONTROLE_CELULA,
  CLASSE_ERRO,
  Campo,
  Celula,
  EspacoDoRotulo,
  EstadoVazio,
  SecaoCartao,
  Selecao,
  Tabela,
  formatarMoeda,
} from "@/components/ui";
import { AcaoComRecusa } from "@/components/acao-com-recusa";
import { ErroGeral, Formulario } from "@/components/formulario";
import { SelecaoBuscavel } from "@/components/selecao-buscavel";
import type { EstadoFormulario } from "@/lib/erro-formulario";
import { CAMPO_IPI, CAMPO_IPI_DEFINIDO } from "@/lib/ipi-do-formulario";
import { escreverNumeroBr, lerNumeroBr } from "@/lib/numero-br";
import type { Aditivo } from "@/lib/precificacao";
import {
  ROTULO_UNIDADE,
  type Familia,
  type UnidadeVenda,
  precoUnitario,
  rotuloColunaPreco,
  rotuloPrecoDosItens,
  unidadesDoItem,
} from "@/lib/produto-preco";

/**
 * O retorno de qualquer ação de item — o mesmo de todo formulário do sistema
 * (`lib/erro-formulario`), e não o das ações de um dos dois documentos que
 * este componente serve, pedido e orçamento.
 */
export type { EstadoFormulario };

/** Colunas da tabela de itens — a linha de erro atravessa todas. */
const COLUNAS_DA_TABELA = 9;
/** Sem as colunas de preço, total s/ IPI, IPI e total — a amostra. */
const COLUNAS_SEM_PRECO = 5;

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
  /**
   * A unidade em que o produto é vendido, lida do rótulo dele. É a que o item
   * abre escolhida: um saco vendido por quilo não pode nascer em MIL e depender
   * de alguém lembrar de trocar. Nula, vale a primeira com preço.
   */
  unidadePadrao: UnidadeVenda | null;
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
  /**
   * Onde cadastrar esta linha como produto, quando ela ainda não é um.
   *
   * Só a proposta usa: a linha feita de conta não tem produto, e enquanto não
   * tiver a proposta não vira pedido. O link fica na própria linha para o que
   * falta estar onde se lê.
   */
  cadastrarEm?: string;
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
  adicao,
  adicionar,
  atualizar,
  remover,
  definirIpiDeTodos,
  semPreco = false,
}: {
  itens: ItemPedido[];
  produtos: ProdutoOpcao[];
  totais: Totais;
  editavel: boolean;
  /** Por que não dá para mexer. Cada documento trava pelo seu próprio motivo. */
  motivoTravado?: string;
  /** O que dizer quando não há produto nenhum para escolher. */
  semProdutos?: ReactNode;
  /**
   * Um formulário de lançamento no lugar do de catálogo — o da conta, na
   * proposta para quem ainda não é cliente. Ele traz a própria ação.
   */
  adicao?: ReactNode;
  adicionar: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  atualizar: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  remover: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  definirIpiDeTodos: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  /**
   * Pedido de amostra: sem preço, sem IPI e sem total, nem na tabela nem no
   * lançamento — as colunas são as do PDF da amostra. O servidor zera o preço
   * de todo jeito; esconder é para a tela não mostrar um R$ 0,00 em cada linha.
   */
  semPreco?: boolean;
}) {
  const [estadoAdicao, enviarAdicao, adicionando] = useActionState(adicionar, {});

  /** Rótulo da coluna de preço: o mesmo do PDF, olhando todas as linhas. */
  const rotuloPreco = rotuloPrecoDosItens(itens);

  /** Há formulário embaixo? Sem isso, o vazio convidaria a escolher o que não existe. */
  const podeAdicionar = adicao !== undefined || produtos.length > 0 || !semProdutos;

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
              ? adicao
                ? "Nenhum item ainda. Faça a conta abaixo para começar."
                : "Nenhum item ainda. Escolha um produto abaixo para começar."
              : "Nenhum item lançado."}
          </EstadoVazio>
        </div>
      ) : (
        // No celular em pé, cada item vira cartão (`.tabela-itens`, em
        // `globals.css`): na tabela cabiam o código e a descrição quebrada em
        // quatro linhas, e a quantidade, o preço e o total ficavam à direita.
        <Tabela
          className="mb-4 tabela-cartoes tabela-itens"
          colunas={[
            { rotulo: "COD.FORN" },
            { rotulo: "COD.CLI" },
            { rotulo: "DESCRIÇÃO" },
            { rotulo: "QNT", alinhamento: "numero" },
            { rotulo: "UN" },
            ...(semPreco ? [] : [
            { rotulo: rotuloPreco, alinhamento: "numero" as const },
            { rotulo: "TOT S/IPI", alinhamento: "numero" as const },
            {
              alinhamento: "numero" as const,
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
                    <AcaoComRecusa acao={definirIpiDeTodos} className="ml-2 align-baseline">
                      <input
                        type="hidden"
                        name="ligado"
                        value={itens.every((i) => i.comIpi) ? "0" : "1"}
                      />
                      <BotaoTexto type="submit">
                        {itens.every((i) => i.comIpi) ? "nenhum" : "todos"}
                      </BotaoTexto>
                    </AcaoComRecusa>
                  )}
                </span>
              ),
            },
            { rotulo: "TOTAL", alinhamento: "numero" as const },
            ]),
            ...(editavel ? [{ rotulo: "", alinhamento: "acao" as const }] : []),
          ]}
        >
          {itens.map((item) => (
            <LinhaItem
              key={item.id}
              item={item}
              editavel={editavel}
              colunas={(semPreco ? COLUNAS_SEM_PRECO : COLUNAS_DA_TABELA) + (editavel ? 1 : 0)}
              atualizar={atualizar}
              remover={remover}
              semPreco={semPreco}
            />
          ))}
        </Tabela>
      )}

      {semPreco ? (
        <p className="text-corpo text-tinta-2 text-right border-t border-filete pt-4">
          Pedido de amostra — sem valor comercial, sem custo para o cliente.
        </p>
      ) : (
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
      )}

      {editavel && (
        <div className="mt-5 pt-5 border-t border-filete">
          {/*
            Sem produto para escolher, o formulário viraria uma armadilha: três
            campos habilitados e uma lista vazia, sem dizer o que falta. O aviso
            ocupa o lugar dele e aponta onde resolver.
          */}
          {adicao ?? (!podeAdicionar ? (
            semProdutos
          ) : (
            <FormularioAdicao
              produtos={produtos}
              estado={estadoAdicao}
              enviar={enviarAdicao}
              enviando={adicionando}
              semPreco={semPreco}
            />
          ))}
        </div>
      )}
    </SecaoCartao>
  );
}

function LinhaItem({
  item,
  editavel,
  colunas,
  atualizar,
  remover,
  semPreco,
}: {
  item: ItemPedido;
  editavel: boolean;
  colunas: number;
  atualizar: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  remover: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  semPreco: boolean;
}) {
  const [estado, enviar, salvando] = useActionState(atualizar, {});
  // No cartão do celular, cada linha diz o preço na unidade dela.
  const rotuloPreco = rotuloColunaPreco(item.familia, item.unidade);

  /*
   * A caixa recusada fica vermelha e volta com o que foi digitado. Sem o valor
   * de volta, o React devolvia a caixa ao número antigo depois do envio — e a
   * frase de erro falava de um número que já não estava na tela.
   */
  const comErro = (nome: string) => estado.erro !== undefined && estado.campo === nome;
  const digitado = (nome: string, salvo: string) =>
    estado.erro ? (estado.valores?.[nome] ?? salvo) : salvo;
  const idErro = `item-${item.id}-erro`;

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
    <Fragment>
    <tr>
      <Celula data-area="codforn" data-rotulo="Cód. indústria" className="numerico text-tinta-2">
        {item.codigoFornecedor ?? "—"}
      </Celula>
      <Celula data-area="codcli" data-rotulo="Cód. cliente" className="numerico text-tinta-2">
        {item.codigoCliente ?? ""}
      </Celula>
      <Celula data-area="descricao" className="font-mono text-mini">
        {item.descricao}
        {item.cadastrarEm && (
          <Link
            href={item.cadastrarEm}
            className="block mt-1 font-sans text-carimbo hover:underline whitespace-nowrap"
          >
            cadastrar como produto
          </Link>
        )}
      </Celula>

      {editavel ? (
        <>
          <Celula alinhamento="numero" data-area="qnt" data-rotulo="Quantidade">
            <form action={enviar} id={`item-${item.id}`}>
              <input type="hidden" name="itemId" value={item.id} />
              {/*
                Diz ao servidor que ESTE formulário tem opinião sobre IPI.
                Sem ele, caixa desmarcada — que o navegador não envia — seria
                indistinguível de formulário sem caixa, e desmarcar nunca
                salvaria. Só existe quando a caixa existe.
              */}
              {!semPreco && <input type="hidden" name={CAMPO_IPI_DEFINIDO} value="1" />}
              <input
                name="quantidade"
                inputMode="decimal"
                defaultValue={digitado("quantidade", escreverNumeroBr(item.quantidade, 0))}
                {...gravaSozinho}
                aria-label="Quantidade"
                aria-invalid={comErro("quantidade") ? true : undefined}
                aria-describedby={estado.erro ? idErro : undefined}
                className={`${CLASSE_CONTROLE_CELULA} w-20 max-sm:w-full text-right numerico ${
                  comErro("quantidade") ? CLASSE_ERRO : ""
                }`}
              />
            </form>
          </Celula>
          <Celula data-area="un" data-rotulo="Unidade" className="text-tinta-2">
            {ROTULO_UNIDADE[item.unidade]}
          </Celula>
          {!semPreco && (
          <Celula alinhamento="numero" data-area="preco" data-rotulo={rotuloPreco}>
            <input
              form={`item-${item.id}`}
              name="precoUnitario"
              inputMode="decimal"
              // Até 6 casas: é a precisão que o banco guarda, e cortá-la aqui
              // faria o total errar centavos ao salvar a linha.
              defaultValue={digitado("precoUnitario", escreverNumeroBr(item.precoUnitario, 2, 6))}
              {...gravaSozinho}
              aria-label="Preço unitário"
              aria-invalid={comErro("precoUnitario") ? true : undefined}
              aria-describedby={estado.erro ? idErro : undefined}
              className={`${CLASSE_CONTROLE_CELULA} w-28 max-sm:w-full text-right numerico ${
                comErro("precoUnitario") ? CLASSE_ERRO : ""
              }`}
            />
          </Celula>
          )}
        </>
      ) : (
        <>
          <Celula alinhamento="numero" data-area="qnt" data-rotulo="Quantidade">
            {escreverNumeroBr(item.quantidade, 0)}
          </Celula>
          <Celula data-area="un" data-rotulo="Unidade" className="text-tinta-2">
            {ROTULO_UNIDADE[item.unidade]}
          </Celula>
          {!semPreco && (
            <Celula alinhamento="numero" data-area="preco" data-rotulo={rotuloPreco}>
              {formatarMoeda(item.precoUnitario)}
            </Celula>
          )}
        </>
      )}

      {!semPreco && (
      <>
      <Celula alinhamento="numero" data-area="totsemipi" data-rotulo="Total s/ IPI">
        {formatarMoeda(item.totalSemIpi)}
      </Celula>
      {/*
        A caixa fica NA COLUNA DO IPI, e não numa coluna nova.

        É onde o olho já procura o valor, e marcar/desmarcar muda justamente o
        número ao lado — a causa e o efeito ficam no mesmo lugar. Uma coluna
        extra só para a caixa empurraria a tabela para a rolagem horizontal no
        celular sem dizer nada a mais.
      */}
      <Celula alinhamento="numero" data-area="ipi" data-rotulo="IPI" className="text-tinta-2">
        {editavel ? (
          <label
            className="flex items-center justify-end max-sm:justify-start gap-2 cursor-pointer"
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
      <Celula alinhamento="numero" data-area="total" data-rotulo="Total">
        {formatarMoeda(item.total)}
      </Celula>
      </>
      )}

      {editavel && (
        <Celula alinhamento="acao" data-area="acao">
          <AcaoComRecusa
            acao={remover}
            confirmar={{
              titulo: `Remover “${item.descricao}”?`,
              texto: semPreco
                ? "A linha sai do pedido. Para trazê-la de volta, lance o item de novo."
                : `A linha sai, com a quantidade e o preço dela, e o total é recalculado sem ` +
                  `${formatarMoeda(item.total)}. Para trazê-la de volta, lance o item de novo.`,
              rotulo: "Remover",
            }}
          >
            <input type="hidden" name="itemId" value={item.id} />
            <BotaoTexto
              type="submit"
              perigoso
              disabled={salvando}
              aria-label={`Remover ${item.descricao}`}
            >
              remover
            </BotaoTexto>
          </AcaoComRecusa>
        </Celula>
      )}
    </tr>
    {/*
      O erro da linha, logo embaixo dela. Já esteve no canto direito, longe da
      quantidade e do preço que o causaram — e antes disso era descartado:
      gravando sozinha, uma falha muda seria a linha simplesmente não mudando
      de valor, sem nada na tela explicando.
    */}
    {estado.erro && (
      <tr>
        <td colSpan={colunas} data-area="linha" className="px-3 pb-2.5">
          <p id={idErro} role="alert" className="text-mini text-perigo max-w-2xl">
            {estado.erro}
          </p>
        </td>
      </tr>
    )}
    </Fragment>
  );
}

function FormularioAdicao({
  produtos,
  estado,
  enviar,
  enviando,
  semPreco,
}: {
  produtos: ProdutoOpcao[];
  estado: EstadoFormulario;
  enviar: (formData: FormData) => void;
  enviando: boolean;
  semPreco: boolean;
}) {
  const [produtoId, setProdutoId] = useState("");
  const [unidade, setUnidade] = useState<UnidadeVenda | "">("");
  const [quantidade, setQuantidade] = useState("");
  const [precoManual, setPrecoManual] = useState<string | null>(null);

  /*
   * A linha só se esvazia quando o item ENTROU.
   *
   * Antes ela era limpa no clique, antes de o servidor responder — e um item
   * recusado ("informe a quantidade") sumia junto com o erro, obrigando a
   * escolher o produto de novo para corrigir um número.
   */
  const [estadoVisto, setEstadoVisto] = useState(estado);
  if (estado !== estadoVisto) {
    setEstadoVisto(estado);
    if (!estado.erro) {
      setProdutoId("");
      setUnidade("");
      setQuantidade("");
      setPrecoManual(null);
    }
  }

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

  // As que têm preço, e a unidade sempre: é nela que vai a amostra de 25 sacos
  // ou de duas bobinas. Sem preço calculado, ele é digitado (`unidadesDoItem`).
  const unidades = useMemo(() => (produto ? unidadesDoItem(produto) : []), [produto]);

  const unidadeEfetiva = (unidade ||
    (produto?.unidadePadrao && unidades.includes(produto.unidadePadrao)
      ? produto.unidadePadrao
      : unidades[0])) as UnidadeVenda | undefined;

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
    <Formulario estado={estado} action={enviar} className="space-y-3">
      {/*
        Colunas nomeadas e `items-start`.

        Todo campo desta linha é rótulo em cima e caixa embaixo, de alturas
        diferentes — o preço às vezes ganha uma dica por baixo. Alinhar pelo
        TOPO é o que mantém as caixas na mesma linha; alinhar pelo centro ou
        pela base faria cada uma subir conforme o que tem embaixo dela.
      */}
      <div
        className={`grid gap-3 sm:grid-cols-2 lg:items-start ${
          semPreco
            ? "lg:grid-cols-[minmax(12rem,2fr)_7rem_8rem_auto]"
            : "lg:grid-cols-[minmax(12rem,2fr)_7rem_8rem_9.5rem_auto_auto]"
        }`}
      >
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

        {!semPreco && (
        <>
        <Campo
          name="precoUnitario"
          rotulo="Preço"
          inputMode="decimal"
          value={preco}
          onChange={(e) => setPrecoManual(e.target.value)}
          dica={
            precoCalculado
              ? "Calculado — dá para ajustar."
              : unidadeEfetiva === "UN"
                ? "Digite o preço por unidade."
                : undefined
          }
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
        </>
        )}

        {/*
          O botão não tem rótulo, mas precisa da altura de um para descer até a
          régua das caixas. O espaçador invisível faz isso sem número mágico:
          ele é uma cópia do rótulo dos vizinhos, só que sem tinta.
        */}
        <div className="block">
          <EspacoDoRotulo />
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

      {!semPreco && totalPrevisto !== null && (
        <p className="text-mini text-tinta-3 numerico">
          Este item entra por {formatarMoeda(totalPrevisto)} antes do IPI.
        </p>
      )}

      <ErroGeral />
    </Formulario>
  );
}
