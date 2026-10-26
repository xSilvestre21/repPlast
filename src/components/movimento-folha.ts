/**
 * O movimento das janelas que deslizam — a folha que sobe de baixo
 * (`folha-de-baixo.tsx`) e a gaveta do menu (`navegacao.tsx`).
 *
 * Os números são os da folha do iOS, como o Vaul os mediu: a curva
 * `cubic-bezier(0.32, 0.72, 0, 1)` em meio segundo, que arranca rápido e pousa
 * devagar; fechar ao soltar depois de 25% do caminho ou num peteleco acima de
 * 0,4 px/ms; e resistência crescente ao puxar para o lado que não fecha.
 */

export const CURVA = "cubic-bezier(0.32, 0.72, 0, 1)";
export const DURACAO_MS = 500;
/** A fração do tamanho que, arrastada, fecha ao soltar (o `CLOSE_THRESHOLD` do Vaul). */
export const FRACAO_PARA_FECHAR = 0.25;
/** Px por ms: o peteleco que fecha mesmo sem ter andado muito (o `VELOCITY_THRESHOLD`). */
export const VELOCIDADE_PARA_FECHAR = 0.4;

export function semMovimento() {
  return document.documentElement.dataset.animacoes === "desativadas";
}

/** A resistência de puxar para o lado que não fecha: nada no começo, e cada vez menos depois. */
export function resistencia(distancia: number) {
  return Math.max(0, 8 * (Math.log(distancia + 1) - 2));
}

/**
 * A janela onde o dedo está (`translate` já montado, "0 120px" ou "-80px 0"),
 * e o fundo clareando na proporção `fracao` (0 a 1) do caminho até fechar.
 */
export function posicionar(janela: HTMLElement, translate: string, fracao: number) {
  janela.style.translate = translate;
  janela.style.setProperty("--arraste", String(Math.max(0, Math.min(1, fracao))));
}

/**
 * Tira o que um arraste deixou: parada, a janela não fica com `translate`
 * nenhum.
 *
 * Sem transição na hora de tirar: com a da classe valendo, o navegador
 * animaria de "0px" até "none" por mais meio segundo — e `translate` na folha
 * fazia o iOS desenhar o cursor fora do campo.
 */
export function limpar(janela: HTMLElement) {
  janela.style.transition = "none";
  janela.style.translate = "";
  janela.style.removeProperty("--arraste");
  // Aplica sem animar, e só então devolve a transição da classe.
  void janela.offsetHeight;
  janela.style.transition = "";
}

/**
 * Anima o `translate` até `destino` e chama `depois` no fim — ou logo, com
 * "Desativar animações". `fundo` é onde o fundo escuro termina (0 escuro, 1
 * claro): fechar clareia, voltar escurece.
 */
export function deslizar(janela: HTMLElement, destino: string, fundo: 0 | 1, depois: () => void) {
  if (semMovimento()) {
    depois();
    return;
  }
  janela.style.transition = `translate ${DURACAO_MS}ms ${CURVA}`;
  let feito = false;
  const fim = () => {
    if (feito) return;
    feito = true;
    janela.removeEventListener("transitionend", aoTerminar);
    depois();
  };
  // Só o fim DESTE deslize. `transitionend` borbulha: a cor de um link, o
  // fundo escuro (`::backdrop`) ou a entrada que ainda terminava chegam aqui
  // também — e davam a saída por terminada antes de ela começar.
  const aoTerminar = (evento: TransitionEvent) => {
    if (evento.target === janela && !evento.pseudoElement && evento.propertyName === "translate") fim();
  };
  // Um quadro antes de mudar o destino: sem isto, a transição não arranca
  // quando o valor de partida acabou de ser posto.
  requestAnimationFrame(() => {
    janela.style.translate = destino;
    janela.style.setProperty("--arraste", String(fundo));
    if (!feito) janela.addEventListener("transitionend", aoTerminar);
  });
  // Se a transição não disparar (aba em segundo plano), não fica preso.
  window.setTimeout(fim, DURACAO_MS + 80);
}

/** A velocidade de um gesto inteiro, como o Vaul mede: distância sobre tempo. */
export function velocidade(distancia: number, tempoMs: number) {
  return tempoMs > 0 ? distancia / tempoMs : 0;
}
