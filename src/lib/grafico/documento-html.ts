import type { DadosDoRelatorio, SecaoBarras, SecaoSerie } from "../pdf/documento-graficos";
import { barrasRanqueadas, serieTemporal } from "./geometria";
import { EXPORTACAO, corExportada } from "./paleta-exportacao";

/**
 * O relatório como um arquivo HTML que abre sozinho.
 *
 * Não reaproveita os componentes da tela, e isso é deliberado: eles se apoiam
 * nas classes que o Tailwind compila, e esse CSS não existe no computador de
 * quem recebeu o arquivo. Um HTML "autocontido" que depende da folha de estilo
 * do aplicativo não é autocontido — abriria sem formatação nenhuma.
 *
 * O que NÃO se repete é o que importa: a lista de seções e os números vêm de
 * `secoesDoRelatorio`, os mesmos que o PDF usa, e as proporções vêm de
 * `geometria.ts`, a mesma que a tela usa. Aqui só o desenho é próprio.
 *
 * Sem script: o arquivo é um retrato de um mês. Um gráfico que se diz
 * interativo mas não alcança o banco só teria os dados que já estão impressos
 * nele — e ainda seria bloqueado por qualquer cliente de e-mail.
 */

const MOEDA = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const moeda = (valor: number) => MOEDA.format(valor);

/**
 * Escapa tudo que veio do banco.
 *
 * Nome de cliente é texto que alguém digitou, e este arquivo vai ser aberto no
 * navegador de outra pessoa: sem escapar, um apelido com `<script>` viraria
 * script no computador dela.
 */
function esc(valor: string | number): string {
  return String(valor)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const ESTILO = `
  *, *::before, *::after { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 32px 20px 56px;
    background: ${EXPORTACAO.papel};
    color: ${EXPORTACAO.tinta};
    font: 400 14px/1.55 "Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    -webkit-font-smoothing: antialiased;
  }
  .folha { max-width: 900px; margin: 0 auto; }
  h1 { font-size: 28px; letter-spacing: -.03em; margin: 0; }
  .sub { color: ${EXPORTACAO.tinta3}; font-size: 13px; margin-top: 6px; }

  .totais {
    display: grid; grid-template-columns: repeat(2, 1fr); gap: 1px;
    background: ${EXPORTACAO.filete}; border: 1px solid ${EXPORTACAO.filete};
    border-radius: 10px; overflow: hidden; margin: 24px 0 8px;
  }
  @media (min-width: 640px) { .totais { grid-template-columns: repeat(4, 1fr); } }
  .total { background: ${EXPORTACAO.folha}; padding: 14px 16px; }
  .total .rot { font-size: 11px; text-transform: uppercase; letter-spacing: .5px; color: ${EXPORTACAO.tinta3}; }
  .total .val { font-size: 22px; font-weight: 700; margin-top: 4px; font-variant-numeric: tabular-nums; }
  .total .det { font-size: 11px; color: ${EXPORTACAO.tinta3}; margin-top: 4px; }

  .cartao {
    background: ${EXPORTACAO.folha}; border: 1px solid ${EXPORTACAO.filete};
    border-radius: 16px; padding: 20px 22px; margin-top: 16px;
  }
  .cartao h2 { font-size: 15px; margin: 0; }
  .cartao .per { font-size: 11px; color: ${EXPORTACAO.tinta3}; margin: 4px 0 16px; }

  /* A linha tem altura fixa e a lista cresce: nada se espreme, nada é cortado. */
  .linha { display: grid; grid-template-columns: minmax(0,1fr) auto; gap: 4px 12px; align-items: center; padding: 3px 0; }
  @media (min-width: 560px) { .linha { grid-template-columns: minmax(6rem,11rem) 1fr auto; } }
  .rot { color: ${EXPORTACAO.tinta2}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
  .rot.residuo { color: ${EXPORTACAO.tinta3}; font-style: italic; }
  .val { font-weight: 500; text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; grid-column: 2; grid-row: 1; }
  @media (min-width: 560px) { .val { grid-column: 3; } }
  .trilho { grid-column: 1 / -1; grid-row: 2; height: 10px; border-radius: 5px; background: ${EXPORTACAO.folha2}; overflow: hidden; }
  @media (min-width: 560px) { .trilho { grid-column: 2; grid-row: 1; } }
  .barra { height: 100%; border-radius: 5px; min-width: 2px; }

  .rodape-secao {
    display: flex; justify-content: space-between; gap: 12px;
    border-top: 1px solid ${EXPORTACAO.filete}; margin-top: 12px; padding-top: 12px;
    font-size: 12px; color: ${EXPORTACAO.tinta3};
  }
  .corpo { color: ${EXPORTACAO.tinta2}; margin: 0; }

  .legenda { display: flex; flex-wrap: wrap; gap: 16px; align-items: center; font-size: 12px; color: ${EXPORTACAO.tinta2}; margin-bottom: 14px; }
  .ponto { width: 10px; height: 10px; border-radius: 50%; display: inline-block; margin-right: 6px; vertical-align: -1px; }
  .eixo { display: flex; justify-content: space-between; font-size: 11px; color: ${EXPORTACAO.tinta3}; margin-top: 8px; }

  .assinatura { text-align: center; font-size: 12px; color: ${EXPORTACAO.tinta3}; margin-top: 28px; }

  @media print {
    body { background: #fff; padding: 0; }
    .cartao { break-inside: avoid; border-radius: 0; }
  }
`;

export function relatorioEmHtml(dados: DadosDoRelatorio, geradoEm: Date): string {
  const titulo = `RepPlast — gráficos de ${dados.mes}`;

  const totais = dados.totais
    .map(
      (total) => `
      <div class="total">
        <div class="rot">${esc(total.rotulo)}</div>
        <div class="val">${esc(total.valor)}</div>
        ${total.detalhe ? `<div class="det">${esc(total.detalhe)}</div>` : ""}
      </div>`,
    )
    .join("");

  const secoes = dados.secoes
    .map((secao) => {
      const corpo =
        secao.tipo === "barras"
          ? barrasEmHtml(secao)
          : secao.tipo === "serie"
            ? serieEmHtml(secao)
            : `<p class="corpo">${esc(secao.corpo)}</p>`;

      return `
      <section class="cartao">
        <h2>${esc(secao.titulo)}</h2>
        <div class="per">${esc(secao.periodo)}</div>
        ${corpo}
      </section>`;
    })
    .join("");

  const quando = new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(geradoEm);

  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(titulo)}</title>
<style>${ESTILO}</style>
</head>
<body>
<div class="folha">
  <h1>Gráficos — ${esc(dados.mes)}</h1>
  <p class="sub">${esc(dados.escritorio)} · histórico de ${esc(dados.janela)}</p>
  <div class="totais">${totais}</div>
  ${secoes}
  <p class="assinatura">RepPlast · gerado em ${esc(quando)} · a mesma apuração da tela de Comissões</p>
</div>
</body>
</html>`;
}

function barrasEmHtml(secao: SecaoBarras): string {
  const teto = secao.teto ?? 12;
  const ranking = barrasRanqueadas(secao.itens, {
    teto,
    rotuloResiduo: secao.rotuloResiduo ?? "Outros",
  });

  const formatar = (valor: number) =>
    secao.unidade === "dias" ? `${valor} dias` : moeda(valor);

  const linhas = ranking.linhas
    .map(
      (linha) => `
      <div class="linha">
        <span class="rot${linha.residuo ? " residuo" : ""}" title="${esc(linha.rotulo)}">${esc(linha.rotulo)}</span>
        <span class="val">${esc(formatar(linha.valor))}</span>
        <div class="trilho">
          <div class="barra" style="width:${linha.proporcao.toFixed(2)}%;background:${
            linha.residuo ? EXPORTACAO.tinta3 : EXPORTACAO.serie
          }"></div>
        </div>
      </div>`,
    )
    .join("");

  const esquerda =
    ranking.agrupados > 0 ? `${teto} de ${ranking.itens}` : `${ranking.itens} itens`;

  return `${linhas}
    <div class="rodape-secao">
      <span>${esc(esquerda)}</span>
      ${secao.mostrarTotal !== false ? `<span>Total ${esc(formatar(ranking.total))}</span>` : ""}
    </div>`;
}

function serieEmHtml(secao: SecaoSerie): string {
  const { series, rotulos, maximo } = serieTemporal(secao.pontos);

  const legenda = secao.series
    .map(
      (serie) =>
        `<span><span class="ponto" style="background:${corExportada(serie.cor)}"></span>${esc(serie.rotulo)}</span>`,
    )
    .join("");

  // `vector-effect` mantém o traço com a mesma espessura quando a caixa estica.
  const caminhos = series
    .map((desenhada, i) => {
      const serie = secao.series[i];
      if (!serie) return "";
      const cor = corExportada(serie.cor);
      const area = serie.preencher
        ? `<path d="${desenhada.area}" fill="${cor}" opacity="0.12"/>`
        : "";

      return `${area}<path d="${desenhada.linha}" fill="none" stroke="${cor}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>`;
    })
    .join("");

  const eixo = rotulos.map((rotulo) => `<span>${esc(rotulo)}</span>`).join("");

  return `
    <div class="legenda">${legenda}<span style="margin-left:auto">Topo ${esc(moeda(maximo))}</span></div>
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" style="width:100%;height:170px" role="img" aria-label="${esc(
      `Série de ${rotulos.length} meses`,
    )}">${caminhos}</svg>
    <div class="eixo">${eixo}</div>`;
}
