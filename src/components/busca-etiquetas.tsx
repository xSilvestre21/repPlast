"use client";

import { Search } from "lucide-react";

import { CLASSE_CONTROLE } from "./ui";

/** Até quantas etiquetas elas bastam; acima disso aparece a busca. */
export const LIMITE_SEM_BUSCA = 6;

/**
 * A caixa que filtra a lista de dentro da folha, no celular (`SelecaoEtiquetas`,
 * nos aditivos).
 *
 * Só digita: quem filtra é a tela.
 */
export function BuscaEtiquetas({
  rotulo,
  placeholder,
  value,
  onChange,
}: {
  rotulo: string;
  placeholder: string;
  value: string;
  onChange: (texto: string) => void;
}) {
  return (
    <label className="block">
      <span className="sr-only">{rotulo}</span>
      <div className="relative">
        <Search
          size={15}
          strokeWidth={2}
          aria-hidden="true"
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tinta-3 pointer-events-none"
        />
        <input
          type="search"
          enterKeyHint="search"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          autoComplete="off"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            // Enter aqui é "achei", não "salvar o produto".
            if (e.key === "Enter") e.preventDefault();
          }}
          placeholder={placeholder}
          className={`${CLASSE_CONTROLE} pl-10`}
        />
      </div>
    </label>
  );
}
