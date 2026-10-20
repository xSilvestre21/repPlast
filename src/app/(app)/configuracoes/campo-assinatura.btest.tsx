/**
 * Testes de navegador da caixa de assinatura e do vídeo de ajuda.
 *
 * O que se protege:
 *   - colar a assinatura copiada do Gmail mantém a formatação (logo, negrito,
 *     link) e ela segue no formulário pelo campo `assinatura` — já sem o que
 *     roda código;
 *   - o logo que não veio na cópia (`blob:` do Outlook) é avisado na hora;
 *   - "Remover assinatura" esvazia;
 *   - o vídeo de "Ver como fazer" abre numa janela.
 *
 * Colar e `contentEditable` só existem num navegador de verdade.
 *
 * Rode com:  npm run test:navegador
 */

import { describe, expect, test } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { PreviaAssinatura } from "@/components/previa-assinatura";
import { VideoAjuda } from "@/components/video-ajuda";

import { CampoAssinatura } from "./campo-assinatura";

async function abrir(inicial = "") {
  const tela = await render(
    <form>
      <CampoAssinatura inicial={inicial} />
    </form>,
  );
  const caixa = tela.container.querySelector<HTMLDivElement>("[contenteditable]")!;
  const campo = tela.container.querySelector<HTMLInputElement>('input[name="assinatura"]')!;
  return { caixa, campo };
}

/** Uma colagem como a do Ctrl+V, com o HTML da área de transferência. */
function colar(caixa: HTMLElement, html: string) {
  caixa.focus();
  const dados = new DataTransfer();
  dados.setData("text/html", html);
  dados.setData("text/plain", "texto");
  caixa.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dados, bubbles: true, cancelable: true }));
}

describe("caixa da assinatura", () => {
  test("a colagem do Gmail entra formatada e segue no formulário, sem script", async () => {
    const { caixa, campo } = await abrir();

    colar(
      caixa,
      '<img src="https://ci3.googleusercontent.com/logo.png"><b onclick="x()">Valquiria</b>' +
        '<script>alert(1)</script><a href="javascript:alert(1)">site</a>',
    );

    await expect.element(page.getByText("Valquiria")).toBeVisible();
    expect(campo.value).toContain('src="https://ci3.googleusercontent.com/logo.png"');
    expect(campo.value).toContain("<b>Valquiria</b>");
    expect(campo.value).not.toMatch(/script|onclick|javascript/);
  });

  test("avisa o logo que não veio na cópia", async () => {
    const { caixa } = await abrir();

    colar(caixa, '<img src="blob:https://outlook.live.com/abc">Val');

    await expect.element(page.getByText(/A imagem da sua assinatura não veio na cópia/)).toBeVisible();
  });

  test("reabre com a assinatura guardada, e “Remover assinatura” esvazia", async () => {
    const { campo } = await abrir("<p><b>Valquiria</b></p>");

    await expect.element(page.getByText("Valquiria")).toBeVisible();
    await page.getByRole("button", { name: "Remover assinatura" }).click();

    expect(campo.value).toBe("");
    await expect.element(page.getByRole("button", { name: "Remover assinatura" })).not.toBeInTheDocument();
  });
});

describe("prévia e vídeo", () => {
  test("a prévia roda isolada, sem permissão nenhuma", async () => {
    const tela = await render(<PreviaAssinatura html="<b>Val</b>" />);
    const quadro = tela.container.querySelector("iframe")!;
    expect(quadro.getAttribute("sandbox")).toBe("");
    expect(quadro.getAttribute("srcdoc")).toContain("<b>Val</b>");
  });

  test("“Ver como fazer” abre o vídeo numa janela", async () => {
    render(<VideoAjuda src="/ajuda/senha-de-app-gmail.mp4" duracao="1 min" titulo="Como criar a senha de app" />);

    await page.getByRole("button", { name: "Ver como fazer (1 min)" }).click();
    await expect.element(page.getByRole("dialog")).toBeVisible();
    await expect.element(page.getByText("Como criar a senha de app")).toBeVisible();
    expect(document.querySelector("dialog video")?.getAttribute("src")).toBe("/ajuda/senha-de-app-gmail.mp4");
  });
});
