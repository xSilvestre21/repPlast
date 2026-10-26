/**
 * Abre um `<dialog>` como modal, com o foco no lugar certo.
 *
 * O `showModal()` põe o foco no primeiro elemento focável — e nas três janelas
 * do sistema (`Dialogo`, `FolhaDeBaixo`, a gaveta do menu) esse elemento é o X
 * de fechar. No iPhone o Safari desenha o anel de foco nele, e a janela abre
 * parecendo que alguém apertou Tab até o X.
 *
 * Quando o conteúdo não pede um campo (`data-autofocus`), o foco vai para a
 * própria caixa (`tabindex="-1"`, focável só por código). O `autofocus` no
 * `<dialog>` diria o mesmo pela especificação, mas o Chromium o ignora. O Tab
 * continua levando ao primeiro botão, e o leitor de tela anuncia o título
 * (`aria-labelledby`). O anel da caixa focada é tirado em `globals.css`.
 */
export function abrirModal(dialogo: HTMLDialogElement) {
  dialogo.showModal();
  if (dialogo.querySelector("[data-autofocus]")) return;
  dialogo.tabIndex = -1;
  dialogo.focus({ preventScroll: true });
}
