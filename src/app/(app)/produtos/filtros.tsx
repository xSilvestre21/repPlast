/**
 * Busca e filtro do catálogo de produtos.
 *
 * É um `<form method="get">` puro, sem JavaScript: os filtros viram parâmetros
 * de URL, então a busca dá para guardar nos favoritos, abrir em aba nova e
 * mandar por mensagem — e continua funcionando com a aba carregando.
 *
 * O filtro por MEDIDA existe porque é assim que se procura um saco: ninguém
 * lembra a descrição inteira, lembra "aquele de 90 por 160". O sistema
 * anterior tinha esse filtro num cartão próprio, e era o caminho mais usado
 * para achar produto num catálogo de 444.
 */

import { Search, X } from "lucide-react";

import { Botao, BotaoLink, CLASSE_CONTROLE } from "@/components/ui";

export type FiltrosProduto = {
  busca: string;
  larguraCm: string;
  comprimentoCm: string;
  espessuraMm: string;
  incluirInativos: boolean;
};

export function FiltrosProdutos({ filtros }: { filtros: FiltrosProduto }) {
  const algumFiltro =
    Boolean(filtros.busca) ||
    Boolean(filtros.larguraCm) ||
    Boolean(filtros.comprimentoCm) ||
    Boolean(filtros.espessuraMm) ||
    filtros.incluirInativos;

  return (
    <form method="get" className="mb-5">
      <div className="folha p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex-1 min-w-56">
            <span className="rotulo block mb-1.5 text-tinta-2">Buscar</span>
            <div className="relative">
              <Search
                size={15}
                strokeWidth={2}
                aria-hidden="true"
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-tinta-3 pointer-events-none"
              />
              <input
                type="search"
                name="busca"
                defaultValue={filtros.busca}
                placeholder="Descrição, material, cliente, indústria ou código"
                className={`${CLASSE_CONTROLE} pl-10`}
              />
            </div>
          </label>

          <Botao type="submit" variante="secundaria" icone={Search}>
            Buscar
          </Botao>

          {algumFiltro && (
            <BotaoLink href="/produtos" variante="secundaria" icone={X} tamanho="compacto">
              Limpar
            </BotaoLink>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <span className="rotulo self-center pb-2.5">Medidas do saco</span>

          {(
            [
              { name: "l", rotulo: "Largura (cm)", valor: filtros.larguraCm, exemplo: "90" },
              { name: "c", rotulo: "Comprimento (cm)", valor: filtros.comprimentoCm, exemplo: "160" },
              { name: "e", rotulo: "Espessura (mm)", valor: filtros.espessuraMm, exemplo: "0,055" },
            ] as const
          ).map((campo) => (
            <label key={campo.name} className="basis-32 grow-0">
              <span className="rotulo block mb-1.5 text-tinta-2">{campo.rotulo}</span>
              <input
                name={campo.name}
                inputMode="decimal"
                defaultValue={campo.valor}
                placeholder={campo.exemplo}
                className={`${CLASSE_CONTROLE} numerico text-right`}
              />
            </label>
          ))}

          <label className="flex items-center gap-2 text-corpo text-tinta-2 cursor-pointer self-center pb-2.5">
            <input
              type="checkbox"
              name="inativos"
              value="1"
              defaultChecked={filtros.incluirInativos}
              className="accent-carimbo"
            />
            Mostrar inativos
          </label>
        </div>
      </div>
    </form>
  );
}
