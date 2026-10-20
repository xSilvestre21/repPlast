import "server-only";

import sanitizeHtml from "sanitize-html";

import { ErroDeCampo } from "@/lib/erro-formulario";

/**
 * A assinatura do e-mail — a que a pessoa já usa no Gmail ou no Outlook.
 *
 * Pela senha de app o sistema só ENVIA (SMTP): não há como ler a assinatura
 * configurada lá. Então ela é copiada da página do Gmail e colada em
 * Configurações, e o que chega é o HTML da área de transferência — que pode
 * trazer de tudo, inclusive `<script>` e `onclick` de quem colou de um site.
 *
 * Aqui ele passa por uma lista FECHADA (sanitize-html): sobra o que uma
 * assinatura usa — tabela de layout, texto formatado, link e imagem — e sai o
 * resto. É esse HTML limpo que se grava, se mostra na prévia e se envia.
 */

/** Acima disso é quase sempre um logo enorme embutido, que pesa em todo e-mail. */
const LIMITE_BYTES = 500_000;

/**
 * Valor de estilo sem `url(` nem `expression(`: cor, fonte e espaçamento
 * passam; imagem de fundo e o truque antigo do Internet Explorer, não.
 */
const VALOR_SEGURO = /^(?!.*\b(url|expression)\s*\()[^;<>{}]*$/i;

const ESTILOS = Object.fromEntries(
  [
    "color",
    "background-color",
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "text-decoration",
    "text-align",
    "vertical-align",
    "line-height",
    "letter-spacing",
    "white-space",
    "margin",
    "margin-top",
    "margin-right",
    "margin-bottom",
    "margin-left",
    "padding",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "border",
    "border-top",
    "border-right",
    "border-bottom",
    "border-left",
    "border-collapse",
    "border-radius",
    "width",
    "max-width",
    "height",
    "display",
  ].map((propriedade) => [propriedade, [VALOR_SEGURO]]),
);

/** Imagem embutida só dos formatos que todo leitor de e-mail mostra. */
const IMAGEM_EMBUTIDA = /^data:image\/(png|jpe?g|gif);base64,/i;

const OPCOES: sanitizeHtml.IOptions = {
  allowedTags: [
    "table",
    "tbody",
    "thead",
    "tr",
    "td",
    "th",
    "div",
    "p",
    "span",
    "br",
    "hr",
    "a",
    "img",
    "b",
    "strong",
    "i",
    "em",
    "u",
    "font",
    "small",
  ],
  allowedAttributes: {
    "*": ["style", "width", "height", "align", "valign"],
    a: ["href"],
    img: ["src", "alt"],
    td: ["colspan", "rowspan", "bgcolor"],
    th: ["colspan", "rowspan", "bgcolor"],
    table: ["cellpadding", "cellspacing", "border", "bgcolor"],
    font: ["color", "face", "size"],
  },
  allowedStyles: { "*": ESTILOS },
  allowedSchemes: ["http", "https", "mailto", "tel"],
  // `data:` só na imagem — e o filtro abaixo ainda confere o formato.
  allowedSchemesByTag: { img: ["https", "data"] },
  allowProtocolRelative: false,
  // Sem endereço que preste, a imagem sai inteira, em vez de virar `<img>` vazio.
  exclusiveFilter: (frame) =>
    frame.tag === "img" &&
    (!frame.attribs.src || (frame.attribs.src.startsWith("data:") && !IMAGEM_EMBUTIDA.test(frame.attribs.src))),
};

const contarImagens = (html: string) => (html.match(/<img\b/gi) ?? []).length;

/**
 * A assinatura colada, limpa e pronta para gravar — ou `null` quando não
 * sobrou nada (a pessoa apagou tudo, que é o "remover assinatura").
 *
 * `imagensPerdidas` diz quantas imagens da cópia não vieram: o Outlook às
 * vezes cola o logo como um endereço que só existe no computador dele
 * (`blob:`), e a tela avisa para enviar o arquivo da imagem.
 */
export function limparAssinatura(colada: string): { html: string | null; imagensPerdidas: number } {
  const html = sanitizeHtml(colada, OPCOES).trim();
  const imagensPerdidas = Math.max(0, contarImagens(colada) - contarImagens(html));

  const temTexto = textoDaAssinatura(html) !== "";
  if (!temTexto && contarImagens(html) === 0) return { html: null, imagensPerdidas };

  if (Buffer.byteLength(html) > LIMITE_BYTES) {
    throw new ErroDeCampo(
      "assinatura",
      "A assinatura ficou grande demais para ir em todo e-mail — quase sempre é a imagem do logo. " +
        "Use uma imagem menor (até uns 200 KB) em “Adicionar imagem”.",
    );
  }

  return { html, imagensPerdidas };
}

const ENTIDADES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&nbsp;": " ",
};

/**
 * A assinatura em texto puro: a parte `text` do e-mail, para quem lê sem HTML.
 * Cada bloco (parágrafo, linha de tabela, `<br>`) vira uma linha.
 */
export function textoDaAssinatura(html: string): string {
  const comQuebras = html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|table)>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " ");

  const texto = sanitizeHtml(comQuebras, { allowedTags: [], allowedAttributes: {} }).replace(
    /&(amp|lt|gt|quot|#39|nbsp);/g,
    (entidade) => ENTIDADES[entidade],
  );

  return texto
    .split("\n")
    .map((linha) => linha.replace(/\s+/g, " ").trim())
    .filter((linha) => linha !== "")
    .join("\n");
}

function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * O e-mail em HTML: a mensagem digitada, como ela é (escapada, com as quebras
 * de linha), e a assinatura embaixo. A mensagem continua sendo texto — quem
 * escreve "<" no e-mail vê "<", não uma tag.
 */
export function emailHtml(corpo: string, assinatura: string): string {
  const mensagem = escapar(corpo).replace(/\r?\n/g, "<br>\n");
  return (
    '<!doctype html><html><body style="margin:0">' +
    `<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222">${mensagem}</div>` +
    `<br><div>${assinatura}</div>` +
    "</body></html>"
  );
}

/**
 * O corpo do e-mail como ele sai: só texto quando não há assinatura (como
 * sempre foi), ou texto e HTML com ela embaixo.
 */
export function corpoDoEmail(
  corpo: string,
  assinatura: string | null,
): { texto: string; html?: string } {
  if (!assinatura) return { texto: corpo };
  return { texto: emailTexto(corpo, assinatura), html: emailHtml(corpo, assinatura) };
}

/** A versão em texto do e-mail com assinatura: separada pelo "-- " de praxe. */
export function emailTexto(corpo: string, assinatura: string): string {
  const texto = textoDaAssinatura(assinatura);
  return texto ? `${corpo.trimEnd()}\n\n-- \n${texto}` : corpo;
}
