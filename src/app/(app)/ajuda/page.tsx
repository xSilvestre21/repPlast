import { LifeBuoy } from "lucide-react";

import { Pagina } from "@/components/pagina";
import { Cabecalho } from "@/components/ui";
import { escopoAtual } from "@/lib/sessao";

import { Ajuda } from "./ajuda";
import { temasPara } from "./temas";

export const metadata = { title: "Ajuda" };

/**
 * Ajuda: as dúvidas mais comuns, com demonstrações, e o contato do suporte.
 *
 * Quais temas aparecem se decide aqui, no servidor: o preposto não recebe o
 * que só o administrador configura (e-mail, plano, rateio).
 */
export default async function PaginaAjuda() {
  const { ehAdmin, plano } = await escopoAtual();
  const temas = temasPara({ ehAdmin, temPrepostos: plano === "PLUS" });

  return (
    <Pagina>
      <Cabecalho
        icone={LifeBuoy}
        titulo="Ajuda"
        descricao="Como cada parte do sistema funciona — mexa nos exemplos para ver a conta acontecer."
      />
      <Ajuda temas={temas} ehAdmin={ehAdmin} />
    </Pagina>
  );
}
