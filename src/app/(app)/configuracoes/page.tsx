import { KeyRound, Palette, Sparkles, Wind } from "lucide-react";

import { EscolhaTema } from "@/components/alternador-tema";

import { Pagina } from "@/components/pagina";
import { Botao, BotaoLink, Cabecalho, Mensagem, SecaoCartao } from "@/components/ui";
import { CAMPOS_PUBLICOS_CONTA } from "@/lib/conta-email";
import { criptoConfigurada } from "@/lib/cripto";
import { MODELOS_DE_EMAIL } from "@/lib/tipos-de-email";
import { escopoAtual, sessaoAtual } from "@/lib/sessao";
import { dataDaProximaTroca } from "@/lib/escritorio-regras";
import { situacaoDoNome } from "@/lib/nome-escritorio";
import { nomeCompleto } from "@/lib/nome-usuario";
import { trocaPendente } from "@/lib/troca-email";

import {
  alternarReduzirAnimacoes,
  definirAssinaturaPadrao,
  definirContaPadrao,
  excluirAssinaturaEmail,
  excluirContaEmail,
  pedirTrocaEmail,
  renomearEscritorio,
  salvarAssinaturaEmail,
  salvarCidade,
  salvarContaEmail,
  salvarMensagemEnvioPadrao,
  salvarObservacoesPadrao,
  salvarPerfil,
  testarContaEmail,
  trocarPlano,
} from "./acoes";
import { FormCidade } from "./cidade";
import { FormEmailLogin } from "./email-login";
import { FormNomeEscritorio } from "./escritorio";
import { SecaoContasEmail } from "./contas-email";
import { FormMensagemEnvio } from "./mensagem-envio";
import { FormObservacoesPadrao } from "./observacoes-padrao";
import { FormPerfil } from "./perfil";
import { CartaoPlano } from "./plano";
import { ItemConfiguracao, SecaoConfiguracao } from "./secao";
import { type SecaoDoIndice, SecoesConfiguracao } from "./secoes";

/**
 * Configurações, por seção: o que é da pessoa (Perfil), do escritório (só o
 * administrador), do envio por e-mail, do orçamento e da tela. O índice e a
 * busca moram em `secoes.tsx`; o `busca` de cada item são as palavras que a
 * pessoa procura e que o cartão não escreve.
 */
export default async function PaginaConfiguracoes({ searchParams }: PageProps<"/configuracoes">) {
  const sessao = await sessaoAtual();
  const reduzidas = sessao?.reduzirAnimacoes ?? false;
  const { email: aviso } = await searchParams;

  const { usuarioId, organizacaoId, ehAdmin, db } = await escopoAtual();
  const [usuario, contas, nomeEscritorio, organizacao, prepostosAtivos, emailPendente] = await Promise.all([
    db.usuario.findUnique({
      where: { id: usuarioId },
      select: {
        nome: true,
        sobrenome: true,
        email: true,
        telefone: true,
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
    // O nome e o plano são do escritório: só o administrador troca, e só ele vê a seção.
    ehAdmin ? situacaoDoNome(db, organizacaoId) : null,
    ehAdmin
      ? db.organizacao.findUnique({
          where: { id: organizacaoId },
          select: { plano: true, asaasAssinaturaId: true },
        })
      : null,
    ehAdmin ? db.usuario.count({ where: { organizacaoId, papel: "REPRESENTANTE", ativo: true } }) : 0,
    trocaPendente(usuarioId),
  ]);

  const secoes: SecaoDoIndice[] = [
    { id: "perfil", titulo: "Perfil", icone: "perfil" },
    ...(ehAdmin ? [{ id: "escritorio", titulo: "Escritório", icone: "escritorio" } as const] : []),
    { id: "email", titulo: "E-mail", icone: "email" },
    { id: "orcamento", titulo: "Orçamento", icone: "orcamento" },
    { id: "preferencias", titulo: "Preferências", icone: "preferencias" },
  ];

  return (
    <Pagina>
      <Cabecalho
        icone={Sparkles}
        titulo="Configurações"
        descricao={ehAdmin ? "Preferências da sua conta e do escritório." : "Preferências da sua conta."}
      />

      <SecoesConfiguracao secoes={secoes}>
        <SecaoConfiguracao id="perfil" titulo="Perfil">
          {aviso === "trocado" && (
            <Mensagem tom="verde">E-mail trocado. Da próxima vez, entre com {usuario?.email}.</Mensagem>
          )}

          <ItemConfiguracao busca="nome sobrenome telefone celular whatsapp cadastro corrigir digitação erro perfil">
            <FormPerfil
              nome={usuario?.nome ?? ""}
              sobrenome={usuario?.sobrenome ?? ""}
              telefone={usuario?.telefone ?? ""}
              ehAdmin={ehAdmin}
              salvar={salvarPerfil}
            />
          </ItemConfiguracao>

          <ItemConfiguracao busca="email login entrar acesso conta usuário trocar endereço perfil">
            <FormEmailLogin email={usuario?.email ?? ""} pendente={emailPendente} pedir={pedirTrocaEmail} />
          </ItemConfiguracao>

          <ItemConfiguracao busca="senha login acesso segurança trocar perfil">
            <SecaoCartao
              icone={KeyRound}
              titulo="Senha"
              descricao="Só você troca a sua senha — nem o administrador do escritório. Por segurança, o sistema pede a senha de novo depois de 7 dias sem uso, e 30 dias depois de entrar."
            >
              <BotaoLink href="/senha" variante="secundaria" icone={KeyRound}>
                Trocar minha senha
              </BotaoLink>
            </SecaoCartao>
          </ItemConfiguracao>
        </SecaoConfiguracao>

        {nomeEscritorio && organizacao && (
          <SecaoConfiguracao id="escritorio" titulo="Escritório">
            <ItemConfiguracao busca="nome escritório empresa marca logo topo razão">
              <FormNomeEscritorio
                nome={nomeEscritorio.nome}
                proximaTroca={
                  nomeEscritorio.proximaTroca ? dataDaProximaTroca(nomeEscritorio.proximaTroca) : null
                }
                salvar={renomearEscritorio}
              />
            </ItemConfiguracao>

            <ItemConfiguracao busca="plano assinatura mensalidade pagamento pagar cobrança fatura preço valor solo max preposto prepostos upgrade mudar trocar cartão">
              <CartaoPlano
                plano={organizacao.plano}
                prepostosAtivos={prepostosAtivos}
                temCobranca={organizacao.asaasAssinaturaId !== null}
                trocar={trocarPlano.bind(null, organizacao.plano === "PLUS" ? "PADRAO" : "PLUS")}
              />
            </ItemConfiguracao>
          </SecaoConfiguracao>
        )}

        <SecaoConfiguracao id="email" titulo="E-mail">
          <ItemConfiguracao busca="email caixa conta contas smtp gmail outlook hotmail envio enviar remetente assinatura assinaturas">
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
                adicionarAssinatura: salvarAssinaturaEmail.bind(null, conta.id, null),
                assinaturas: conta.assinaturas.map((assinatura) => ({
                  ...assinatura,
                  salvar: salvarAssinaturaEmail.bind(null, conta.id, assinatura.id),
                  tornarPadrao: definirAssinaturaPadrao.bind(null, assinatura.id),
                  excluir: excluirAssinaturaEmail.bind(null, assinatura.id),
                })),
              }))}
            />
          </ItemConfiguracao>

          <ItemConfiguracao busca="mensagem mensagens texto padrão assunto email pedido pedidos envio enviar indústria">
            <FormMensagemEnvio
              tipo="pedido"
              assunto={usuario?.assuntoEnvioPadrao ?? MODELOS_DE_EMAIL.pedido.assuntoPadrao}
              mensagem={usuario?.mensagemEnvioPadrao ?? MODELOS_DE_EMAIL.pedido.mensagemPadrao}
              salvar={salvarMensagemEnvioPadrao.bind(null, "pedido")}
            />
          </ItemConfiguracao>
        </SecaoConfiguracao>

        <SecaoConfiguracao id="orcamento" titulo="Orçamento">
          <ItemConfiguracao busca="cidade município cabeçalho proposta propostas orçamento orçamentos">
            <FormCidade valor={usuario?.municipio ?? ""} salvar={salvarCidade} />
          </ItemConfiguracao>

          <ItemConfiguracao busca="observação observações condição condições padrão texto icms frete prazo entrega pagamento proposta propostas orçamento orçamentos">
            <FormObservacoesPadrao
              valor={usuario?.observacoesPadrao ?? ""}
              salvar={salvarObservacoesPadrao}
            />
          </ItemConfiguracao>

          {/* Junto das condições: é o outro texto que toda proposta leva. */}
          <ItemConfiguracao busca="mensagem mensagens texto padrão assunto email proposta propostas orçamento orçamentos envio enviar cliente">
            <FormMensagemEnvio
              tipo="orcamento"
              assunto={usuario?.assuntoOrcamentoPadrao ?? MODELOS_DE_EMAIL.orcamento.assuntoPadrao}
              mensagem={usuario?.mensagemOrcamentoPadrao ?? MODELOS_DE_EMAIL.orcamento.mensagemPadrao}
              salvar={salvarMensagemEnvioPadrao.bind(null, "orcamento")}
            />
          </ItemConfiguracao>
        </SecaoConfiguracao>

        <SecaoConfiguracao id="preferencias" titulo="Preferências">
          <ItemConfiguracao busca="tema claro escuro automático sistema modo noturno cor cores aparência preferência">
            <SecaoCartao
              icone={Palette}
              titulo="Tema"
              descricao="Automático segue o modo claro ou escuro do celular (ou do computador). Claro e Escuro fixam, e valem só para este navegador. O sol e a lua, no alto da tela, também fixam."
            >
              <EscolhaTema />
            </SecaoCartao>
          </ItemConfiguracao>

          <ItemConfiguracao busca="animação animações movimento confete acessibilidade efeito efeitos tela preferência">
            <SecaoCartao icone={Wind} titulo="Animações" descricao="Como a interface se move para você.">
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
          </ItemConfiguracao>
        </SecaoConfiguracao>
      </SecoesConfiguracao>
    </Pagina>
  );
}
