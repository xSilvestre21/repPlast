"use client";

/**
 * Copia um texto para a área de transferência — para colar no WhatsApp ou no
 * e-mail sem selecionar à mão (os dados de pagamento da indústria, por exemplo).
 *
 * O "Copiado" volta a "Copiar" sozinho e é anunciado ao leitor de tela. Se o
 * navegador recusar (página sem HTTPS, permissão negada), a frase manda
 * selecionar e copiar: o texto continua na tela, selecionável.
 */

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";

import { Botao } from "@/components/ui";

const VOLTA_MS = 2000;

export function BotaoCopiar({ texto, rotulo = "Copiar" }: { texto: string; rotulo?: string }) {
  const [situacao, setSituacao] = useState<"pronto" | "copiado" | "falhou">("pronto");

  useEffect(() => {
    if (situacao !== "copiado") return;
    const espera = setTimeout(() => setSituacao("pronto"), VOLTA_MS);
    return () => clearTimeout(espera);
  }, [situacao]);

  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto);
      setSituacao("copiado");
    } catch {
      setSituacao("falhou");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Botao
        type="button"
        variante="secundaria"
        tamanho="compacto"
        icone={situacao === "copiado" ? Check : Copy}
        onClick={copiar}
      >
        {situacao === "copiado" ? "Copiado" : rotulo}
      </Botao>
      <span role="status" className="text-mini text-tinta-2 text-right empty:hidden">
        {situacao === "falhou" ? "Não deu para copiar. Selecione o texto e copie." : ""}
        {situacao === "copiado" && <span className="sr-only">Copiado para a área de transferência.</span>}
      </span>
    </div>
  );
}
