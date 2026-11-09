import { redirect } from "next/navigation";

import { EsquecerBuscas } from "@/components/esquecer-buscas";
import { FaixaDoTeste } from "@/components/faixa-do-teste";
import { GuardaDaAba } from "@/components/guarda-da-aba";
import { Navegacao } from "@/components/navegacao";
import { formatarMoeda } from "@/components/ui";
import { SCRIPT_ABA } from "@/lib/aba";
import { assinaturaLiberada } from "@/lib/acesso-assinatura";
import { valorMensal } from "@/lib/planos";
import { escopoAtual, sessaoAtual, type Sessao } from "@/lib/sessao";
import { diasDeTesteRestantes, emTesteGratis, escreverDia, ultimoDiaGratis } from "@/lib/teste-gratis";

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
  // Pagamento pendente, atrasado ou cancelado (passado o mês já pago): a tela
  // de assinatura explica o que houve e reabre o pagamento. As ações e as
  // rotas de arquivo têm a mesma barreira em `sessao.ts`, para quem chegar sem
  // passar por aqui.
  if (!assinaturaLiberada(sessao)) redirect("/assinatura");

  const teste = await faixaDoTeste(sessao);

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
        {teste && <FaixaDoTeste {...teste} />}
        {children}
      </main>
    </>
  );
}

/**
 * Os dados da faixa dos 7 dias grátis, para o administrador em teste — `null`
 * para todo o resto. O valor é o que o escritório tem hoje (plano e prepostos
 * ativos), que é o que a primeira cobrança leva (`lib/mensalidade.ts`).
 */
async function faixaDoTeste(sessao: Sessao) {
  if (sessao.papel !== "ADMIN" || !sessao.testeAte || !emTesteGratis(sessao)) return null;

  const { db, organizacaoId } = await escopoAtual();
  const ativos = await db.usuario.count({ where: { organizacaoId, papel: "REPRESENTANTE", ativo: true } });

  return {
    dias: diasDeTesteRestantes(sessao.testeAte),
    ultimoDia: ultimoDiaGratis(sessao.testeAte, { curto: true }),
    cobranca: escreverDia(sessao.testeAte, { curto: true }),
    valor: formatarMoeda(valorMensal(sessao.plano, ativos).toString()),
  };
}
