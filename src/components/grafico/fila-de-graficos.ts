"use client";

/**
 * A fila que cria os gráficos um por vez.
 *
 * A página de Gráficos monta mais de uma dezena de ECharts, e cada um custa
 * caro para nascer (o `setOption` monta séries, eixos e textos). Criados todos
 * no mesmo efeito do React, viravam UMA tarefa só — medida em 800 ms com o
 * processador lento —, e a tela inteira congelava até o último ficar pronto.
 *
 * Aqui cada gráfico nasce numa tarefa própria, com um quadro de respiro entre
 * um e outro: o navegador pinta, responde ao mouse e à rolagem no meio. O
 * desenho é o mesmo; só deixa de chegar tudo num bloco. Os que estão na tela
 * passam na frente — são os que a pessoa está olhando.
 */

type Tarefa = { elemento: Element; criar: () => void };

const fila: Tarefa[] = [];
let agendado = false;

function naTela(elemento: Element): boolean {
  const caixa = elemento.getBoundingClientRect();
  return caixa.bottom > 0 && caixa.top < window.innerHeight;
}

function proxima() {
  agendado = false;
  if (fila.length === 0) return;

  // Na tela primeiro; fora dela, na ordem em que entraram (a ordem da página).
  const indice = Math.max(0, fila.findIndex((tarefa) => naTela(tarefa.elemento)));
  const [tarefa] = fila.splice(indice, 1);
  tarefa.criar();

  agendar();
}

function agendar() {
  if (agendado || fila.length === 0) return;
  agendado = true;
  // Um quadro (o navegador pinta o que já nasceu) e depois uma tarefa nova
  // (entra o que estiver esperando: clique, rolagem, outro desenho).
  requestAnimationFrame(() => setTimeout(proxima, 0));
}

/**
 * Põe a criação de um gráfico na fila. Devolve como desistir — para o gráfico
 * que desmonta antes da vez dele (troca de visão, saída da página).
 */
export function naFila(elemento: Element, criar: () => void): () => void {
  const tarefa = { elemento, criar };
  fila.push(tarefa);
  agendar();

  return () => {
    const indice = fila.indexOf(tarefa);
    if (indice >= 0) fila.splice(indice, 1);
  };
}
