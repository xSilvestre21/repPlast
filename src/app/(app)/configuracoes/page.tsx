import { Sparkles } from "lucide-react";

import { Pagina } from "@/components/pagina";
import { Botao, Cabecalho, SecaoCartao } from "@/components/ui";
import { sessaoAtual } from "@/lib/sessao";

import { alternarReduzirAnimacoes } from "./acoes";

export default async function PaginaConfiguracoes() {
  const sessao = await sessaoAtual();
  const reduzidas = sessao?.reduzirAnimacoes ?? false;

  return (
    <Pagina>
      <Cabecalho
        icone={Sparkles}
        titulo="Configurações"
        descricao="Preferências da sua conta."
      />

      <SecaoCartao titulo="Animações" descricao="Como a interface se move para você.">
        <p className="text-corpo text-tinta-2 mb-4">
          Desliga a troca de aba, o confete de meta batida, a aurora de fundo, o
          esqueleto de carregamento e a barra de progresso. O resto da tela
          continua igual — só o movimento some.
        </p>

        <form action={alternarReduzirAnimacoes}>
          <Botao type="submit" variante="secundaria">
            {reduzidas ? "Reativar animações" : "Desativar animações"}
          </Botao>
        </form>
      </SecaoCartao>
    </Pagina>
  );
}
