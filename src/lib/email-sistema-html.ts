/**
 * O e-mail do próprio RepPlast — o link de "Esqueceu sua senha?" e o aviso de
 * senha trocada — com a cara do sistema.
 *
 * Reproduz a estrutura do e-mail que o SICOV mandava (`referencia/sicov-email.png`):
 * faixa com a marca no marca-texto amarelo, "Olá, Nome!", o pedido, um botão,
 * as notas pequenas e o rodapé com a marca. É o que diz a quem recebe que o
 * e-mail é do sistema mesmo, e não de alguém imitando — um e-mail de senha em
 * texto puro parece justamente o golpe.
 *
 * As cores são as do tema claro de `globals.css`, escritas por extenso: e-mail
 * não tem variável CSS. E tudo em `<table>` com estilo inline, porque Gmail e
 * Outlook jogam fora `<style>`, flexbox e grid. A fonte do site não chega lá
 * (cai para Arial); por isso a marca vai como imagem — `public/email/repplast-logo.png`,
 * gerada por `scripts/gerar-logo-email.mjs` — e anexada inline pelo `CID_LOGO`.
 *
 * Módulo puro, testável sem servidor: devolve o HTML e o texto puro montados da
 * mesma descrição, para os dois nunca dizerem coisas diferentes.
 */

/** O `cid:` do logo no HTML — o mesmo com que `email-sistema.ts` anexa o arquivo. */
export const CID_LOGO = "logo@repplast";
/** Tamanho de exibição: o PNG tem o dobro, para ficar nítido em tela retina. */
const LOGO = { largura: 141, altura: 38 };

const COR = {
  fundo: "#f4f4f7", // --folha-2
  folha: "#ffffff", // --folha
  faixa: "#111117", // --tinta
  filete: "#e3e3e8", // --filete-forte sobre branco
  tinta: "#111117",
  tinta2: "#5a5a68",
  tinta3: "#6f6f7e",
  subtitulo: "#a3a3b4", // --tinta-2 do tema escuro, legível sobre a faixa
  destaque: "#fcf08f",
  sobreDestaque: "#1a1608",
  carimbo: "#2f6fed",
};

const FONTE = "'Plus Jakarta Sans', Arial, Helvetica, sans-serif";
const SUBTITULO = "Representação comercial de embalagens plásticas";
const RODAPE = "Sistema para representação comercial de embalagens plásticas";

export type EmailDoSistema = {
  /** Vai em negrito no "Olá, Nome!". Sem ele, só "Olá!". */
  nome?: string;
  paragrafos: string[];
  botao?: { rotulo: string; url: string };
  /** As letras miúdas embaixo do botão: validade, "se não foi você". */
  notas?: string[];
};

function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function htmlDoEmail({ nome, paragrafos, botao, notas = [] }: EmailDoSistema): string {
  const saudacao = nome
    ? `Olá, <strong style="color:${COR.tinta};">${escapar(nome)}</strong>!`
    : "Olá!";

  const corpo = paragrafos
    .map(
      (p) =>
        `<p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:${COR.tinta2};">${escapar(p)}</p>`,
    )
    .join("");

  const acao = botao
    ? `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin:28px auto 12px;">
        <tr>
          <td align="center" bgcolor="${COR.faixa}" style="border-radius:999px;">
            <a href="${escapar(botao.url)}" target="_blank"
              style="display:inline-block;padding:13px 30px;border-radius:999px;font-family:${FONTE};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;">
              ${escapar(botao.rotulo)}
            </a>
          </td>
        </tr>
      </table>
      <p style="margin:0 0 24px;text-align:center;font-size:12px;line-height:1.5;color:${COR.tinta3};">
        Se o botão não abrir, copie este endereço no navegador:<br />
        <a href="${escapar(botao.url)}" target="_blank" style="color:${COR.carimbo};word-break:break-all;">${escapar(botao.url)}</a>
      </p>`
    : "";

  const letrasMiudas = notas
    .map(
      (n) => `<p style="margin:0 0 8px;font-size:13px;line-height:1.55;color:${COR.tinta3};">${escapar(n)}</p>`,
    )
    .join("");

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="color-scheme" content="light" />
<title>RepPlast</title>
</head>
<body style="margin:0;padding:0;background:${COR.fundo};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${COR.fundo}" style="background:${COR.fundo};">
  <tr>
    <td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"
        style="max-width:560px;background:${COR.folha};border:1px solid ${COR.filete};border-radius:16px;border-collapse:separate;overflow:hidden;font-family:${FONTE};">
        <tr>
          <td align="center" bgcolor="${COR.faixa}" style="background:${COR.faixa};padding:30px 24px 24px;border-radius:15px 15px 0 0;">
            <img src="cid:${CID_LOGO}" width="${LOGO.largura}" height="${LOGO.altura}" alt="RepPlast"
              style="display:block;margin:0 auto;border:0;outline:none;font-family:${FONTE};font-size:26px;font-weight:800;color:${COR.sobreDestaque};background:${COR.destaque};border-radius:6px;" />
            <p style="margin:12px 0 0;font-size:13px;line-height:1.4;color:${COR.subtitulo};">${SUBTITULO}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 32px 28px;">
            <p style="margin:0 0 18px;font-size:18px;line-height:1.4;color:${COR.tinta};">${saudacao}</p>
            ${corpo}
            ${acao}
            ${letrasMiudas}
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:22px;">
              <tr><td style="border-top:1px solid ${COR.filete};padding-top:18px;text-align:center;font-size:12px;line-height:1.5;color:${COR.tinta3};">
                <span style="background:${COR.destaque};color:${COR.sobreDestaque};font-weight:800;padding:1px 5px;border-radius:4px;">RepPlast</span>
                &mdash; ${RODAPE}
              </td></tr>
            </table>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

function textoDoEmail({ nome, paragrafos, botao, notas = [] }: EmailDoSistema): string {
  const linhas = [nome ? `Olá, ${nome}!` : "Olá!", ""];
  for (const p of paragrafos) linhas.push(p, "");
  if (botao) linhas.push(`${botao.rotulo}:`, botao.url, "");
  for (const n of notas) linhas.push(n);
  if (notas.length > 0) linhas.push("");
  linhas.push("—", `RepPlast — ${RODAPE}`);
  return linhas.join("\n");
}

export function montarEmailSistema(email: EmailDoSistema): { html: string; texto: string } {
  return { html: htmlDoEmail(email), texto: textoDoEmail(email) };
}
