/**
 * O foco que o sistema põe sozinho, sem a pessoa ter apertado Tab.
 *
 * O anel azul (`:focus-visible`) quer dizer "o teclado está aqui". O Safari do
 * iPhone o desenha em todo foco posto por código: a pergunta de "Desfazer
 * acerto" abria com o Cancelar cercado pelo anel, como se alguém tivesse
 * apertado Tab até ele — e quem só tocou na tela não tem Tab para apertar.
 *
 * Então o que não é de digitar (botão, dia do calendário) só recebe foco por
 * código de quem está no teclado: para ele, o foco no Cancelar é a proteção
 * contra o Enter distraído, e o anel é o que mostra onde ele está. Campo de
 * digitar recebe sempre — foi marcado para isso, e no celular o teclado abre
 * com ele; o campo tem a borda dele, e não o anel de Tab.
 */

/** A última coisa que a pessoa usou foi o teclado (e não o dedo ou o mouse). */
let peloTeclado = false;
if (typeof window !== "undefined") {
  // Na captura: vale mesmo onde um componente para a propagação.
  window.addEventListener("keydown", () => {
    peloTeclado = true;
  }, true);
  window.addEventListener("pointerdown", () => {
    peloTeclado = false;
  }, true);
}

/** O que se preenche: o foco nele é o de quem vai digitar, por dedo ou teclado. */
const CAMPO =
  "input:not([type=button],[type=checkbox],[type=color],[type=file],[type=radio],[type=range],[type=reset],[type=submit]), " +
  "select, textarea, [contenteditable]";

/** Põe o foco no `alvo` se ele for campo, ou se a pessoa estiver no teclado. Diz se pôs. */
export function focarSePuder(alvo: HTMLElement | null | undefined, opcoes?: FocusOptions): boolean {
  if (!alvo || !(peloTeclado || alvo.matches(CAMPO))) return false;
  alvo.focus(opcoes);
  return true;
}
