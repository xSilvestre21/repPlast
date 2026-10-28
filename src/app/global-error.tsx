"use client";

import * as Sentry from "@sentry/nextjs";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";

import { SCRIPT_TEMA } from "@/components/alternador-tema";
import { Botao, EstadoVazio } from "@/components/ui";

import { classesDasFontes } from "./fontes";
import "./globals.css";

/**
 * O erro do próprio layout raiz — o banco fora do ar quando ele lê a sessão,
 * por exemplo. O `(app)/error.tsx` não o apanha: fica abaixo do layout que
 * falhou. Sem este arquivo, a tela seria a página padrão do Next, em inglês.
 *
 * Ele substitui o layout inteiro, então traz o próprio `<html>`, as fontes, o
 * CSS e o script do tema. Não há "Ir para o Painel": com o layout raiz caído,
 * toda página cai junto, e tentar de novo é o que resta.
 */
export default function ErroGlobal({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    // A tela apanhou o erro, e o Sentry não o veria sozinho (`instrumentation-client.ts`).
    Sentry.captureException(error);
    console.error(error);
  }, [error]);

  return (
    <html lang="pt-BR" className={`${classesDasFontes} h-full antialiased`} suppressHydrationWarning>
      <head>
        <title>RepPlast</title>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <div className="aurora" aria-hidden="true" />
        <main className="flex-1 flex items-center justify-center px-4 py-10">
          <EstadoVazio
            icone={TriangleAlert}
            titulo="O RepPlast não carregou"
            acao={
              <Botao icone={RefreshCw} onClick={() => retry()}>
                Tentar de novo
              </Botao>
            }
          >
            Algo deu errado do nosso lado, e o que já estava salvo continua salvo. Tente de novo em
            instantes; se continuar acontecendo, fale com o suporte
            {error.digest ? (
              <>
                {" "}
                e informe o código <span className="font-mono text-tinta">{error.digest}</span>
              </>
            ) : null}
            .
          </EstadoVazio>
        </main>
      </body>
    </html>
  );
}
