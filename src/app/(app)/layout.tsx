import { redirect } from "next/navigation";

import { EsquecerBuscas } from "@/components/esquecer-buscas";
import { GuardaDaAba } from "@/components/guarda-da-aba";
import { Navegacao } from "@/components/navegacao";
import { SCRIPT_ABA } from "@/lib/aba";
import { sessaoAtual } from "@/lib/sessao";

/**
 * Tudo que está sob este layout exige login.
 *
 * O guarda mora aqui, e não em cada página, porque um esquecimento numa página
 * nova viraria acesso sem sessão. As rotas de arquivo (PDF do pedido, logo da
 * indústria) não passam por layout e por isso se protegem sozinhas, chamando
 * `organizacaoAtual()`, que lança sem sessão.
 */
export default async function LayoutApp({ children }: LayoutProps<"/">) {
  const sessao = await sessaoAtual();

  if (!sessao) redirect("/entrar");
  // Pagamento pendente, atrasado ou cancelado: a tela de assinatura explica o
  // que houve e reabre o pagamento. As ações e as rotas de arquivo têm a mesma
  // barreira em `sessao.ts`, para quem chegar sem passar por aqui.
  if (sessao.assinatura !== "ATIVA") redirect("/assinatura");

  return (
    <>
      {/*
        Antes de tudo que mostra dados: a guia reaberta sem login fica
        escondida até `GuardaDaAba` decidir.

        O script vai como HTML pronto, e não como `<script>` do React: o
        navegador o executa ao ler a página, que é o único momento em que ele
        serve. Na navegação do cliente (o login chegando ao sistema), um
        `<script>` do React não roda e acusa um erro no console a cada login;
        dentro do `innerHTML` ele também não roda, mas calado — e ali quem
        confere é o `GuardaDaAba`.
      */}
      <div hidden dangerouslySetInnerHTML={{ __html: `<script>${SCRIPT_ABA}</script>` }} />
      <GuardaDaAba />
      <EsquecerBuscas />
      <Navegacao
        nomeUsuario={sessao.nome}
        nomeOrganizacao={sessao.organizacaoNome}
        mostrarPrepostos={sessao.papel === "ADMIN" && sessao.plano === "PLUS"}
      />
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
    </>
  );
}
