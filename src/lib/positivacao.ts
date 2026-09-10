/**
 * Positivação: quem comprava e parou.
 *
 * É o relatório que mais gera venda nova, porque aponta relacionamento que
 * está esfriando enquanto ainda dá para recuperar.
 *
 * Regra: só entra quem JÁ COMPROU alguma vez. Cliente cadastrado e nunca
 * atendido é assunto de prospecção, não de positivação — misturar os dois
 * encheria a lista de gente que nunca esteve lá para sumir.
 */

const DIA = 24 * 60 * 60 * 1000;

export interface ClienteComHistorico {
  id: string;
  apelido: string;
  /** Data do último pedido ENVIADO, ou `null` para quem nunca comprou. */
  ultimaCompra: Date | null;
}

export interface ClienteSumido<T extends ClienteComHistorico> {
  cliente: T;
  ultimaCompra: Date;
  diasSemComprar: number;
}

/**
 * Clientes sem compra há mais de `dias`, do mais abandonado para o menos.
 *
 * `agora` é parâmetro, e não `Date.now()` interno, por dois motivos: deixa a
 * função testável sem mexer no relógio, e garante que todas as contagens da
 * mesma tela usem o mesmo ponto de referência.
 */
export function clientesSumidos<T extends ClienteComHistorico>(
  clientes: T[],
  dias: number,
  agora: number,
): ClienteSumido<T>[] {
  const corte = agora - dias * DIA;

  return clientes
    .filter((cliente): cliente is T & { ultimaCompra: Date } => cliente.ultimaCompra !== null)
    .filter((cliente) => cliente.ultimaCompra.getTime() < corte)
    .map((cliente) => ({
      cliente,
      ultimaCompra: cliente.ultimaCompra,
      diasSemComprar: Math.floor((agora - cliente.ultimaCompra.getTime()) / DIA),
    }))
    // O mais abandonado primeiro: é quem corre mais risco de já ter sido perdido.
    .sort((a, b) => b.diasSemComprar - a.diasSemComprar);
}
