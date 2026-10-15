/**
 * A viagem entre abas: o clique registra para onde se vai, e o que monta do
 * outro lado (a página, a pílula) lê isso e anima a própria chegada.
 *
 * Antes isto era uma View Transition do navegador, que tira uma FOTO da tela
 * inteira no começo da troca e outra no fim. Numa máquina sem aceleração de
 * vídeo, cada foto custava de 50 a 100 ms com a tela parada — o "engasgo" no
 * clique e o tranco no fim, que deixavam a troca com cara de travada mesmo com
 * o deslize em si a 60 quadros (medido). Aqui não há foto: quem anda são os
 * próprios elementos, só com `transform` e `opacity`, que o compositor faz
 * sozinho.
 *
 * As curvas são molas do Motion (`spring(duraçãoVisual, quique)`), convertidas
 * em `linear()` pelo próprio Motion e coladas aqui — o navegador as executa
 * sem JavaScript por quadro. A cauda de cada uma, onde a mola já não move nem
 * meio pixel, foi cortada: só prolongava a animação sem nada para ver.
 */

export type Alcance = "perto" | "media" | "longe";
export type Direcao = "direita" | "esquerda";

/** `spring(0.26 | 0.3 | 0.36, 0)`: sem quique — conteúdo não balança. */
const MOLA_PAGINA: Record<Alcance, { duracao: number; curva: string }> = {
  perto: {
    duracao: 344,
    curva: "linear(0, 0.1316, 0.3585, 0.5628, 0.7162, 0.8217, 0.8906, 0.934, 0.9607, 0.9769, 0.9865, 1)",
  },
  media: {
    duracao: 411,
    curva:
      "linear(0, 0.1061, 0.3018, 0.4922, 0.6466, 0.7613, 0.8422, 0.8975, 0.9342, 0.9582, 0.9737, 0.9836, 0.9898, 1)",
  },
  longe: {
    duracao: 477,
    curva:
      "linear(0, 0.0791, 0.2369, 0.4041, 0.5522, 0.6723, 0.7649, 0.8339, 0.884, 0.9198, 0.945, 0.9625, 0.9746, 0.9829, 0.9885, 1)",
  },
};

/** `spring(0.22 | 0.28 | 0.34, 0.12)`: passa do ponto um fio e volta, como o seletor do iOS. */
const MOLA_PILULA: Record<Alcance, { duracao: number; curva: string }> = {
  perto: {
    duracao: 321,
    curva: "linear(0, 0.1874, 0.4853, 0.7206, 0.8675, 0.9464, 0.9833, 0.9981, 1.0025, 1.0029, 1)",
  },
  media: {
    duracao: 350,
    curva: "linear(0, 0.1251, 0.3554, 0.5737, 0.7411, 0.8551, 0.9259, 0.9666, 0.988, 0.9981, 1.002, 1)",
  },
  longe: {
    duracao: 442,
    curva:
      "linear(0, 0.089, 0.2688, 0.4591, 0.6243, 0.753, 0.8462, 0.9098, 0.9508, 0.9759, 0.9904, 0.998, 1.0015, 1.0028, 1)",
  },
};

/** Quanto a página nova vem de lado: mais longe a aba, maior o caminho. */
const DESLOCAMENTO: Record<Alcance, number> = { perto: 16, media: 24, longe: 32 };

/** O esmaecer da página nova — curto, para ela já estar legível no meio do deslize. */
const ESMAECER: Record<Alcance, number> = { perto: 180, media: 210, longe: 240 };

/** Passado disto, a viagem não vale mais: a página montou por outro motivo. */
const VALIDADE_MS = 2000;

type Viagem = {
  direcao: Direcao;
  alcance: Alcance;
  /** Onde estava a pílula antes do clique (em px da janela). */
  pilula: { esquerda: number; largura: number } | null;
  quando: number;
  /** Quando a primeira página (às vezes o esqueleto) começou a entrar. */
  paginaDesde: number | null;
  pilulaChegou: boolean;
};

let viagem: Viagem | null = null;

function alcanceDe(distancia: number): Alcance {
  if (distancia <= 1) return "perto";
  if (distancia <= 3) return "media";
  return "longe";
}

function semMovimento() {
  return document.documentElement.dataset.animacoes === "desativadas";
}

function valendo(): Viagem | null {
  if (!viagem || performance.now() - viagem.quando > VALIDADE_MS) return null;
  return viagem;
}

/**
 * O clique numa aba: de onde para onde. A direção sai da posição na barra (e
 * não do histórico) e o alcance, da distância entre as abas.
 */
export function partir(destino: number, atual: number) {
  if (destino === atual || semMovimento()) {
    viagem = null;
    return;
  }
  const pilula = document.querySelector<HTMLElement>("nav[aria-label='Principal'] .marca-nav");
  const retangulo = pilula?.getBoundingClientRect();
  viagem = {
    direcao: destino > atual ? "direita" : "esquerda",
    alcance: alcanceDe(Math.abs(destino - atual)),
    pilula: retangulo && retangulo.width > 0 ? { esquerda: retangulo.left, largura: retangulo.width } : null,
    quando: performance.now(),
    paginaDesde: null,
    pilulaChegou: false,
  };
}

/**
 * A página que acabou de montar entra pelo lado da aba.
 *
 * Quando a página demora, o esqueleto (`loading.tsx`) monta antes e começa a
 * entrada. O conteúdo que toma o lugar dele no meio do caminho CONTINUA o
 * mesmo deslize, do ponto em que o esqueleto estava — sem recomeçar e sem
 * pular para o lugar final. Se o esqueleto já tinha chegado, o conteúdo só
 * troca.
 */
export function chegarPagina(elemento: HTMLElement) {
  const v = valendo();
  if (!v) return;

  const agora = performance.now();
  v.paginaDesde ??= agora;
  const andado = agora - v.paginaDesde;

  const { duracao, curva } = MOLA_PAGINA[v.alcance];
  if (andado >= duracao) return;

  const deslocamento = DESLOCAMENTO[v.alcance] * (v.direcao === "direita" ? 1 : -1);
  const deslize = elemento.animate([{ translate: `${deslocamento}px 0` }, { translate: "0 0" }], {
    duration: duracao,
    easing: curva,
  });
  deslize.currentTime = andado;

  const esmaecer = ESMAECER[v.alcance];
  if (andado < esmaecer) {
    const aparecer = elemento.animate([{ opacity: 0 }, { opacity: 1 }], { duration: esmaecer, easing: "ease-out" });
    aparecer.currentTime = andado;
  }
}

/**
 * A pílula que acabou de montar na aba nova sai de onde a antiga estava, com o
 * tamanho dela, e vai até a aba nova ajustando o tamanho no caminho — como o
 * seletor segmentado do iOS. Partindo já no tamanho final, ela cobria metade
 * da aba vizinha no primeiro quadro.
 *
 * Posição e largura andam por `left` e `width`, as duas no mesmo fio: com uma
 * no compositor (`transform`) e a outra no layout, um quadro atrasado em uma
 * delas fazia a pílula piscar fora do lugar. É um elemento pequeno e solto
 * (`absolute`), e o layout dele não mexe em mais nada.
 */
export function chegarPilula(elemento: HTMLElement) {
  const v = valendo();
  if (!v || v.pilulaChegou || v.pilula === null) return;
  v.pilulaChegou = true;

  const destino = elemento.getBoundingClientRect();
  const distancia = v.pilula.esquerda - destino.left;
  if (Math.abs(distancia) < 1 && Math.abs(v.pilula.largura - destino.width) < 1) return;
  const { duracao, curva } = MOLA_PILULA[v.alcance];
  elemento.animate(
    [
      { left: `${distancia}px`, width: `${v.pilula.largura}px` },
      { left: "0px", width: `${destino.width}px` },
    ],
    { duration: duracao, easing: curva },
  );
}
