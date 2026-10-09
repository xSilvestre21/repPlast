import { SearchX } from "lucide-react";

import { BotaoLink, EstadoVazio } from "@/components/ui";

/**
 * Endereço que não existe em lugar nenhum — link velho, digitado errado.
 * Fora do layout autenticado, então sem menu: o caminho de volta é o botão.
 */
export default function NaoEncontrado() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-16">
      <EstadoVazio
        icone={SearchX}
        titulo="Não encontramos esta página"
        acao={<BotaoLink href="/">Voltar ao início</BotaoLink>}
      >
        O endereço pode estar incompleto ou ter mudado. Confira o link, ou volte ao início e
        procure pelo menu.
      </EstadoVazio>
    </main>
  );
}
