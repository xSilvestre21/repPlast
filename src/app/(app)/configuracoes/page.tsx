import { KeyRound, Sparkles } from "lucide-react";

import { Pagina } from "@/components/pagina";
import { Botao, BotaoLink, Cabecalho, SecaoCartao } from "@/components/ui";
import { CAMPOS_PUBLICOS_CONTA } from "@/lib/conta-email";
import { criptoConfigurada } from "@/lib/cripto";
import { MODELOS_DE_EMAIL } from "@/lib/tipos-de-email";
import { escopoAtual, sessaoAtual } from "@/lib/sessao";
import { dataDaProximaTroca } from "@/lib/escritorio-regras";
import { situacaoDoNome } from "@/lib/nome-escritorio";
import { nomeCompleto } from "@/lib/nome-usuario";

import {
  alternarReduzirAnimacoes,
  definirContaPadrao,
  excluirContaEmail,
  renomearEscritorio,
  salvarCidade,
  salvarContaEmail,
  salvarMensagemEnvioPadrao,
  salvarObservacoesPadrao,
  testarContaEmail,
} from "./acoes";
import { FormCidade } from "./cidade";
import { FormNomeEscritorio } from "./escritorio";
import { SecaoContasEmail } from "./contas-email";
import { FormMensagemEnvio } from "./mensagem-envio";
import { FormObservacoesPadrao } from "./observacoes-padrao";

export default async function PaginaConfiguracoes() {
  const sessao = await sessaoAtual();
  const reduzidas = sessao?.reduzirAnimacoes ?? false;

  const { usuarioId, organizacaoId, ehAdmin, db } = await escopoAtual();
  const [usuario, contas, nomeEscritorio] = await Promise.all([
    db.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        nome: true,
        sobrenome: true,
        email: true,
        observacoesPadrao: true,
        municipio: true,
        assuntoEnvioPadrao: true,
        mensagemEnvioPadrao: true,
        assuntoOrcamentoPadrao: true,
        mensagemOrcamentoPadrao: true,
      },
    }),
    db.contaEmail.findMany({
      where: { usuarioId },
      orderBy: [{ padrao: "desc" }, { criadoEm: "asc" }],
      select: CAMPOS_PUBLICOS_CONTA,
    }),
    // O nome é do escritório: só o administrador troca, e só ele vê a seção.
    ehAdmin ? situacaoDoNome(db, organizacaoId) : null,
  ]);

  return (
    <Pagina>
      <Cabecalho
        icone={Sparkles}
        titulo="Configurações"
        descricao={ehAdmin ? "Preferências da sua conta e do escritório." : "Preferências da sua conta."}
      />

      <div className="space-y-5 palco">
        {nomeEscritorio && (
          <FormNomeEscritorio
            nome={nomeEscritorio.nome}
            proximaTroca={
              nomeEscritorio.proximaTroca ? dataDaProximaTroca(nomeEscritorio.proximaTroca) : null
            }
            salvar={renomearEscritorio}
          />
        )}

        <SecaoContasEmail
          nomeUsuario={usuario ? nomeCompleto(usuario) : ""}
          emailUsuario={usuario?.email ?? ""}
          criptoConfigurada={criptoConfigurada()}
          adicionar={salvarContaEmail.bind(null, null)}
          contas={contas.map((conta) => ({
            ...conta,
            testadaEm: conta.testadaEm?.toISOString() ?? null,
            salvar: salvarContaEmail.bind(null, conta.id),
            testar: testarContaEmail.bind(null, conta.id),
            tornarPadrao: definirContaPadrao.bind(null, conta.id),
            excluir: excluirContaEmail.bind(null, conta.id),
          }))}
        />

        <FormMensagemEnvio
          tipo="pedido"
          assunto={usuario?.assuntoEnvioPadrao ?? MODELOS_DE_EMAIL.pedido.assuntoPadrao}
          mensagem={usuario?.mensagemEnvioPadrao ?? MODELOS_DE_EMAIL.pedido.mensagemPadrao}
          salvar={salvarMensagemEnvioPadrao.bind(null, "pedido")}
        />

        <FormCidade valor={usuario?.municipio ?? ""} salvar={salvarCidade} />

        <FormObservacoesPadrao
          valor={usuario?.observacoesPadrao ?? ""}
          salvar={salvarObservacoesPadrao}
        />

        {/* Junto das condições: é o outro texto que toda proposta leva. */}
        <FormMensagemEnvio
          tipo="orcamento"
          assunto={usuario?.assuntoOrcamentoPadrao ?? MODELOS_DE_EMAIL.orcamento.assuntoPadrao}
          mensagem={usuario?.mensagemOrcamentoPadrao ?? MODELOS_DE_EMAIL.orcamento.mensagemPadrao}
          salvar={salvarMensagemEnvioPadrao.bind(null, "orcamento")}
        />

        <SecaoCartao
          icone={KeyRound}
          titulo="Senha"
          descricao="Só você troca a sua senha — nem o administrador do escritório."
        >
          <BotaoLink href="/senha" variante="secundaria" icone={KeyRound}>
            Trocar minha senha
          </BotaoLink>
        </SecaoCartao>

        <SecaoCartao titulo="Animações" descricao="Como a interface se move para você.">
          <p className="text-corpo text-tinta-2 mb-4">
            Desliga a troca de aba, o confete de meta batida, o avião do pedido enviado, o
            esqueleto de carregamento e a barra de progresso. O resto da tela
            continua igual — só o movimento some.
          </p>

          <form action={alternarReduzirAnimacoes}>
            <Botao type="submit" variante="secundaria">
              {reduzidas ? "Reativar animações" : "Desativar animações"}
            </Botao>
          </form>
        </SecaoCartao>
      </div>
    </Pagina>
  );
}
