/**
 * A resposta de uma rota de arquivo (PDF, exportação) quando ela não pode
 * entregar o arquivo.
 *
 * Essas rotas abrem numa aba própria e não passam pelo layout do sistema. A
 * resposta era um texto cru — "Não autenticado" — numa página branca, sem
 * dizer o que fazer nem como voltar. Agora é uma página curta, em português,
 * com o próximo passo e o caminho de volta.
 *
 * Sem estilo do sistema de propósito: a página tem de funcionar sozinha, sem
 * CSS nem JavaScript carregados.
 */

function escapar(texto: string) {
  return texto.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

export function respostaDeErro(status: number, titulo: string, texto: string): Response {
  const pagina = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapar(titulo)}</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 32rem; margin: 15vh auto; padding: 0 1rem; color: #1c1c1e; background: #fafaf9; line-height: 1.5; }
  @media (prefers-color-scheme: dark) { body { color: #ececec; background: #161617; } a { color: #8ab4ff; } }
  h1 { font-size: 1.25rem; margin-bottom: .5rem; }
  a { color: #2459d6; font-weight: 600; }
</style>
</head>
<body>
<h1>${escapar(titulo)}</h1>
<p>${escapar(texto)}</p>
<p><a href="/">Voltar ao sistema</a></p>
</body>
</html>`;

  return new Response(pagina, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

/** A sessão venceu com a aba aberta, ou o link foi aberto fora do sistema. */
export function sessaoExpiradaNoArquivo(): Response {
  return respostaDeErro(
    401,
    "Entre no sistema para abrir este arquivo",
    "Sua sessão expirou, ou este link foi aberto fora do sistema. Entre de novo e abra o arquivo outra vez pela tela de onde ele veio.",
  );
}
