/**
 * Testes de navegador da busca de Comissões.
 *
 * O que se protege:
 *   - digitar o número esconde as outras linhas e o cartão da indústria que
 *     não tem o pedido — e apagar devolve tudo;
 *   - o total da indústria some durante a busca: embaixo de metade das
 *     linhas, pareceria a soma delas;
 *   - nada achado diz isso, com o caminho de volta;
 *   - a linha é escondida, não desmontada: o acerto aberto guarda o que foi
 *     digitado nele enquanto a busca o tira de vista.
 *
 * Rode com:  npm run test:navegador
 */

import { describe, expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";

import { Tabela } from "@/components/ui";

import { type LinhaPedido, LinhaComissao } from "./acerto";
import { chaveDaLinha } from "./busca";
import { BuscaComissao, GrupoDaBusca, LinhaDoTotal, type LinhaDoIndice } from "./busca-comissao";
import { colunasDaComissao } from "./colunas";

const BASE: LinhaPedido = {
  id: "p1",
  numero: 142,
  status: "ENVIADO",
  motivoCancelamento: "",
  apelidoCliente: "ORION",
  prazoEntrega: "2026-10-15",
  entregueEm: null,
  base: "1000",
  percentual: "5",
  previsto: 50,
  valorRecebido: "",
  percentualRecebido: "",
  recebido: null,
  preposto: null,
  corPreposto: null,
  percentualPreposto: null,
  rateio: null,
  rateioRecebido: null,
  podeAcertar: true,
  parcela: null,
  venda: "1000",
  prazoPagamento: null,
  dataBaseParcelas: "2026-10-15",
  fechamento: "",
  dataCompetencia: "2026-10-15",
  parcelasAtuais: [],
  podeParcelar: true,
  parcelarExigeDesfazerAcerto: false,
  atraso: { naoPaga: false, para: null },
  mesNatural: "2026-10",
  mesDaTela: "2026-10",
  hoje: "2026-10",
  lugar: "no-mes",
  industria: null,
};

const NADA = async () => ({});

/** Duas indústrias: a ERIPACK com três linhas (uma é o #300 parcelado em dois), a VEGA com uma. */
const GRUPOS: { id: string; nome: string; linhas: LinhaPedido[] }[] = [
  {
    id: "eri",
    nome: "ERIPACK",
    linhas: [
      BASE,
      {
        ...BASE,
        id: "p2",
        numero: 300,
        apelidoCliente: "Panificadora Conceição",
        parcela: { numero: 1, total: 2, vencimento: "2026-10-20", recebimento: "2026-10" },
      },
      {
        ...BASE,
        id: "p2",
        numero: 300,
        apelidoCliente: "Panificadora Conceição",
        parcela: { numero: 2, total: 2, vencimento: "2026-10-27", recebimento: "2026-10" },
      },
    ],
  },
  { id: "vega", nome: "VEGAPACK", linhas: [{ ...BASE, id: "p3", numero: 77, apelidoCliente: "TITANPET" }] },
];

const INDICE: LinhaDoIndice[] = GRUPOS.flatMap((g) =>
  g.linhas.map((l) => ({
    chave: chaveDaLinha(l.id, l.parcela?.numero ?? null),
    pedidoId: l.id,
    fornecedorId: g.id,
    numero: l.numero,
    cliente: l.apelidoCliente,
    preposto: l.preposto,
  })),
);

async function abrir() {
  const tela = await render(
    <BuscaComissao linhas={INDICE} ordem={null} placeholder="Nº do pedido ou cliente" onde="de outubro de 2026">
      {GRUPOS.map((g) => (
        <GrupoDaBusca key={g.id} fornecedorId={g.id}>
          <section aria-label={g.nome}>
            <Tabela
              colunas={colunasDaComissao(true)}
              rodape={
                <LinhaDoTotal>
                  <td>Total da {g.nome}</td>
                </LinhaDoTotal>
              }
            >
              {g.linhas.map((l) => (
                <LinhaComissao
                  key={chaveDaLinha(l.id, l.parcela?.numero ?? null)}
                  pedido={l}
                  comPercentual
                  acoes={{
                    acerto: NADA,
                    entrega: NADA,
                    naoPago: NADA,
                    desmarcarNaoPago: NADA,
                    parcelas: NADA,
                    desfazerParcelas: NADA,
                  }}
                  enderecoDoMes="/comissoes?mes=__MES__"
                />
              ))}
            </Tabela>
          </section>
        </GrupoDaBusca>
      ))}
    </BuscaComissao>,
  );
  return tela.container;
}

/** As `<tr>` do pedido `#numero` — uma por linha (duas no parcelado). */
function linhasDo(container: HTMLElement, numero: number): HTMLTableRowElement[] {
  return [...container.querySelectorAll("a")]
    .filter((a) => a.textContent === `#${numero}`)
    .map((a) => a.closest("tr")!);
}

const visivel = (el: Element | null) => el !== null && (el as HTMLElement).offsetParent !== null;

function buscar(texto: string) {
  return userEvent.fill(page.getByRole("searchbox", { name: "Buscar" }), texto);
}

describe("busca de Comissões", () => {
  test("o número acha o pedido e esconde o resto — inclusive a indústria que não o tem", async () => {
    const container = await abrir();

    await buscar("#142");

    await expect.poll(() => linhasDo(container, 142).every(visivel)).toBe(true);
    expect(linhasDo(container, 300).some(visivel)).toBe(false);
    // O cartão da VEGAPACK inteiro, não só a linha dele.
    expect(visivel(container.querySelector('section[aria-label="VEGAPACK"]'))).toBe(false);
    await expect.element(page.getByText("1 pedido encontrado")).toBeVisible();

    // Um pedaço do número basta: "14" já acha o #142.
    await buscar("14");
    await expect.poll(() => linhasDo(container, 142).every(visivel)).toBe(true);
    expect(linhasDo(container, 300).some(visivel)).toBe(false);

    // Apagar devolve tudo.
    await buscar("");
    await expect.poll(() => linhasDo(container, 77).every(visivel)).toBe(true);
    expect(linhasDo(container, 300).every(visivel)).toBe(true);
  });

  test("o cliente casa sem acento, e as duas parcelas contam um pedido", async () => {
    const container = await abrir();

    await buscar("conceicao");

    await expect.poll(() => linhasDo(container, 300).filter(visivel).length).toBe(2);
    expect(linhasDo(container, 142).some(visivel)).toBe(false);
    await expect.element(page.getByText("1 pedido encontrado")).toBeVisible();
  });

  test("o total da indústria some durante a busca e volta depois", async () => {
    const container = await abrir();
    const total = () => [...container.querySelectorAll("td")].find((td) => td.textContent === "Total da ERIPACK")!;
    expect(visivel(total())).toBe(true);

    await buscar("orion");
    await expect.poll(() => visivel(total())).toBe(false);

    await buscar("");
    await expect.poll(() => visivel(total())).toBe(true);
  });

  test("nada achado diz isso, e Limpar busca devolve as tabelas", async () => {
    const container = await abrir();

    await buscar("9999");

    await expect.element(page.getByText("Nada encontrado")).toBeVisible();
    await expect.element(page.getByText(/Nenhum pedido de outubro de 2026 com “9999”/)).toBeVisible();
    expect(visivel(container.querySelector('section[aria-label="ERIPACK"]'))).toBe(false);

    await page.getByRole("button", { name: "Limpar busca" }).click();

    await expect.element(page.getByRole("searchbox", { name: "Buscar" })).toHaveValue("");
    await expect.poll(() => linhasDo(container, 142).every(visivel)).toBe(true);
    await expect.element(page.getByText("Nada encontrado")).not.toBeInTheDocument();
  });

  test("o acerto aberto guarda o que foi digitado enquanto a busca o esconde", async () => {
    const container = await abrir();

    // Abre o acerto do #77 e digita o valor recebido.
    const linha77 = linhasDo(container, 77)[0];
    (linha77.querySelector("button") as HTMLButtonElement).click();
    const painel = linha77.nextElementSibling as HTMLTableRowElement;
    // O painel só é montado quando a linha abre pela primeira vez.
    await expect.poll(() => painel.querySelector('input[name="valorRecebido"]')).not.toBeNull();
    const campo = painel.querySelector<HTMLInputElement>('input[name="valorRecebido"]')!;
    await expect.poll(() => visivel(campo)).toBe(true);
    await userEvent.fill(campo, "12345");
    const digitado = campo.value;
    expect(digitado).not.toBe("");

    await buscar("142");
    await expect.poll(() => visivel(linha77) || visivel(painel)).toBe(false);

    await buscar("");
    await expect.poll(() => visivel(campo)).toBe(true);
    // O mesmo nó, com o mesmo valor: a linha não foi desmontada.
    expect(painel.isConnected).toBe(true);
    expect(campo.value).toBe(digitado);
  });
});
