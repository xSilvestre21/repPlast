/**
 * O nome inteiro de um usuário, como o sistema o exibe e imprime.
 *
 * Nome e sobrenome moram em campos separados (a ficha do preposto edita os
 * dois), mas quase todo lugar quer "Maria Augusta Ferraz" de uma vez: o menu,
 * o vendedor impresso no pedido, a linha de Comissões, o autor de um
 * compromisso. Montar aqui, num lugar só, evita espaço sobrando quando não há
 * sobrenome — e um lugar que esqueça o sobrenome.
 */
export function nomeCompleto(usuario: { nome: string; sobrenome?: string | null }): string {
  return [usuario.nome, usuario.sobrenome]
    .map((parte) => parte?.trim())
    .filter(Boolean)
    .join(" ");
}

