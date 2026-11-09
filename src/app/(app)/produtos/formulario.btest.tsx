/**
 * Testes de navegador da descrição no cadastro de produto.
 *
 * O que se protege: a descrição acompanha as especificações. Abrir e salvar não
 * mexe no texto gravado (o do sistema anterior continua como estava), mas
 * mudar uma medida reescreve a descrição — o saco que virou 35x40 não pode
 * seguir impresso 30x40 no pedido.
 *
 * Rode com:  npm run test:navegador
 */

import { afterEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";

import { FormularioProduto } from "./formulario";
import { VALORES_VAZIOS } from "./valores";

const SACO = {
  ...VALORES_VAZIOS,
  fornecedorId: "f1",
  familia: "SACO",
  material: "PEAD",
  larguraCm: "30",
  comprimentoCm: "40",
  espessuraMm: "0,06",
  fatorKg: "14",
  descricao: "SACO 30X40 DO SISTEMA ANTIGO",
};

const FORNECEDORES = [
  { id: "f1", nome: "ALFAPLAST", fatorKgPadrao: null, comissaoPercentual: "5", aditivos: [], materiais: [] },
];

async function abrir() {
  await render(
    <FormularioProduto
      fornecedores={FORNECEDORES}
      clientes={[]}
      valores={SACO}
      acao={async () => ({})}
      rotuloEnvio="Salvar"
    />,
  );
  return {
    descricao: page.elementLocator(document.querySelector('[name="descricao"]')!),
    largura: page.elementLocator(document.querySelector('[name="larguraCm"]')!),
  };
}

describe("descrição do produto", () => {
  test("abrir a ficha não mexe no texto gravado", async () => {
    const { descricao } = await abrir();
    await expect.element(descricao).toHaveValue("SACO 30X40 DO SISTEMA ANTIGO");
  });

  test("mudar a medida reescreve a descrição", async () => {
    const { descricao, largura } = await abrir();

    await userEvent.clear(largura);
    await userEvent.type(largura, "35");

    await expect.element(descricao).toHaveValue("35x40x0,06 S/SF PEAD");
  });

  test("o texto ajustado depois da mudança fica, até a próxima mudança", async () => {
    const { descricao, largura } = await abrir();

    await userEvent.clear(largura);
    await userEvent.type(largura, "35");
    await userEvent.type(descricao, " LISO");
    await expect.element(descricao).toHaveValue("35x40x0,06 S/SF PEAD LISO");

    await userEvent.type(largura, "0");
    await expect.element(descricao).toHaveValue("350x40x0,06 S/SF PEAD");
  });
});

describe("o produto novo começa sem tipo", () => {
  async function abrirNovo(acao = vi.fn(async () => ({}))) {
    const tela = await render(
      <FormularioProduto
        fornecedores={FORNECEDORES}
        clientes={[]}
        valores={{ ...VALORES_VAZIOS, fornecedorId: "f1" }}
        acao={acao}
        rotuloEnvio="Salvar"
      />,
    );
    return { tela, acao };
  }

  test("nenhum tipo marcado, e só os campos que não dependem dele", async () => {
    const { tela } = await abrirNovo();

    await expect.element(tela.getByRole("combobox", { name: "Tipo" })).toHaveValue("");
    await expect.element(tela.getByRole("combobox", { name: "Indústria" })).toBeVisible();
    await expect.element(tela.getByRole("textbox", { name: /^Código na indústria/ })).toBeVisible();

    await expect.element(tela.getByRole("combobox", { name: "Material" })).not.toBeInTheDocument();
    await expect.element(tela.getByRole("heading", { name: "Medidas" })).not.toBeInTheDocument();
    await expect
      .element(tela.getByRole("heading", { name: "Como sai no pedido" }))
      .not.toBeInTheDocument();
  });

  test("salvar sem tipo pede o tipo embaixo do campo, e não envia", async () => {
    const { tela, acao } = await abrirNovo();

    await tela.getByRole("button", { name: "Salvar" }).click();

    await expect.element(tela.getByText(/Escolha uma opção da lista/)).toBeVisible();
    expect(acao).not.toHaveBeenCalled();
  });

  test("escolher o tipo mostra os campos dele", async () => {
    const { tela } = await abrirNovo();

    await userEvent.type(tela.getByRole("combobox", { name: "Tipo" }), "saco");
    await userEvent.keyboard("{Enter}");

    await expect.element(tela.getByRole("combobox", { name: "Tipo" })).toHaveValue("Saco plástico");
    await expect.element(tela.getByRole("combobox", { name: "Material" })).toBeVisible();
    await expect.element(tela.getByRole("heading", { name: "Medidas" })).toBeVisible();
    await expect.element(tela.getByRole("heading", { name: "Como sai no pedido" })).toBeVisible();
  });

  test("o que aparece com o tipo entra em cascata, na ordem da tela", async () => {
    const { tela } = await abrirNovo();

    await userEvent.type(tela.getByRole("combobox", { name: "Tipo" }), "saco");
    await userEvent.keyboard("{Enter}");

    /** O atraso da entrada do bloco (a seção, ou o campo dentro da grade). */
    const atraso = (elemento: Element) => {
      const entrada = elemento
        .getAnimations()
        .find((a) => (a as CSSAnimation).animationName === "surgir");
      return entrada ? Number(entrada.effect!.getTiming().delay) : null;
    };
    const secao = (titulo: string) =>
      tela.getByRole("heading", { name: titulo }).element().closest("fieldset > *")!;
    const campoNaGrade = (nome: string) =>
      tela.getByRole("combobox", { name: nome }).element().closest(".palco > *")!;

    const medidas = atraso(secao("Medidas"));
    const descricao = atraso(secao("Como sai no pedido"));
    expect(medidas).not.toBeNull();
    expect(descricao).not.toBeNull();
    expect(descricao!).toBeGreaterThan(medidas!);
    expect(atraso(campoNaGrade("Material"))).not.toBeNull();
  });

  test("os códigos digitados antes do tipo continuam depois dele", async () => {
    const { tela } = await abrirNovo();

    await userEvent.type(tela.getByRole("textbox", { name: /^Código na indústria/ }), "BB-20");
    await userEvent.type(tela.getByRole("combobox", { name: "Tipo" }), "bombona");
    await userEvent.keyboard("{Enter}");

    await expect
      .element(tela.getByRole("textbox", { name: /^Código na indústria/ }))
      .toHaveValue("BB-20");
  });
});

describe("lista aberta fica por cima do resto do formulário", () => {
  const COM_MATERIAIS = [
    {
      ...FORNECEDORES[0],
      materiais: ["PEAD", "PEBD", "PP", "PEAD RECICLADO", "PEBD LINEAR", "BOPP"].map((nome) => ({
        nome,
        precoKg: "14",
        precoMinimoKg: null,
        densidade: "0.95",
      })),
    },
  ];

  /**
   * A cascata das seções não pode deixar um contexto de empilhamento em cada uma:
   * com ele, o cartão de baixo pintava por cima da lista aberta no de cima.
   */
  test("a última opção do Material não fica atrás do Complemento nem das Medidas", async () => {
    const tela = await render(
      <FormularioProduto
        fornecedores={COM_MATERIAIS}
        clientes={[]}
        valores={{ ...VALORES_VAZIOS, fornecedorId: "f1" }}
        acao={async () => ({})}
        rotuloEnvio="Salvar"
      />,
    );

    await userEvent.type(tela.getByRole("combobox", { name: "Tipo" }), "saco");
    await userEvent.keyboard("{Enter}");
    // Depois da entrada: é aí que o bloco ficava com a camada própria para sempre.
    await Promise.all(document.getAnimations().map((a) => a.finished));

    await tela.getByRole("combobox", { name: "Material" }).click();
    const ultima = tela.getByRole("option", { name: /^BOPP/ });
    await expect.element(ultima).toBeVisible();

    const caixa = ultima.element().getBoundingClientRect();
    const noTopo = document.elementFromPoint(caixa.left + 10, caixa.top + caixa.height / 2);
    expect(ultima.element().contains(noTopo)).toBe(true);
  });
});

describe("tipos vendidos por milheiro", () => {
  async function novoProduto() {
    const tela = await render(
      <FormularioProduto
        fornecedores={FORNECEDORES}
        clientes={[]}
        valores={{ ...VALORES_VAZIOS, fornecedorId: "f1" }}
        acao={async () => ({})}
        rotuloEnvio="Salvar"
      />,
    );

    return {
      tela,
      // Procurada na hora: o produto novo começa sem tipo, e a descrição só
      // aparece depois que ele é escolhido.
      descricao: tela.getByRole("textbox", { name: /^Descrição impressa/ }),
      campo: (nome: string) => page.elementLocator(document.querySelector(`[name="${nome}"]`)!),
    };
  }

  type Tela = Awaited<ReturnType<typeof novoProduto>>["tela"];

  /** Acha o tipo como a pessoa acha: digitando um pedaço do nome. */
  async function escolherTipo(tela: Tela, pedaco: string) {
    await userEvent.type(tela.getByRole("combobox", { name: "Tipo" }), pedaco);
    await userEvent.keyboard("{Enter}");
  }

  test("a capacidade só aceita número: 20L fica 20, e a descrição mostra", async () => {
    const { tela, descricao, campo } = await novoProduto();

    await escolherTipo(tela, "bombona");
    await userEvent.type(campo("capacidade"), "20L");

    await expect.element(campo("capacidade")).toHaveValue("20");
    await expect.element(descricao).toHaveValue("Bombona 20L");
  });

  test("escolher o tipo digitando abre as medidas dele", async () => {
    const { tela, descricao, campo } = await novoProduto();

    await escolherTipo(tela, "bombona");
    await userEvent.type(campo("capacidade"), "20");

    await expect.element(descricao).toHaveValue("Bombona 20L");
  });

  test("o material é sugerido, e a etiqueta entra na descrição", async () => {
    const { tela, descricao, campo } = await novoProduto();

    await escolherTipo(tela, "bombona");
    await userEvent.type(campo("capacidade"), "20");
    await userEvent.type(tela.getByRole("combobox", { name: "Material" }), "PEAD");
    await userEvent.tab();
    await tela.getByRole("button", { name: "Cor" }).click();
    await tela.getByRole("button", { name: "Natural" }).click();
    await tela.getByRole("button", { name: "Fechamento" }).click();
    await tela.getByRole("button", { name: "Tampa Removível" }).click();

    await expect.element(descricao).toHaveValue("Bombona 20L PEAD Tampa Removível Natural");
    await expect.element(campo("complemento")).toHaveValue("Tampa Removível Natural");
  });

  test("as etiquetas ficam guardadas até abrir um grupo", async () => {
    const { tela } = await novoProduto();

    await escolherTipo(tela, "bombona");

    await expect.element(tela.getByRole("button", { name: "Bocal", exact: true })).toBeVisible();
    await expect
      .element(tela.getByRole("button", { name: "Bocal 45mm" }))
      .not.toBeInTheDocument();
  });

  test("a busca acha em todos os grupos, e o marcado continua na caixa", async () => {
    const { tela } = await novoProduto();

    await escolherTipo(tela, "bombona");
    await tela.getByRole("button", { name: "Cor" }).click();
    await tela.getByRole("button", { name: "Natural" }).click();

    await userEvent.type(tela.getByRole("searchbox", { name: "Complemento" }), "cinta");

    await expect.element(tela.getByRole("button", { name: "Cinta de Segurança" })).toBeVisible();
    await expect.element(tela.getByRole("button", { name: "Tirar Natural" })).toBeVisible();
    await expect
      .element(tela.getByRole("button", { name: "Azul" }))
      .not.toBeInTheDocument();
  });

  test("o frasco deixa escolher mL ou L", async () => {
    const { tela, descricao, campo } = await novoProduto();

    await escolherTipo(tela, "frasco");
    await userEvent.type(campo("capacidade"), "500");
    await expect.element(descricao).toHaveValue("Frasco 500mL");

    await campo("capacidadeUnidade").selectOptions("L");
    await expect.element(descricao).toHaveValue("Frasco 500L");
  });

  test("o papelão pede as três medidas e já traz o modelo", async () => {
    const { tela, descricao, campo } = await novoProduto();

    await escolherTipo(tela, "papel");
    await userEvent.type(campo("comprimentoCm"), "30");
    await userEvent.type(campo("larguraCm"), "20");
    await userEvent.type(campo("alturaCm"), "15");

    await expect.element(descricao).toHaveValue("Caixa de papelão 30x20x15cm");
  });

  test("o conjunto junta as duas peças", async () => {
    const { tela, descricao, campo } = await novoProduto();

    await escolherTipo(tela, "frasco + tampa");
    await userEvent.type(campo("capacidade"), "500");
    await userEvent.type(tela.getByRole("combobox", { name: "Material do frasco" }), "PEAD");
    await userEvent.type(campo("diametroMm"), "28");
    await userEvent.type(tela.getByRole("combobox", { name: "Material da tampa" }), "PP");
    await userEvent.type(tela.getByRole("searchbox", { name: "Complemento da tampa" }), "flip");
    await tela.getByRole("button", { name: "Flip Top" }).click();

    await expect.element(descricao).toHaveValue("Frasco 500mL PEAD + Tampa 28mm PP Flip Top");
  });

  test("reabrir a ficha volta no tipo, com a etiqueta acesa", async () => {
    const tela = await render(
      <FormularioProduto
        fornecedores={FORNECEDORES}
        clientes={[]}
        valores={{
          ...VALORES_VAZIOS,
          fornecedorId: "f1",
          familia: "BOMBONA",
          material: "PEAD",
          complemento: "Natural",
          capacidade: "20",
          capacidadeUnidade: "L",
          precoAvulso: "1.250,00",
          descricao: "Bombona 20L PEAD Natural",
        }}
        acao={async () => ({})}
        rotuloEnvio="Salvar"
      />,
    );

    await expect.element(tela.getByRole("combobox", { name: "Tipo" })).toHaveValue("Bombona");
    await expect.element(tela.getByRole("combobox", { name: "Material" })).toHaveValue("PEAD");
    await expect.element(tela.getByRole("button", { name: "Tirar Natural" })).toBeVisible();
  });
});

describe("acabamento e tampa", () => {
  const INDUSTRIAS = [
    ...FORNECEDORES,
    { id: "f2", nome: "SOROPLAST", fatorKgPadrao: null, comissaoPercentual: "5", aditivos: [], materiais: [] },
  ];

  async function abrirEm(tipo: string) {
    const tela = await render(
      <FormularioProduto
        fornecedores={INDUSTRIAS}
        clientes={[]}
        valores={{ ...VALORES_VAZIOS, fornecedorId: "f1" }}
        acao={async () => ({})}
        rotuloEnvio="Salvar"
      />,
    );

    await userEvent.type(tela.getByRole("combobox", { name: "Tipo" }), tipo);
    await userEvent.keyboard("{Enter}");

    return {
      tela,
      campo: (nome: string) => page.elementLocator(document.querySelector(`[name="${nome}"]`)!),
    };
  }

  /** O que vai no formulário: o seletor escreve num campo escondido. */
  const acabamento = () =>
    document.querySelector<HTMLInputElement>('input[name="acabamento"]')?.value ?? null;

  type Tela = Awaited<ReturnType<typeof render>>;

  /** Abre o grupo e marca a opção, como no complemento. */
  async function marcar(tela: Tela, grupo: string, opcao: string) {
    await tela.getByRole("button", { name: grupo, exact: true }).click();
    await tela
      .getByRole("group", { name: grupo, exact: true })
      .getByRole("button", { name: opcao, exact: true })
      .click();
  }

  afterEach(async () => {
    await page.viewport(1280, 720);
  });

  test("é o mesmo seletor do complemento: grupos fechados, nenhuma caixa de marcar", async () => {
    const { tela } = await abrirEm("bombona");

    for (const grupo of ["Impressão", "Rotulado", "Sleeve"]) {
      await expect.element(tela.getByRole("button", { name: grupo, exact: true })).toBeVisible();
    }
    await expect.element(tela.getByRole("button", { name: "Serigrafado" })).not.toBeInTheDocument();
    await expect.element(tela.getByRole("checkbox", { name: "Serigrafado" })).not.toBeInTheDocument();
  });

  test("só um acabamento fica marcado, mesmo em grupos diferentes", async () => {
    const { tela } = await abrirEm("bombona");

    await marcar(tela, "Impressão", "Serigrafado");
    await marcar(tela, "Rotulado", "Rotulado Adesivo");

    await expect.poll(acabamento).toBe("Rotulado Adesivo");
    await expect.element(tela.getByRole("button", { name: "Tirar Rotulado Adesivo" })).toBeVisible();
    await expect
      .element(tela.getByRole("button", { name: "Tirar Serigrafado" }))
      .not.toBeInTheDocument();
  });

  test("marcar fecha o grupo", async () => {
    const { tela } = await abrirEm("bombona");

    await marcar(tela, "Impressão", "Serigrafado");

    await expect
      .element(tela.getByRole("button", { name: "Impressão", exact: true }))
      .toHaveAttribute("aria-expanded", "false");
  });

  test("clicar de novo desmarca, e os valores somem", async () => {
    const { tela } = await abrirEm("bombona");

    await marcar(tela, "Sleeve", "Sleeve");
    await expect
      .element(tela.getByRole("textbox", { name: /^Valor com mão de obra/ }))
      .toBeVisible();

    await marcar(tela, "Sleeve", "Sleeve");

    await expect.poll(acabamento).toBe("");
    await expect
      .element(tela.getByRole("textbox", { name: /^Valor com mão de obra/ }))
      .not.toBeInTheDocument();
  });

  test("o X da ficha também tira o acabamento", async () => {
    const { tela } = await abrirEm("bombona");

    await marcar(tela, "Sleeve", "Stretch Sleeve");
    await tela.getByRole("button", { name: "Tirar Stretch Sleeve" }).click();

    await expect.poll(acabamento).toBe("");
  });

  test("trocar de acabamento limpa os dois valores", async () => {
    const { tela, campo } = await abrirEm("frasco");

    await marcar(tela, "Impressão", "Serigrafado");
    await userEvent.type(campo("acabamentoValorCom"), "150,00");
    await userEvent.type(campo("acabamentoValorSem"), "90,00");

    await marcar(tela, "Impressão", "Hot Stamping");

    await expect.element(campo("acabamentoValorCom")).toHaveValue("");
    await expect.element(campo("acabamentoValorSem")).toHaveValue("");
  });

  test("o cadastro guarda só os valores: com ou sem mão de obra fica para o item", async () => {
    const { tela, campo } = await abrirEm("frasco");

    await marcar(tela, "Impressão", "Serigrafado");

    await expect.element(campo("acabamentoValorCom")).toBeVisible();
    await expect.element(campo("acabamentoValorSem")).toBeVisible();
    await expect.element(tela.getByRole("radio")).not.toBeInTheDocument();
  });

  test("a busca acha em todos os grupos, e o que não está na lista pode ser usado", async () => {
    const { tela, campo } = await abrirEm("frasco");
    const busca = tela.getByRole("searchbox", { name: "Acabamento" });

    await userEvent.type(busca, "rotulado");
    await expect.element(tela.getByRole("button", { name: "Rotulado Manga" })).toBeVisible();
    await expect.element(tela.getByRole("button", { name: "Serigrafado" })).not.toBeInTheDocument();

    await userEvent.clear(busca);
    await userEvent.type(busca, "Flexografia");
    await tela.getByRole("button", { name: /Usar .Flexografia./ }).click();

    await expect.poll(acabamento).toBe("Flexografia");
    await expect.element(campo("descricao")).toHaveValue("Frasco Flexografia");
  });

  test("digitar outro troca o anterior, em vez de somar", async () => {
    const { tela } = await abrirEm("frasco");
    const busca = tela.getByRole("searchbox", { name: "Acabamento" });

    await userEvent.type(busca, "Flexografia");
    await tela.getByRole("button", { name: /Usar .Flexografia./ }).click();
    await userEvent.type(busca, "Verniz UV");
    await tela.getByRole("button", { name: /Usar .Verniz UV./ }).click();

    await expect.poll(acabamento).toBe("Verniz UV");

    await marcar(tela, "Impressão", "Transfer");

    await expect.poll(acabamento).toBe("Transfer");
    await expect.element(tela.getByRole("button", { name: "Tirar Verniz UV" })).not.toBeInTheDocument();
  });

  test("no celular, o grupo sobe na folha, sem Pronto, e marcar fecha", async () => {
    await page.viewport(390, 844);
    const { tela } = await abrirEm("bombona");

    await tela.getByRole("button", { name: "Rotulado", exact: true }).click();
    const folha = tela.getByRole("dialog", { name: "Rotulado" });
    await expect.element(folha).toBeVisible();
    await expect.element(folha.getByRole("button", { name: "Pronto" })).not.toBeInTheDocument();

    await folha.getByRole("button", { name: "Rotulado Manga" }).click();

    await expect.element(tela.getByRole("dialog")).not.toBeInTheDocument();
    await expect.poll(acabamento).toBe("Rotulado Manga");
  });

  test("ao reabrir, o acabamento digitado continua marcado", async () => {
    const tela = await render(
      <FormularioProduto
        fornecedores={INDUSTRIAS}
        clientes={[]}
        valores={{
          ...VALORES_VAZIOS,
          fornecedorId: "f1",
          familia: "FRASCO",
          acabamento: "Flexografia",
          acabamentoValorSem: "90,00",
        }}
        acao={async () => ({})}
        rotuloEnvio="Salvar"
      />,
    );

    await expect.poll(acabamento).toBe("Flexografia");
    await expect.element(tela.getByRole("button", { name: "Tirar Flexografia" })).toBeVisible();
  });

  test("papelão não tem acabamento", async () => {
    const { tela } = await abrirEm("papel");

    await expect.element(tela.getByRole("heading", { name: "Acabamento" })).not.toBeInTheDocument();
  });

  test("marcar variável tira o fornecedor fixo e mantém o código", async () => {
    const { tela, campo } = await abrirEm("frasco + tampa");

    const fornecedor = tela.getByRole("combobox", { name: "Fornecedor da tampa" });
    await expect.element(fornecedor).toHaveValue("Mesma indústria do produto");

    await userEvent.fill(fornecedor, "soro");
    await tela.getByRole("option", { name: "SOROPLAST" }).click();
    await expect.element(campo("fornecedorTampaId")).toHaveValue("f2");

    await tela.getByRole("checkbox", { name: "Fornecedor variável Escolher em cada pedido" }).click();

    await expect.element(fornecedor).not.toBeInTheDocument();
    await expect.element(campo("codigoTampa")).toBeVisible();
  });

  test("bombona sem tampa não pergunta o fornecedor dela", async () => {
    const { tela } = await abrirEm("bombona");

    await expect
      .element(tela.getByRole("combobox", { name: "Fornecedor da tampa" }))
      .not.toBeInTheDocument();
  });

  test("trocar de família limpa tampa e acabamento", async () => {
    const { tela, campo } = await abrirEm("frasco + tampa");

    await tela.getByRole("checkbox", { name: "Fornecedor variável Escolher em cada pedido" }).click();
    await marcar(tela, "Impressão", "Serigrafado");
    await expect.poll(acabamento).toBe("Serigrafado");

    const tipo = tela.getByRole("combobox", { name: "Tipo" });
    await userEvent.fill(tipo, "bombona + tampa");
    await userEvent.keyboard("{Enter}");

    await expect.poll(acabamento).toBe("");
    await expect
      .element(tela.getByRole("checkbox", { name: "Fornecedor variável Escolher em cada pedido" }))
      .not.toBeChecked();
    await expect.element(campo("fornecedorTampaId")).toHaveValue("");
  });
});

describe("trocar de tipo", () => {
  const FORNECEDOR_COM_FATOR = [{ ...FORNECEDORES[0], fatorKgPadrao: "14.5" }];

  const CONJUNTO = {
    ...VALORES_VAZIOS,
    fornecedorId: "f1",
    familia: "BOMBONA_TAMPA",
    codigoFornecedor: "COD-1",
    material: "PEAD",
    complemento: "Natural",
    capacidade: "20",
    capacidadeUnidade: "L",
    diametroMm: "63",
    materialTampa: "PP",
    complementoTampa: "Azul",
    precoAvulso: "2.000,00",
    descricao: "Bombona 20L PEAD Natural + Tampa 63mm PP Azul",
  };

  async function abrirCom(valores: typeof VALORES_VAZIOS) {
    const tela = await render(
      <FormularioProduto
        fornecedores={FORNECEDOR_COM_FATOR}
        clientes={[]}
        valores={valores}
        acao={async () => ({})}
        rotuloEnvio="Salvar"
      />,
    );
    return {
      tela,
      campo: (nome: string) => page.elementLocator(document.querySelector(`[name="${nome}"]`)!),
      trocarPara: async (pedaco: string) => {
        await userEvent.clear(tela.getByRole("combobox", { name: "Tipo" }));
        await userEvent.type(tela.getByRole("combobox", { name: "Tipo" }), pedaco);
      },
    };
  }

  test("do conjunto para só a tampa, nada da bombona fica", async () => {
    const { tela, campo, trocarPara } = await abrirCom(CONJUNTO);

    await trocarPara("tampa");
    await tela.getByRole("option", { name: "Tampa", exact: true }).click();

    await expect.element(campo("complemento")).toHaveValue("");
    await expect.element(campo("diametroMm")).toHaveValue("");
    await expect.element(campo("precoAvulso")).toHaveValue("");
    await expect.element(tela.getByRole("combobox", { name: "Material" })).toHaveValue("");
    await expect.element(campo("descricao")).toHaveValue("Tampa");
  });

  test("a origem fica: indústria e códigos não dependem do tipo", async () => {
    const { tela, campo, trocarPara } = await abrirCom(CONJUNTO);

    await trocarPara("tampa");
    await tela.getByRole("option", { name: "Tampa", exact: true }).click();

    await expect.element(tela.getByRole("combobox", { name: "Indústria" })).toHaveValue("ALFAPLAST");
    await expect.element(campo("codigoFornecedor")).toHaveValue("COD-1");
  });

  test("voltar ao saco traz de novo o fator da indústria", async () => {
    const { tela, campo, trocarPara } = await abrirCom(CONJUNTO);

    await trocarPara("saco");
    await tela.getByRole("option", { name: "Saco plástico" }).click();

    await expect.element(campo("fatorKg")).toHaveValue("14,50");
  });

  test("stretch e shrink são o mesmo produto: o que foi digitado fica", async () => {
    const { tela, campo, trocarPara } = await abrirCom({
      ...VALORES_VAZIOS,
      fornecedorId: "f1",
      familia: "STRETCH",
      material: "FILME STRETCH",
      complemento: "BOBINA 4KG",
      precoKg: "14,00",
    });

    await trocarPara("shrink");
    await tela.getByRole("option", { name: "Shrink" }).click();

    await expect.element(campo("complemento")).toHaveValue("BOBINA 4KG");
    await expect.element(campo("precoKg")).toHaveValue("14,00");
  });
});
