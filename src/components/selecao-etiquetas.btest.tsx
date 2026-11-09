/**
 * Testes de navegador da escolha por etiquetas.
 *
 * O que se protege: a lista fica guardada, mostrando só um grupo por vez; o que foi
 * marcado continua à vista; e o Enter daqui nunca salva o formulário.
 *
 * Rode com:  npm run test:navegador
 */

import { useState } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { render } from "vitest-browser-react";

import { type GrupoEtiquetas, SelecaoEtiquetas } from "./selecao-etiquetas";

const GRUPOS: GrupoEtiquetas[] = [
  {
    titulo: "Formato",
    umaSo: true,
    opcoes: ["Oval", "Quadrado"].map((o) => ({ id: o, rotulo: o })),
  },
  {
    titulo: "Extras",
    opcoes: ["C/ Alça", "Hotfill"].map((o) => ({ id: o, rotulo: o })),
  },
  {
    titulo: "Cor",
    umaSo: true,
    opcoes: ["Azul", "Branco"].map((o) => ({ id: o, rotulo: o })),
  },
];

function Exemplo({
  grupos = GRUPOS,
  livre = true,
  aoEnviar,
}: {
  grupos?: GrupoEtiquetas[];
  livre?: boolean;
  aoEnviar?: () => void;
}) {
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [digitado, setDigitado] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        aoEnviar?.();
      }}
    >
      <SelecaoEtiquetas
        rotulo="Complemento"
        grupos={grupos}
        marcadas={new Set(marcadas)}
        aoAlternar={(id) =>
          setMarcadas((atual) =>
            atual.includes(id) ? atual.filter((m) => m !== id) : [...atual, id],
          )
        }
        digitado={digitado}
        aoDigitar={livre ? setDigitado : undefined}
      />
    </form>
  );
}

describe("a lista fica guardada", () => {
  test("no começo aparecem só os grupos", async () => {
    const tela = await render(<Exemplo />);

    await expect.element(tela.getByRole("button", { name: "Formato" })).toBeVisible();
    await expect.element(tela.getByRole("button", { name: "Oval" })).not.toBeInTheDocument();
  });

  test("abre um grupo por vez", async () => {
    const tela = await render(<Exemplo />);

    await tela.getByRole("button", { name: "Formato" }).click();
    await expect.element(tela.getByRole("button", { name: "Oval" })).toBeVisible();
    await expect
      .element(tela.getByRole("button", { name: "Formato" }))
      .toHaveAttribute("aria-expanded", "true");

    await tela.getByRole("button", { name: "Cor" }).click();
    await expect.element(tela.getByRole("button", { name: "Azul" })).toBeVisible();
    await expect.element(tela.getByRole("button", { name: "Oval" })).not.toBeInTheDocument();
  });

  test("no grupo de uma opção só, marcar fecha o grupo", async () => {
    const tela = await render(<Exemplo />);

    await tela.getByRole("button", { name: "Formato" }).click();
    await tela.getByRole("button", { name: "Oval" }).click();

    await expect.element(tela.getByRole("button", { name: "Tirar Oval" })).toBeVisible();
    await expect.element(tela.getByRole("button", { name: "Quadrado" })).not.toBeInTheDocument();
  });

  test("no grupo de várias, continua aberto", async () => {
    const tela = await render(<Exemplo />);

    await tela.getByRole("button", { name: "Extras" }).click();
    await tela.getByRole("button", { name: "C/ Alça" }).click();
    await tela.getByRole("button", { name: "Hotfill" }).click();

    await expect
      .element(tela.getByRole("button", { name: "Hotfill" }))
      .toHaveAttribute("aria-pressed", "true");
    await expect.element(tela.getByRole("button", { name: "Tirar C/ Alça" })).toBeVisible();
  });
});

describe("digitar", () => {
  test("acha em todos os grupos, sem abrir nenhum", async () => {
    const tela = await render(<Exemplo />);

    await userEvent.type(tela.getByRole("searchbox"), "branc");

    await expect.element(tela.getByRole("button", { name: "Branco" })).toBeVisible();
    await expect.element(tela.getByRole("button", { name: "Formato" })).not.toBeInTheDocument();
  });

  test("Enter marca a primeira, limpa a busca e não envia o formulário", async () => {
    const aoEnviar = vi.fn();
    const tela = await render(<Exemplo aoEnviar={aoEnviar} />);

    await userEvent.type(tela.getByRole("searchbox"), "oval{Enter}");

    await expect.element(tela.getByRole("button", { name: "Tirar Oval" })).toBeVisible();
    await expect.element(tela.getByRole("searchbox")).toHaveValue("");
    expect(aoEnviar).not.toHaveBeenCalled();
  });

  test("Enter com a busca vazia também não envia", async () => {
    const aoEnviar = vi.fn();
    const tela = await render(<Exemplo aoEnviar={aoEnviar} />);

    await userEvent.type(tela.getByRole("searchbox"), "{Enter}");

    expect(aoEnviar).not.toHaveBeenCalled();
  });

  test("o que a lista não tem entra como foi digitado", async () => {
    const tela = await render(<Exemplo />);

    await userEvent.type(tela.getByRole("searchbox"), "Fosco");
    await tela.getByRole("button", { name: /Usar .Fosco./ }).click();

    await expect.element(tela.getByRole("button", { name: "Tirar Fosco" })).toBeVisible();
  });

  test("sem texto livre, diz que não achou", async () => {
    const tela = await render(<Exemplo livre={false} />);

    await userEvent.type(tela.getByRole("searchbox"), "Fosco{Enter}");

    await expect.element(tela.getByText(/Nada com/)).toBeVisible();
  });

  test("Backspace na caixa vazia tira a última", async () => {
    const tela = await render(<Exemplo />);

    await userEvent.type(tela.getByRole("searchbox"), "oval{Enter}azul{Enter}{Backspace}");

    await expect.element(tela.getByRole("button", { name: "Tirar Oval" })).toBeVisible();
    await expect.element(tela.getByRole("button", { name: "Tirar Azul" })).not.toBeInTheDocument();
  });

  test("Esc limpa a busca e os grupos voltam", async () => {
    const tela = await render(<Exemplo />);

    await userEvent.type(tela.getByRole("searchbox"), "oval{Escape}");

    await expect.element(tela.getByRole("searchbox")).toHaveValue("");
    await expect.element(tela.getByRole("button", { name: "Formato" })).toBeVisible();
  });
});

describe("poucas opções", () => {
  const POUCAS = [
    { titulo: "Ver todos (2)", opcoes: [{ id: "a", rotulo: "Deslizante", detalhe: "+R$ 2,10/kg" }] },
  ];

  test("cabem na tela: sem busca e sem grupo a abrir", async () => {
    const tela = await render(<Exemplo grupos={POUCAS} livre={false} />);

    await expect.element(tela.getByRole("button", { name: /Deslizante/ })).toBeVisible();
    await expect.element(tela.getByRole("searchbox")).not.toBeInTheDocument();
  });

  test("com muitas, a lista vai para trás do Ver todos", async () => {
    const MUITAS = [
      {
        titulo: "Ver todos (8)",
        opcoes: Array.from({ length: 8 }, (_, i) => ({ id: `a${i}`, rotulo: `Aditivo ${i}` })),
      },
    ];
    const tela = await render(<Exemplo grupos={MUITAS} livre={false} />);

    await expect.element(tela.getByRole("button", { name: "Aditivo 1" })).not.toBeInTheDocument();

    await tela.getByRole("button", { name: "Ver todos (8)" }).click();

    await expect.element(tela.getByRole("button", { name: "Aditivo 1" })).toBeVisible();
  });
});

/** Os aditivos de uma indústria grande: um grupo só, sem texto livre. */
const LONGA: GrupoEtiquetas[] = [
  {
    titulo: "Ver todos (30)",
    opcoes: Array.from({ length: 30 }, (_, i) => ({
      id: `a${i}`,
      rotulo: i === 17 ? "Deslizante" : `Aditivo ${i}`,
      busca: i === 23 ? "C/ ANTIESTATICO" : undefined,
    })),
  },
];

describe("no celular", () => {
  afterEach(async () => {
    await page.viewport(1280, 720);
  });

  const abrirNoCelular = async () => {
    await page.viewport(390, 844);
    return render(<Exemplo />);
  };

  test("o grupo sobe numa folha, em vez de abrir embaixo dos nomes", async () => {
    const tela = await abrirNoCelular();

    await tela.getByRole("button", { name: "Formato" }).click();

    const folha = tela.getByRole("dialog", { name: "Formato" });
    await expect.element(folha).toBeVisible();
    await expect.element(folha.getByRole("button", { name: "Oval" })).toBeVisible();
  });

  test("as opções ficam na parte de baixo da tela, ao alcance do polegar", async () => {
    const tela = await abrirNoCelular();

    await tela.getByRole("button", { name: "Formato" }).click();

    const opcao = tela.getByRole("dialog", { name: "Formato" }).getByRole("button", { name: "Oval" });
    await expect.element(opcao).toBeVisible();
    await expect
      .poll(() => (opcao.element() as HTMLElement).getBoundingClientRect().top)
      .toBeGreaterThan(844 / 2);
    expect((opcao.element() as HTMLElement).getBoundingClientRect().height).toBeGreaterThanOrEqual(44);
  });

  test("no grupo de uma opção só, marcar fecha a folha", async () => {
    const tela = await abrirNoCelular();

    await tela.getByRole("button", { name: "Formato" }).click();
    await tela.getByRole("dialog", { name: "Formato" }).getByRole("button", { name: "Oval" }).click();

    await expect.element(tela.getByRole("dialog")).not.toBeInTheDocument();
    await expect.element(tela.getByRole("button", { name: "Tirar Oval" })).toBeVisible();
  });

  test("no grupo de várias, a folha fica aberta e fecha no X, como as outras", async () => {
    const tela = await abrirNoCelular();

    await tela.getByRole("button", { name: "Extras" }).click();
    const folha = tela.getByRole("dialog", { name: "Extras" });
    await folha.getByRole("button", { name: "C/ Alça" }).click();
    await folha.getByRole("button", { name: "Hotfill" }).click();

    await expect
      .element(folha.getByRole("button", { name: "Hotfill" }))
      .toHaveAttribute("aria-pressed", "true");

    await folha.getByRole("button", { name: "Fechar" }).click();

    await expect.element(tela.getByRole("dialog")).not.toBeInTheDocument();
    await expect.element(tela.getByRole("button", { name: "Tirar Hotfill" })).toBeVisible();
  });

  test("nenhuma folha tem Pronto, nem a de marcar várias", async () => {
    const tela = await abrirNoCelular();

    for (const grupo of ["Formato", "Extras", "Cor"]) {
      await tela.getByRole("button", { name: grupo, exact: true }).click();
      const folha = tela.getByRole("dialog", { name: grupo });
      await expect.element(folha).toBeVisible();
      await expect.element(folha.getByRole("button", { name: "Pronto" })).not.toBeInTheDocument();
      await folha.getByRole("button", { name: "Fechar" }).click();
      await expect.element(tela.getByRole("dialog")).not.toBeInTheDocument();
    }
  });

  test("com vários grupos, a folha não tem busca: a caixa já busca em todos", async () => {
    const tela = await abrirNoCelular();

    await expect.element(tela.getByRole("searchbox")).toBeVisible();
    await tela.getByRole("button", { name: "Formato" }).click();

    const folha = tela.getByRole("dialog", { name: "Formato" });
    await expect.element(folha).toBeVisible();
    await expect.element(folha.getByRole("searchbox")).not.toBeInTheDocument();
  });

  test("com um grupo só, a folha leva o nome do campo", async () => {
    await page.viewport(390, 844);
    const tela = await render(<Exemplo grupos={LONGA} livre={false} />);

    await tela.getByRole("button", { name: "Ver todos (30)" }).click();

    await expect.element(tela.getByRole("dialog", { name: "Complemento" })).toBeVisible();
  });

  test("marcar na folha não envia o formulário", async () => {
    await page.viewport(390, 844);
    const aoEnviar = vi.fn();
    const tela = await render(<Exemplo aoEnviar={aoEnviar} />);

    await tela.getByRole("button", { name: "Extras" }).click();
    await tela.getByRole("dialog", { name: "Extras" }).getByRole("button", { name: "Hotfill" }).click();

    expect(aoEnviar).not.toHaveBeenCalled();
  });
});

describe("no celular, a lista de um grupo só mora na folha", () => {
  afterEach(async () => {
    await page.viewport(1280, 720);
  });

  const abrirAditivos = async (aoEnviar?: () => void) => {
    await page.viewport(390, 844);
    const tela = await render(<Exemplo grupos={LONGA} livre={false} aoEnviar={aoEnviar} />);
    await tela.getByRole("button", { name: "Ver todos (30)" }).click();
    return { tela, folha: tela.getByRole("dialog", { name: "Complemento" }) };
  };

  test("a caixa não busca: a busca está na folha", async () => {
    await page.viewport(390, 844);
    const tela = await render(<Exemplo grupos={LONGA} livre={false} />);

    await expect.element(tela.getByRole("button", { name: "Ver todos (30)" })).toBeVisible();
    await expect.element(tela.getByRole("searchbox")).not.toBeInTheDocument();

    await tela.getByRole("button", { name: "Ver todos (30)" }).click();

    const folha = tela.getByRole("dialog", { name: "Complemento" });
    await expect.element(folha.getByRole("searchbox")).toBeVisible();
    await expect.element(folha.getByRole("button", { name: "Pronto" })).not.toBeInTheDocument();
  });

  test("abrir a folha não sobe o teclado", async () => {
    const { folha } = await abrirAditivos();

    await expect.element(folha.getByRole("searchbox")).toBeVisible();
    expect(document.activeElement).not.toBe(folha.getByRole("searchbox").element());
  });

  test("digitar filtra a lista, pelo nome e pelo sufixo", async () => {
    const { folha } = await abrirAditivos();

    await userEvent.type(folha.getByRole("searchbox"), "desliz");

    await expect.element(folha.getByRole("button", { name: "Deslizante" })).toBeVisible();
    await expect
      .element(folha.getByRole("button", { name: "Aditivo 1", exact: true }))
      .not.toBeInTheDocument();

    await userEvent.clear(folha.getByRole("searchbox"));
    await userEvent.type(folha.getByRole("searchbox"), "antiestat");

    await expect.element(folha.getByRole("button", { name: "Aditivo 23" })).toBeVisible();
    await expect.element(folha.getByRole("button", { name: "Deslizante" })).not.toBeInTheDocument();
  });

  test("marcar o que achou deixa a folha aberta e a busca como estava", async () => {
    const { tela, folha } = await abrirAditivos();

    await userEvent.type(folha.getByRole("searchbox"), "desliz");
    await folha.getByRole("button", { name: "Deslizante" }).click();

    await expect
      .element(folha.getByRole("button", { name: "Deslizante" }))
      .toHaveAttribute("aria-pressed", "true");
    await expect.element(folha.getByRole("searchbox")).toHaveValue("desliz");

    await folha.getByRole("button", { name: "Fechar" }).click();

    await expect.element(tela.getByRole("button", { name: "Tirar Deslizante" })).toBeVisible();
  });

  test("sem resultado, diz que não achou", async () => {
    const { folha } = await abrirAditivos();

    await userEvent.type(folha.getByRole("searchbox"), "xyz");

    await expect.element(folha.getByText(/Nada com .xyz./)).toBeVisible();
  });

  test("Enter na busca da folha não envia o formulário", async () => {
    const aoEnviar = vi.fn();
    const { folha } = await abrirAditivos(aoEnviar);

    await userEvent.type(folha.getByRole("searchbox"), "desliz{Enter}");

    expect(aoEnviar).not.toHaveBeenCalled();
  });

  test("reabrir a folha começa sem busca", async () => {
    const { tela, folha } = await abrirAditivos();

    await userEvent.type(folha.getByRole("searchbox"), "desliz");
    await folha.getByRole("button", { name: "Fechar" }).click();
    await expect.element(tela.getByRole("dialog")).not.toBeInTheDocument();

    await tela.getByRole("button", { name: "Ver todos (30)" }).click();

    await expect.element(folha.getByRole("searchbox")).toHaveValue("");
    await expect
      .element(folha.getByRole("button", { name: "Aditivo 1", exact: true }))
      .toBeVisible();
  });

  test("rolando a lista até o fim, a busca continua na tela", async () => {
    const { folha } = await abrirAditivos();

    const caixa = folha.getByRole("searchbox");
    await expect.element(caixa).toBeVisible();
    const dialogo = folha.element() as HTMLElement;
    dialogo.scrollTop = dialogo.scrollHeight;

    await expect.poll(() => dialogo.scrollTop).toBeGreaterThan(0);
    const topoDaFolha = dialogo.getBoundingClientRect().top;
    const topoDaCaixa = (caixa.element() as HTMLElement).getBoundingClientRect().top;
    expect(topoDaCaixa).toBeGreaterThanOrEqual(topoDaFolha);
    expect(topoDaCaixa).toBeLessThan(topoDaFolha + 40);
  });

  test("com algo marcado, tocar na caixa abre a folha", async () => {
    const { tela, folha } = await abrirAditivos();

    await folha.getByRole("button", { name: "Deslizante" }).click();
    await folha.getByRole("button", { name: "Fechar" }).click();
    await expect.element(tela.getByRole("dialog")).not.toBeInTheDocument();

    const ficha = tela.getByRole("button", { name: "Tirar Deslizante" }).element();
    (ficha.closest("span")!.parentElement as HTMLElement).click();

    await expect.element(tela.getByRole("dialog", { name: "Complemento" })).toBeVisible();
  });
});

describe("no computador, a lista de um grupo só continua como era", () => {
  test("a caixa busca, e a lista abre ali mesmo, sem folha", async () => {
    const tela = await render(<Exemplo grupos={LONGA} livre={false} />);

    await expect.element(tela.getByRole("searchbox")).toBeVisible();

    await tela.getByRole("button", { name: "Ver todos (30)" }).click();

    await expect.element(tela.getByRole("button", { name: "Deslizante" })).toBeVisible();
    await expect.element(tela.getByRole("dialog")).not.toBeInTheDocument();
  });
});
