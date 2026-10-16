import { KeyRound } from "lucide-react";

import { Pagina } from "@/components/pagina";
import { Cabecalho, Cartao } from "@/components/ui";
import { escopoAtual } from "@/lib/sessao";

import { trocarMinhaSenha } from "./acoes";
import { FormularioSenha } from "./formulario";

/**
 * A troca da própria senha, para todo usuário. É também onde o preposto cai
 * ao entrar com a senha inicial que o administrador criou
 * (`?primeiro-acesso=1`, mandado pelo login): o mesmo formulário, com
 * boas-vindas e um "Agora não".
 */
export default async function PaginaSenha({ searchParams }: PageProps<"/senha">) {
  const { usuarioId, db } = await escopoAtual();
  const pedido = await searchParams;

  const usuario = await db.usuario.findUnique({
    where: { id: usuarioId },
    select: { nome: true, senhaProvisoria: true },
  });
  // Sem a senha inicial, não há "primeiro acesso" a sugerir — vale a troca comum.
  const primeiroAcesso = pedido["primeiro-acesso"] === "1" && usuario?.senhaProvisoria === true;

  return (
    <Pagina>
      <Cabecalho
        icone={KeyRound}
        titulo={primeiroAcesso ? `Boas-vindas, ${usuario?.nome}!` : "Sua senha"}
        descricao={
          primeiroAcesso
            ? "Você entrou com a senha inicial que o administrador do escritório criou. Que tal trocar agora por uma senha só sua? Depois disso, só você poderá trocá-la."
            : "Só você troca a sua senha. Para trocar, confirme a atual."
        }
        voltar={primeiroAcesso ? undefined : { href: "/configuracoes", rotulo: "Configurações" }}
      />
      <Cartao className="p-5 sm:p-6">
        <FormularioSenha acao={trocarMinhaSenha} primeiroAcesso={primeiroAcesso} />
      </Cartao>
    </Pagina>
  );
}
