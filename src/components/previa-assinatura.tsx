/**
 * A assinatura de e-mail como ela vai sair — logo, cores e links.
 *
 * Num `<iframe sandbox>` sem permissão nenhuma: o HTML já foi limpo no
 * servidor (`limparAssinatura`), mas é HTML que veio de fora, colado de
 * qualquer lugar. Isolado, ele não roda nada nem enxerga a página do sistema,
 * e o estilo dele não vaza para a tela (nem o da tela para ele).
 */

export function PreviaAssinatura({ html, className = "" }: { html: string; className?: string }) {
  return (
    <iframe
      title="Prévia da assinatura"
      sandbox=""
      srcDoc={
        '<!doctype html><html><body style="margin:12px;font-family:Arial,Helvetica,sans-serif;' +
        `font-size:14px;color:#222;background:#fff">${html}</body></html>`
      }
      className={`block w-full h-36 rounded-suave border border-filete bg-white ${className}`}
    />
  );
}
