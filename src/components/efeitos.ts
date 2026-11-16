/**
 * Efeitos visuais leves, por aparelho.
 *
 * As animações do sistema já correm no compositor (`opacity`/`transform`) e
 * continuam em todo aparelho — são elas que fazem o sistema gostoso de usar. O
 * que pesa num computador antigo é o que o navegador REPINTA por baixo delas a
 * cada quadro: o desfoque do campo de luz, o vidro da barra do topo, o
 * desfoque atrás das janelas. Com `data-efeitos="leves"` no <html> esses
 * desfoques saem, e o movimento fica (regras no fim de `globals.css`).
 *
 * É do APARELHO, e não da conta: a mesma pessoa abre o sistema num PC antigo e
 * num novo. Por isso mora no `localStorage`, como o tema — diferente de
 * "Desativar animações", que é preferência de conta e tira o movimento.
 *
 * Módulo sem `"use client"` de propósito: o script abaixo é lido pelo layout
 * raiz, que é componente de servidor (ver "Common Gotchas" no CLAUDE.md).
 */

/** O que a pessoa escolheu em Configurações: "leves" | "completos"; ausente é Automático. */
export const CHAVE_EFEITOS = "efeitos-escolhidos";

/** O que a medição concluiu neste navegador: "leves:<quando>" — vale por `VALIDADE_DA_MEDICAO`. */
export const CHAVE_MEDIDO = "efeitos-medidos";

/** Depois disso mede de novo: um dia ruim da máquina não vira sentença. */
export const VALIDADE_DA_MEDICAO = 30 * 24 * 60 * 60 * 1000;

export type EscolhaDeEfeitos = "automatico" | "leves" | "completos";

/**
 * Script que roda ANTES da primeira pintura, como o do tema: sem ele a página
 * nasceria com os desfoques e os perderia depois da hidratação.
 *
 * Automático liga os efeitos leves quando a medição já concluiu isso aqui, ou
 * quando o aparelho se declara pequeno (até 2 núcleos ou 2 GB) — nesses nem
 * vale esperar a medição.
 */
export const SCRIPT_EFEITOS = `(function(){try{var d=document.documentElement,e=localStorage.getItem('${CHAVE_EFEITOS}'),m=localStorage.getItem('${CHAVE_MEDIDO}')||'',n=navigator,p=m.split(':'),medido=p[0]==='leves'&&Date.now()-Number(p[1])<${VALIDADE_DA_MEDICAO},pequeno=(n.hardwareConcurrency>0&&n.hardwareConcurrency<=2)||(n.deviceMemory>0&&n.deviceMemory<=2);if(e==='leves'||(e!=='completos'&&(medido||pequeno))){d.dataset.efeitos='leves'}}catch(x){}})()`;

/** Quadro que passou disto perdeu pelo menos dois de uma tela de 60 Hz. */
const QUADRO_LENTO = 40;

/** Janela curta demais (a aba ficou escondida, a página saiu) não diz nada. */
const MINIMO_DE_QUADROS = 20;

/**
 * Uma janela de medição foi lenta?
 *
 * Recebe o intervalo entre quadros, em ms. Lenta é a que não sustentou 45
 * quadros por segundo, ou em que mais de um em cada oito quadros travou — a
 * diferença entre um engasgo isolado (toda máquina tem, na hidratação) e uma
 * tela que anda aos trancos. `null` quando não dá para dizer.
 */
export function janelaLenta(intervalos: readonly number[]): boolean | null {
  if (intervalos.length < MINIMO_DE_QUADROS) return null;

  const total = intervalos.reduce((soma, intervalo) => soma + intervalo, 0);
  if (total <= 0) return null;

  const quadrosPorSegundo = (intervalos.length / total) * 1000;
  const lentos = intervalos.filter((intervalo) => intervalo > QUADRO_LENTO).length;

  return quadrosPorSegundo < 45 || lentos / intervalos.length > 0.125;
}

/** Quantas janelas lentas ligam os efeitos leves, e quantas boas encerram a medição. */
export const LENTAS_PARA_LIGAR = 3;
export const BOAS_PARA_ENCERRAR = 6;

/**
 * O veredito depois de algumas janelas: "leves" se três lentas chegarem antes
 * de seis boas, "completos" no caso contrário, `null` enquanto falta medir.
 *
 * É uma corrida, e não "três das cinco primeiras": num aparelho lento a página
 * que já estava guardada abre lisa, e essa janela boa no meio não pode absolver
 * as outras (medido com a CPU freada: quatro janelas a ~35 quadros por segundo
 * e uma a 54). No aparelho bom, um engasgo isolado nunca soma três.
 */
export function vereditoDaMedicao(janelas: readonly boolean[]): "leves" | "completos" | null {
  const lentas = janelas.filter(Boolean).length;
  if (lentas >= LENTAS_PARA_LIGAR) return "leves";
  if (janelas.length - lentas >= BOAS_PARA_ENCERRAR) return "completos";
  return null;
}

/** Os efeitos leves estão valendo nesta página? Só no navegador. */
export function efeitosLeves(): boolean {
  return typeof document !== "undefined" && document.documentElement.dataset.efeitos === "leves";
}
