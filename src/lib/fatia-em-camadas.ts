/**
 * Uma fatia de lista cujo resultado vem em CAMADAS: primeiro tudo o que a
 * primeira camada acha, depois a segunda, e assim por diante — cada uma na
 * ordem dela.
 *
 * Existe para a busca de pedidos e orçamentos pôr o número antes do resto
 * (`numero-procurado.ts`): o Prisma não ordena por "casou pelo número", então
 * cada camada é uma consulta própria, e esta função costura as fatias como se
 * fossem uma lista só, rolada de `inicio` em diante.
 *
 * As camadas têm de ser disjuntas — a mesma linha em duas apareceria duas
 * vezes. Quem as monta garante isso no `where`.
 */

export type Camadas<Onde, Linha> = {
  /** As linhas da camada `onde`, pulando `pular` e levando até `levar`. */
  buscar: (onde: Onde, pular: number, levar: number) => Promise<Linha[]>;
  /** Quantas linhas a camada `onde` tem ao todo. */
  contar: (onde: Onde) => Promise<number>;
};

export async function fatiaEmCamadas<Onde, Linha>(
  camadas: readonly Onde[],
  { inicio, quantos }: { inicio: number; quantos: number },
  { buscar, contar }: Camadas<Onde, Linha>,
): Promise<Linha[]> {
  /*
   * Na primeira fatia, nenhuma camada precisa ser contada: todas começam do
   * zero, e pedir `quantos` de cada uma, juntas, cobre o pior caso. É a fatia
   * de toda tecla digitada — a das seguintes só sai quando se rola.
   */
  if (inicio === 0) {
    const partes = await Promise.all(camadas.map((onde) => buscar(onde, 0, quantos)));
    return partes.flat().slice(0, quantos);
  }

  // Daqui em diante é preciso saber onde cada camada termina. A última nunca:
  // depois dela não há outra a empurrar.
  const tamanhos = await Promise.all(camadas.slice(0, -1).map((onde) => contar(onde)));

  let pular = inicio;
  let falta = quantos;
  const pedidos: Promise<Linha[]>[] = [];

  for (let i = 0; i < camadas.length && falta > 0; i++) {
    const tamanho = tamanhos[i] ?? Number.POSITIVE_INFINITY;
    if (pular >= tamanho) {
      pular -= tamanho;
      continue;
    }

    const levar = Math.min(falta, tamanho - pular);
    pedidos.push(buscar(camadas[i], pular, levar));
    falta -= levar;
    pular = 0;
  }

  return (await Promise.all(pedidos)).flat();
}
