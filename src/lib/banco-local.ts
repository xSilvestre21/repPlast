/**
 * O banco da connection string está nesta máquina?
 *
 * É a trava do que só pode rodar num banco descartável: o seed (que planta um
 * login de senha conhecida) e os testes de integração (que criam e apagam
 * escritórios). Num `.env` apontado para a produção por engano, os dois
 * recusam em vez de escrever lá.
 */
export function bancoEhLocal(url: string | undefined): boolean {
  if (!url) return false;
  try {
    const { hostname } = new URL(url);
    return ["localhost", "127.0.0.1", "[::1]", "::1"].includes(hostname);
  } catch {
    return false;
  }
}
