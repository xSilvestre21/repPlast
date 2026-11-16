"use client";

/**
 * "✓ Acerto salvo", embaixo do botão da linha, depois que a janela fecha.
 *
 * Salvar fecha a janela, e a linha muda (o recebido aparece, o botão vira "Ver
 * acerto") — mas quem usa pouco o computador não sabia se o clique tinha dado
 * certo. A frase fica uns segundos e some sozinha.
 *
 * A caixa `role="status"` existe sempre, mesmo vazia: o leitor de tela só
 * anuncia o que MUDA dentro de uma região que já estava lá.
 */

import { Check } from "lucide-react";
import { useEffect, useState } from "react";

const DURACAO_MS = 6000;

export function useAvisoDeSalvo() {
  // A vez conta: salvar duas vezes seguidas com a mesma frase recomeça o tempo.
  const [aviso, setAviso] = useState<{ texto: string; vez: number } | null>(null);

  useEffect(() => {
    if (!aviso) return;
    const tempo = window.setTimeout(() => setAviso(null), DURACAO_MS);
    return () => window.clearTimeout(tempo);
  }, [aviso]);

  return {
    aviso: aviso?.texto ?? null,
    avisar: (texto: string) => setAviso((anterior) => ({ texto, vez: (anterior?.vez ?? 0) + 1 })),
  };
}

export function AvisoDeSalvo({ aviso }: { aviso: string | null }) {
  return (
    <span role="status" className="block">
      {aviso && (
        <span className="surgir mt-1.5 inline-flex items-center justify-end gap-1 text-rotulo font-medium text-verde">
          <Check size={13} strokeWidth={2.5} aria-hidden="true" />
          {aviso}
        </span>
      )}
    </span>
  );
}
