/**
 * Testes de navegador da tampa na tabela de itens.
 *
 * O que se protege: o fornecedor da tampa só é perguntado quando o produto
 * escolhido é variável, e aparece na tela para quem compra. O acabamento vem do
 * cadastro: a linha só o mostra, e a escolha é com ou sem mão de obra.
 *
 * Rode com:  npm run test:navegador
 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { page } from "vitest/browser";
import { render } from "vitest-browser-react";

import { type ItemPedido, type ProdutoOpcao, SecaoItens } from "./itens-documento";

const acao = async () => ({});

const PRODUTO: ProdutoOpcao = {
  id: "p1",
  descricao: "Frasco 500mL + Tampa 28mm",
  familia: "FRASCO_TAMPA",
  codigoFornecedor: null,
  larguraCm: null,
  comprimentoCm: null,
  espessuraMm: null,
  fatorKg: null,
  densidade: null,
  precoUnidade: null,
  precoCaixa: null,
  precoKg: null,
  unidadeAvulsa: "MIL",
  precoAvulso: "2000",
  unidadesPorCaixa: null,
  acabamento: "Serigrafado",
  acabamentoValorCom: "150",
  acabamentoValorSem: "90",
  fornecedorTampaVariavel: true,
  aditivos: [],
  unidadePadrao: null,
};

const LINHA: ItemPedido = {
  id: "i1",
  familia: "FRASCO_TAMPA",
  codigoFornecedor: "F-1",
  codigoCliente: null,
  descricao: "Frasco 500mL + Tampa 28mm",
  unidade: "MIL",
  quantidade: "2",
  precoUnitario: "2150",
  comIpi: true,
  totalSemIpi: "4300",
  valorIpi: "0",
  total: "4300",
};

function abrir({
  itens = [],
  produtos = [PRODUTO],
  editavel = true,
  atualizar = acao,
  obrigatorio = true,
}: {
  itens?: ItemPedido[];
  produtos?: ProdutoOpcao[];
  editavel?: boolean;
  atualizar?: () => Promise<object>;
  obrigatorio?: boolean;
}) {
  return render(
    <SecaoItens
      itens={itens}
      produtos={produtos}
      totais={{ subtotalSemIpi: "0", valorIpi: "0", totalGeral: "0", ipiPercentual: "0" }}
      editavel={editavel}
      adicionar={acao}
      atualizar={atualizar}
      remover={acao}
      definirIpiDeTodos={acao}
      fornecedoresDaTampa={[
        { id: "f2", rotulo: "SOROPLAST" },
        { id: "f3", rotulo: "ALEMOLDE" },
      ]}
      fornecedorTampaObrigatorio={obrigatorio}
    />,
  );
}

describe("lançar conjunto", () => {
  test("com fornecedor variável, pergunta ao lado do produto", async () => {
    const tela = await abrir({});
    const fornecedor = tela.getByRole("combobox", { name: /Fornecedor da tampa/ });

    await expect.element(fornecedor).not.toBeInTheDocument();

    await tela.getByRole("combobox", { name: "Produto" }).click();
    await tela.getByRole("option", { name: PRODUTO.descricao }).click();

    await expect.element(fornecedor).toBeVisible();
    // O pedido exige a escolha: o campo vazio não passa.
    await expect.element(fornecedor).toBeInvalid();
  });

  const escolherProduto = async (tela: Awaited<ReturnType<typeof abrir>>) => {
    await tela.getByRole("combobox", { name: "Produto" }).click();
    await tela.getByRole("option", { name: PRODUTO.descricao }).click();
  };

  test("mostra o acabamento do cadastro, e só pergunta a mão de obra", async () => {
    const tela = await abrir({});
    await expect.element(tela.getByRole("radio").first()).not.toBeInTheDocument();

    await escolherProduto(tela);

    await expect.element(tela.getByText("Serigrafado", { exact: true })).toBeVisible();
    await expect
      .element(tela.getByRole("checkbox", { name: "Serigrafado" }))
      .not.toBeInTheDocument();
    await expect.element(tela.getByRole("radio", { name: /^Com mão de obra/ })).not.toBeChecked();
    await expect.element(tela.getByRole("radio", { name: /^Sem mão de obra/ })).not.toBeChecked();
  });

  test.each(["Sleeve", "Rotulado Manga", "Flexografia"])(
    "o nome vem do produto: %s",
    async (nome) => {
      const tela = await abrir({ produtos: [{ ...PRODUTO, acabamento: nome }] });
      await escolherProduto(tela);

      await expect.element(tela.getByText(nome, { exact: true })).toBeVisible();
      await expect.element(tela.getByText("Serigrafado")).not.toBeInTheDocument();
    },
  );

  test("o preço soma o valor escolhido", async () => {
    const tela = await abrir({});
    await escolherProduto(tela);
    const preco = tela.getByRole("textbox", { name: /^Preço/ });

    await expect.element(preco).toHaveValue("2.000,00");

    await tela.getByRole("radio", { name: /^Com mão de obra/ }).click();
    await expect.element(preco).toHaveValue("2.150,00");

    await tela.getByRole("radio", { name: /^Sem mão de obra/ }).click();
    await expect.element(preco).toHaveValue("2.090,00");
  });

  test("sem dizer a mão de obra, o formulário não passa", async () => {
    const tela = await abrir({});
    await escolherProduto(tela);

    await expect.element(tela.getByRole("radio", { name: /^Com mão de obra/ })).toBeInvalid();
  });

  test("trocar de produto pede a escolha outra vez", async () => {
    const BOMBONA = { ...PRODUTO, id: "p2", descricao: "Bombona 20L", acabamento: "Sleeve" };
    const tela = await abrir({ produtos: [PRODUTO, BOMBONA] });

    await escolherProduto(tela);
    await tela.getByRole("radio", { name: /^Com mão de obra/ }).click();

    await tela.getByRole("combobox", { name: "Produto" }).click();
    await tela.getByRole("option", { name: BOMBONA.descricao }).click();

    await expect.element(tela.getByText("Sleeve", { exact: true })).toBeVisible();
    await expect.element(tela.getByRole("radio", { name: /^Com mão de obra/ })).not.toBeChecked();
  });

  test("com um valor só no cadastro, já vem escolhido", async () => {
    const tela = await abrir({ produtos: [{ ...PRODUTO, acabamentoValorSem: null }] });
    await escolherProduto(tela);

    await expect.element(tela.getByRole("radio", { name: /^Com mão de obra/ })).toBeChecked();
    await expect.element(tela.getByRole("radio", { name: /^Sem mão de obra/ })).not.toBeInTheDocument();
    await expect
      .element(tela.getByRole("textbox", { name: /^Preço/ }))
      .toHaveValue("2.150,00");
  });

  describe("a pergunta vem antes do Adicionar", () => {
    afterEach(async () => {
      await page.viewport(1280, 720);
    });

    const topoDe = (elemento: Element) => elemento.getBoundingClientRect().top;

    test("no celular, fica acima do botão", async () => {
      await page.viewport(390, 844);
      const tela = await abrir({});
      await escolherProduto(tela);

      const pergunta = tela.getByRole("radio", { name: /^Sem mão de obra/ });
      await expect.element(pergunta).toBeVisible();

      expect(topoDe(pergunta.element())).toBeLessThan(
        topoDe(tela.getByRole("button", { name: "Adicionar" }).element()),
      );
    });

    test("no computador, desce para a linha de baixo", async () => {
      const tela = await abrir({});
      await escolherProduto(tela);

      const pergunta = tela.getByRole("radio", { name: /^Sem mão de obra/ });
      await expect.element(pergunta).toBeVisible();

      expect(topoDe(pergunta.element())).toBeGreaterThan(
        topoDe(tela.getByRole("button", { name: "Adicionar" }).element()),
      );
    });
  });

  test("produto sem acabamento não mostra nada disso", async () => {
    const tela = await abrir({
      produtos: [
        { ...PRODUTO, acabamento: null, acabamentoValorCom: null, acabamentoValorSem: null },
      ],
    });

    await tela.getByRole("combobox", { name: "Produto" }).click();
    await tela.getByRole("option", { name: PRODUTO.descricao }).click();

    await expect.element(tela.getByRole("radio").first()).not.toBeInTheDocument();
    await expect.element(tela.getByText("Acabamento:")).not.toBeInTheDocument();
  });

  test("produto de fornecedor fixo não pergunta", async () => {
    const tela = await abrir({ produtos: [{ ...PRODUTO, fornecedorTampaVariavel: false }] });

    await tela.getByRole("combobox", { name: "Produto" }).click();
    await tela.getByRole("option", { name: PRODUTO.descricao }).click();

    await expect
      .element(tela.getByRole("combobox", { name: "Fornecedor da tampa" }))
      .not.toBeInTheDocument();
  });

  test("na proposta, avisa que pode ficar para o pedido", async () => {
    const tela = await abrir({ obrigatorio: false });

    await tela.getByRole("combobox", { name: "Produto" }).click();
    await tela.getByRole("option", { name: PRODUTO.descricao }).click();

    await expect.element(tela.getByText("Pode ficar para quando virar pedido.")).toBeVisible();
    await expect.element(tela.getByRole("combobox", { name: /Fornecedor da tampa/ })).toBeValid();
  });
});

describe("a tampa na linha", () => {
  test("mostra o fornecedor fixo e o código, sem seletor", async () => {
    const tela = await abrir({
      itens: [
        {
          ...LINHA,
          tampa: { variavel: false, fornecedorId: "f2", fornecedorNome: "SOROPLAST", codigo: "T-42" },
        },
      ],
    });

    await expect.element(tela.getByText("SOROPLAST")).toBeVisible();
    await expect.element(tela.getByText("· cód. T-42")).toBeVisible();
    await expect
      .element(tela.getByRole("combobox", { name: "Fornecedor da tampa" }))
      .not.toBeInTheDocument();
  });

  test("no variável, escolher na linha grava sozinho", async () => {
    const atualizar = vi.fn(acao);
    const tela = await abrir({
      atualizar,
      itens: [
        {
          ...LINHA,
          tampa: { variavel: true, fornecedorId: null, fornecedorNome: null, codigo: null },
        },
      ],
    });

    await tela
      .getByRole("combobox", { name: "Fornecedor da tampa" })
      .selectOptions("ALEMOLDE");

    await expect.poll(() => atualizar.mock.calls.length).toBe(1);
  });

  test("indústria que saiu da lista continua sendo a escolhida da linha", async () => {
    const tela = await abrir({
      itens: [
        {
          ...LINHA,
          tampa: { variavel: true, fornecedorId: "f9", fornecedorNome: "INATIVA", codigo: null },
        },
      ],
    });

    await expect
      .element(tela.getByRole("combobox", { name: "Fornecedor da tampa" }))
      .toHaveDisplayValue("INATIVA");
  });

  test("em leitura, sem escolha, avisa o que falta", async () => {
    const tela = await abrir({
      editavel: false,
      itens: [
        {
          ...LINHA,
          tampa: { variavel: true, fornecedorId: null, fornecedorNome: null, codigo: null },
        },
      ],
    });

    await expect.element(tela.getByText("fornecedor a escolher")).toBeVisible();
  });

  test("a linha mostra como o acabamento foi cobrado", async () => {
    const tela = await abrir({ itens: [{ ...LINHA, maoDeObra: false }] });

    await expect.element(tela.getByText("Sem mão de obra")).toBeVisible();
  });

  test("sem nada a dizer, a linha fica como era", async () => {
    const tela = await abrir({ itens: [LINHA] });

    await expect.element(tela.getByText("Tampa:")).not.toBeInTheDocument();
    await expect.element(tela.getByText(/mão de obra/)).not.toBeInTheDocument();
  });
});
