/**
 * Testes de navegador do campo de escolha com busca.
 *
 * Rodam num Chromium de verdade porque o que se testa aqui é GEOMETRIA: a lista
 * decide para que lado abrir medindo quanto espaço sobra na janela, e em `node`
 * todo elemento tem altura zero — a medida daria sempre o mesmo número e o
 * teste passaria sem olhar nada.
 *
 * Foi esse buraco que deixou passar o defeito real: a lista abria sempre para
 * baixo, e a linha de lançar item fica no rodapé de uma página longa. Sete
 * produtos no DOM, UM visível na tela. Quem olhava concluía que o cliente só
 * tinha um produto, e nem percebia que dava para digitar.
 *
 * Rode com:  npm run test:navegador
 */

import { expect, test, describe } from "vitest";
import { render } from "vitest-browser-react";

import {
  SelecaoBuscavel,
  type LadoDaLista,
  type OpcaoBuscavel,
} from "./selecao-buscavel";

/** Os sete da AKILAH, que é o caso que deu origem a este arquivo. */
const PRODUTOS: OpcaoBuscavel[] = [
  { id: "1", rotulo: "135x125x0,05 SF 10 CANELA (Caixa)", detalhe: "3840" },
  { id: "2", rotulo: "71x150x0,05 SF 7 PEAD (Potes)", detalhe: "4053" },
  { id: "3", rotulo: "71x150x0,07 SF 7 CANELA Skala", detalhe: "4262" },
  { id: "4", rotulo: "82x160x0,08 SF 12 CANELA", detalhe: "3867" },
  { id: "5", rotulo: "85x160x0,08 SF 12 CANELA", detalhe: "4037" },
  { id: "6", rotulo: "97x125x0,04 SF 8 PEAD", detalhe: "3825" },
  { id: "7", rotulo: "97x175x0,06 SF 15 CANELA" },
];

/**
 * Prende o campo no alto ou no rodapé da janela.
 *
 * `fixed` em vez de empurrar com espaçador: o que importa é onde a caixa está
 * em relação à JANELA, e assim o teste não depende do fluxo do documento nem da
 * margem que o corpo da página tiver.
 */
function Cenario({
  onde,
  opcoes = PRODUTOS,
  lado,
}: {
  onde: "topo" | "rodape";
  opcoes?: OpcaoBuscavel[];
  lado?: LadoDaLista;
}) {
  return (
    <div
      style={{
        position: "fixed",
        left: 24,
        width: 400,
        ...(onde === "topo" ? { top: 24 } : { bottom: 24 }),
      }}
    >
      <SelecaoBuscavel name="produtoId" rotulo="Produto" opcoes={opcoes} lado={lado} />
    </div>
  );
}

/** Abre a lista e devolve os elementos já medidos. */
async function abrir(onde: "topo" | "rodape", opcoes?: OpcaoBuscavel[], lado?: LadoDaLista) {
  const tela = await render(<Cenario onde={onde} opcoes={opcoes} lado={lado} />);
  const campo = tela.getByRole("combobox");

  await campo.click();
  await expect.element(tela.getByRole("listbox")).toBeVisible();

  const caixa = (campo.element() as HTMLInputElement).getBoundingClientRect();
  const lista = tela.getByRole("listbox").element() as HTMLElement;

  return { tela, campo, caixa, lista, listaCaixa: lista.getBoundingClientRect() };
}

/** Uma opção só conta como oferecida se ela couber na tela. */
function opcoesVisiveis(lista: HTMLElement) {
  return [...lista.querySelectorAll("li")].filter((li) => {
    const r = li.getBoundingClientRect();
    return r.top >= 0 && r.bottom <= window.innerHeight && r.height > 0;
  }).length;
}

describe("para que lado a lista abre", () => {
  test("abre para BAIXO quando há espaço embaixo", async () => {
    const { caixa, listaCaixa } = await abrir("topo");

    expect(listaCaixa.top).toBeGreaterThanOrEqual(caixa.bottom);
    expect(listaCaixa.bottom).toBeLessThanOrEqual(window.innerHeight);
  });

  test("flipa para CIMA quando o campo está no rodapé", async () => {
    const { caixa, listaCaixa } = await abrir("rodape");

    // O defeito que este arquivo existe para impedir: aqui a lista nascia
    // abaixo da caixa, ou seja, para fora da janela.
    expect(listaCaixa.bottom).toBeLessThanOrEqual(caixa.top);
    expect(listaCaixa.top).toBeGreaterThanOrEqual(0);
  });

  test("no rodapé, TODAS as opções ficam visíveis na tela", async () => {
    const { lista } = await abrir("rodape");

    // É esta a conta que o usuário fazia com o olho: sete produtos existiam e
    // ele via um. Contar o que está no DOM não pegaria a regressão.
    expect(lista.querySelectorAll("li")).toHaveLength(PRODUTOS.length);
    expect(opcoesVisiveis(lista)).toBe(PRODUTOS.length);
  });

  test("a lista nunca ultrapassa a janela, nem com lista longa", async () => {
    const muitas = Array.from({ length: 80 }, (_, i) => ({
      id: String(i),
      rotulo: `Produto ${i}`,
    }));

    const { listaCaixa } = await abrir("rodape", muitas);

    // Não cabem 80; o que não pode é vazar. O resto rola por dentro.
    expect(listaCaixa.top).toBeGreaterThanOrEqual(0);
    expect(listaCaixa.bottom).toBeLessThanOrEqual(window.innerHeight);
  });
});

describe("lado fixo", () => {
  test("`lado=cima` sobe mesmo com espaço de sobra embaixo", async () => {
    const { caixa, listaCaixa } = await abrir("topo", PRODUTOS, "cima");

    // É a linha de lançar item: embaixo dela nunca há espaço, e deixar a
    // medida decidir faria o campo trocar de lado conforme a rolagem.
    expect(listaCaixa.bottom).toBeLessThanOrEqual(caixa.top);
  });

  test("`lado=baixo` desce mesmo colado no rodapé", async () => {
    const { caixa, listaCaixa } = await abrir("rodape", PRODUTOS, "baixo");

    expect(listaCaixa.top).toBeGreaterThanOrEqual(caixa.bottom);
  });

  test("o recálculo da rolagem respeita o lado fixo", async () => {
    /*
     * No TOPO de propósito: é onde o automático escolheria descer. Se o
     * recalculador que escuta rolagem e redimensionamento esquecesse o lado
     * declarado, a lista viraria para baixo no primeiro evento — que é
     * exatamente a incoerência que o lado fixo existe para acabar.
     */
    const { tela, campo, listaCaixa } = await abrir("topo", PRODUTOS, "cima");
    const caixa = (campo.element() as HTMLInputElement).getBoundingClientRect();

    expect(listaCaixa.bottom).toBeLessThanOrEqual(caixa.top);

    window.dispatchEvent(new Event("scroll"));
    window.dispatchEvent(new Event("resize"));

    await expect
      .poll(() => tela.getByRole("listbox").element().getBoundingClientRect().bottom)
      .toBeLessThanOrEqual(caixa.top);
  });
});

describe("digitar para filtrar", () => {
  test("filtra por um pedaço no meio da descrição", async () => {
    const { tela, lista } = await abrir("rodape");

    await tela.getByRole("combobox").fill("canela");

    await expect.poll(() => lista.querySelectorAll("li").length).toBe(5);
  });

  test("filtra pelo código da indústria", async () => {
    const { tela, lista } = await abrir("rodape");

    await tela.getByRole("combobox").fill("4053");

    await expect.poll(() => lista.querySelectorAll("li").length).toBe(1);
    expect(lista.textContent).toContain("71x150x0,05 SF 7 PEAD (Potes)");
  });

  test("ignora acento e caixa", async () => {
    const { tela, lista } = await abrir("rodape", [
      { id: "a", rotulo: "CASTRO & MACHI", detalhe: "Santa Barbara D'Oeste/SP" },
      { id: "b", rotulo: "FRASCO LIFE", detalhe: "Santa Bárbara D'Oeste/SP" },
      { id: "c", rotulo: "TRIEX", detalhe: "Sertãozinho/SP" },
    ]);

    await tela.getByRole("combobox").fill("barbara");

    // "Bárbara" com acento tem de casar com "barbara" sem — ninguém procura
    // cliente com o acento certo.
    await expect.poll(() => lista.querySelectorAll("li").length).toBe(2);
  });

  test("filtrar continua cabendo na tela", async () => {
    const { tela, lista } = await abrir("rodape");

    await tela.getByRole("combobox").fill("canela");
    await expect.poll(() => lista.querySelectorAll("li").length).toBe(5);

    expect(opcoesVisiveis(lista)).toBe(5);
  });

  test("diz que não achou em vez de mostrar lista vazia", async () => {
    const { tela, lista } = await abrir("rodape");

    await tela.getByRole("combobox").fill("zzz não existe");

    await expect.poll(() => lista.textContent).toContain("Nada encontrado.");
  });
});

describe("o que o formulário recebe", () => {
  test("escolher grava o id no campo escondido, não o rótulo", async () => {
    const { tela } = await abrir("rodape");

    await tela.getByRole("option", { name: /Potes/ }).click();

    const escondido = document.querySelector<HTMLInputElement>('input[name="produtoId"]');
    expect(escondido?.value).toBe("2");
  });

  test("texto solto não escolhe nada", async () => {
    const { tela } = await abrir("rodape");

    await tela.getByRole("combobox").fill("zzz não existe");

    // O formulário não pode sair com um produto que a pessoa nunca escolheu.
    const escondido = document.querySelector<HTMLInputElement>('input[name="produtoId"]');
    expect(escondido?.value).toBe("");
  });
});
