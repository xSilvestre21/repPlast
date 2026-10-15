"use client";

/**
 * Quando cada gráfico nasce.
 *
 * A página de Gráficos monta mais de uma dezena de ECharts, e cada um custa
 * caro para nascer (o `setOption` monta séries, eixos e textos). Criados todos
 * no mesmo efeito do React, viravam UMA tarefa só — medida em 800 ms com o
 * processador lento —, e a tela inteira congelava até o último ficar pronto.
 *
 * Mas também não dá para criá-los um por quadro: os que estão na tela
 * surgiam um depois do outro, fora de compasso, e a criação do seguinte
 * engasgava a animação de entrada do anterior — a entrada em cascata, com
 * tudo crescendo junto, virava um pipocar. Por isso, duas regras:
 *
 *  - **Na tela:** nasce na hora, no próprio efeito, junto com os outros da
 *    primeira dobra — uma fração do custo de criar a página toda, pago antes
 *    de qualquer animação começar. A animação de entrada de cada um espera a
 *    vez do cartão dele na cascata da página (`.palco`) e a thread ficar
 *    livre (`segurarALargada`).
 *  - **Fora da tela:** espera a entrada dos visíveis terminar (para não roubar
 *    quadros dela) e nasce depois, um por vez, nos momentos ociosos do
 *    navegador. Quem a rolagem alcançar antes da vez nasce na hora em que
 *    chega perto — e entra animando, como se tivesse esperado por ela.
 */

type Tarefa = { elemento: Element; criar: () => void };

/** Um pouco mais que a entrada de um gráfico (1 s, o padrão do ECharts). */
const DURACAO_DA_ENTRADA = 1100;

const fila: Tarefa[] = [];
let ultimaEntrada = 0;
let agendado = false;
let perto: IntersectionObserver | null = null;
let visivel: IntersectionObserver | null = null;

function naTela(elemento: Element): boolean {
  const caixa = elemento.getBoundingClientRect();
  return caixa.bottom > 0 && caixa.top < window.innerHeight;
}

/* -------------------------------------------------------------------------- */
/* A largada da animação                                                      */
/* -------------------------------------------------------------------------- */

/** O que espera a largada, e como liberar. */
const esperando: { cartao: Element | null; liberar: () => void; desde: number }[] = [];
let vigiando = false;

/** Ninguém espera para sempre: se a cascata não vier, o gráfico anima assim mesmo. */
const ESPERA_MAXIMA = 3000;

/**
 * Um quadro "calmo" chegou até este tempo depois do anterior: a thread
 * principal não está mais presa numa tarefa longa (a hidratação da página, o
 * `setOption` dos vizinhos) — o próximo quadro vai mesmo para a tela.
 */
const QUADRO_CALMO = 34;

/** O cartão da cascata (`.palco`) que ainda não começou a aparecer. */
function cartaoAEsperar(elemento: Element): Element | null {
  const cartao = elemento.closest(".palco > *");
  if (!cartao) return null;
  const entrada = cartao
    .getAnimations()
    .find((animacao) => animacao instanceof CSSAnimation && animacao.animationName === "surgir");
  if (!entrada || entrada.playState === "finished") return null;
  return Number(getComputedStyle(cartao).opacity) > 0 ? null : cartao;
}

/**
 * Algum `surgir` de cascata ainda correndo. Só os do relógio da página: o
 * `.revelar` usa o mesmo `surgir` preso à rolagem, e esse fica "correndo"
 * para sempre.
 */
function cascataAndando(): boolean {
  return document
    .getAnimations()
    .some(
      (animacao) =>
        animacao instanceof CSSAnimation &&
        animacao.animationName === "surgir" &&
        animacao.timeline === document.timeline &&
        animacao.playState === "running",
    );
}

function vigiar() {
  if (vigiando) return;
  vigiando = true;
  let anterior: number | null = null;
  const passo = (agora: number) => {
    const calmo = anterior !== null && agora - anterior <= QUADRO_CALMO;
    anterior = agora;
    for (let i = esperando.length - 1; i >= 0; i--) {
      const { cartao, liberar, desde } = esperando[i];
      const cartaoNaTela = cartao === null || Number(getComputedStyle(cartao).opacity) > 0;
      if ((calmo && cartaoNaTela) || performance.now() - desde > ESPERA_MAXIMA) {
        esperando.splice(i, 1);
        ultimaEntrada = Math.max(ultimaEntrada, performance.now());
        liberar();
      }
    }
    if (esperando.length > 0) requestAnimationFrame(passo);
    else vigiando = false;
  };
  requestAnimationFrame(passo);
}

/**
 * Segura a animação que o `setOption` acabou de armar até ela poder ser VISTA
 * do começo — e devolve como desistir.
 *
 * O relógio do ECharts começa a contar no `setOption`, que roda dentro de uma
 * tarefa longa: a montagem da página, ou o clique que trocou a visão e
 * re-renderizou o cartão. Até essa tarefa acabar e a tela pintar, a animação
 * já "andou" — numa máquina lenta, 60 a 120 ms dela —, e o primeiro quadro
 * visível pulava esse trecho: o gráfico parecia arrancar aos trancos, com
 * poucos quadros. Medido no perfil do Chrome com o processador 4× mais lento.
 *
 * Então o relógio fica parado até dois quadros seguidos chegarem no ritmo
 * (`QUADRO_CALMO`): a thread está livre, e o primeiro quadro da animação é o
 * primeiro que aparece. É o que a Apple faz ao começar uma animação no próximo
 * quadro do servidor de renderização, e não no instante em que ela é pedida.
 *
 * Na entrada da página, espera também a vez do cartão na cascata (`.palco`):
 * começar antes gastaria o crescimento das barras com o cartão invisível.
 */
export function segurarALargada(
  elemento: Element,
  relogio: { pause: () => void; resume: () => void },
): () => void {
  relogio.pause();
  const item = { cartao: cartaoAEsperar(elemento), liberar: () => relogio.resume(), desde: performance.now() };
  esperando.push(item);
  vigiar();
  return () => {
    const indice = esperando.indexOf(item);
    if (indice >= 0) esperando.splice(indice, 1);
  };
}

function tirar(tarefa: Tarefa) {
  const indice = fila.indexOf(tarefa);
  if (indice < 0) return false;
  fila.splice(indice, 1);
  perto?.unobserve(tarefa.elemento);
  visivel?.unobserve(tarefa.elemento);
  return true;
}

function quandoOcioso(fazer: () => void) {
  if ("requestIdleCallback" in window) requestIdleCallback(fazer, { timeout: 500 });
  else setTimeout(fazer, 0);
}

function proxima() {
  agendado = false;
  const tarefa = fila[0];
  if (!tarefa) return;

  // Uma entrada começou no meio da espera (uma visão trocada, a rolagem):
  // espera ela também.
  const falta = ultimaEntrada + DURACAO_DA_ENTRADA - performance.now();
  if (falta > 0) {
    agendar(falta);
    return;
  }
  // E a cascata dos cartões: criar um gráfico é um quadro longo, e no meio
  // do surgir das últimas linhas ele aparece como um tranco.
  if (esperando.length > 0 || cascataAndando()) {
    agendar(150);
    return;
  }

  tirar(tarefa);
  tarefa.criar();
  agendar(0);
}

function agendar(espera: number) {
  if (agendado || fila.length === 0) return;
  agendado = true;
  setTimeout(() => quandoOcioso(proxima), espera);
}

/** Cria um que esperava, fora da vez: a rolagem chegou nele. */
function criarJa(elemento: Element) {
  const tarefa = fila.find((t) => t.elemento === elemento);
  if (!tarefa || !tirar(tarefa)) return;
  ultimaEntrada = performance.now();
  tarefa.criar();
}

/**
 * Os dois olhos sobre quem ainda espera.
 *
 * `perto` (meia tela de folga): a rolagem se aproxima — nasce já, para o
 * desenho estar começando quando ele aparecer. Se a entrada dos visíveis
 * ainda anima (e é também o aviso inicial do observador, para quem nasce
 * perto da dobra), só passa à frente da fila, para não roubar quadros dela.
 *
 * `visivel` (sem folga): chegou à tela. Nasce na hora, com entrada ou sem —
 * alguém está olhando. São dois porque, com a folga, o observador não avisa
 * de novo quando o gráfico passa de "perto" para "na tela".
 */
function observadores() {
  perto ??= new IntersectionObserver(
    (entradas) => {
      for (const entrada of entradas) {
        if (!entrada.isIntersecting) continue;
        if (performance.now() - ultimaEntrada >= DURACAO_DA_ENTRADA) {
          criarJa(entrada.target);
          continue;
        }
        const tarefa = fila.find((t) => t.elemento === entrada.target);
        if (!tarefa) continue;
        fila.splice(fila.indexOf(tarefa), 1);
        fila.unshift(tarefa);
      }
    },
    { rootMargin: "50% 0px" },
  );
  visivel ??= new IntersectionObserver((entradas) => {
    for (const entrada of entradas) if (entrada.isIntersecting) criarJa(entrada.target);
  });
  return [perto, visivel];
}

/**
 * Cria o gráfico agora (se está na tela) ou na vez dele. Devolve como
 * desistir — para o gráfico que desmonta antes da vez (troca de visão, saída
 * da página).
 */
export function naFila(elemento: Element, criar: () => void): () => void {
  if (naTela(elemento)) {
    // Nasce AGORA, junto com os outros visíveis — o trabalho pesado fica todo
    // antes da primeira animação (a de cada um espera o cartão, em
    // `segurarALargada`). Criado no meio da animação dos vizinhos, cada gráfico
    // travava a deles por um quadro longo.
    ultimaEntrada = Math.max(ultimaEntrada, performance.now());
    criar();
    return () => {};
  }

  const tarefa = { elemento, criar };
  fila.push(tarefa);
  for (const olho of observadores()) olho.observe(elemento);
  agendar(Math.max(0, ultimaEntrada + DURACAO_DA_ENTRADA - performance.now()));

  return () => {
    tirar(tarefa);
  };
}
