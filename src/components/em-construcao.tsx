import { HardHat } from "lucide-react";

import { Cabecalho, EstadoVazio } from "@/components/ui";

/**
 * Marcador honesto para as áreas ainda não implementadas. Existe para a
 * navegação funcionar inteira desde já, sem fingir que a tela está pronta.
 */
export function EmConstrucao({ titulo }: { titulo: string }) {
  return (
    <>
      <Cabecalho icone={HardHat} titulo={titulo} />
      <EstadoVazio icone={HardHat}>Esta parte ainda não foi construída.</EstadoVazio>
    </>
  );
}
