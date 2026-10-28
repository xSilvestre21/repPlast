"use client";

import * as Sentry from "@sentry/nextjs";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { useEffect } from "react";

import { Botao, BotaoLink, EstadoVazio } from "@/components/ui";

/**
 * A rede de segurança: o erro que nenhuma tela tratou.
 *
 * Antes dela, uma falha inesperada caía na página padrão do Next, em inglês e
 * sem caminho de volta. A mensagem original NÃO aparece aqui de propósito —
 * em produção o Next já a esconde (pode ter detalhe do banco), e o que serve a
 * quem está usando é saber que nada se perdeu e o que fazer agora.
 *
 * O código (`digest`) vai junto, pequeno, para o suporte achar o erro no log.
 */
export default function ErroInesperado({
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
    <div className="py-10">
      <EstadoVazio
        icone={TriangleAlert}
        titulo="Esta tela não carregou"
        acao={
          <div className="flex flex-wrap justify-center gap-2">
            <Botao icone={RefreshCw} onClick={() => retry()}>
              Tentar de novo
            </Botao>
            <BotaoLink href="/" variante="secundaria">
              Ir para o Painel
            </BotaoLink>
          </div>
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
    </div>
  );
}
