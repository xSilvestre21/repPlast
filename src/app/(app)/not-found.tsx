import { SearchX } from "lucide-react";

import { BotaoLink, EstadoVazio } from "@/components/ui";

/**
 * O `notFound()` das fichas — cliente, pedido, proposta apagados ou de outro
 * escritório. Fica dentro do layout, com a navegação, para a pessoa seguir
 * dali; a página padrão do Next era em inglês e sem menu.
 */
export default function NaoEncontrado() {
  return (
    <div className="py-10">
      <EstadoVazio
        icone={SearchX}
        titulo="Não encontramos esta página"
        acao={<BotaoLink href="/">Ir para o Painel</BotaoLink>}
      >
        O cadastro pode ter sido excluído, ou o endereço está incompleto. Use o menu acima para
        procurar de novo.
      </EstadoVazio>
    </div>
  );
}
