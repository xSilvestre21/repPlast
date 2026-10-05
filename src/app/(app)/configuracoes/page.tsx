import { Sparkles } from "lucide-react";

import { Pagina } from "@/components/pagina";
import { Botao, Cabecalho, SecaoCartao } from "@/components/ui";
import { CAMPOS_PUBLICOS_CONTA } from "@/lib/conta-email";
import { criptoConfigurada } from "@/lib/cripto";
import { MODELOS_DE_EMAIL } from "@/lib/tipos-de-email";
import { escopoAtual, sessaoAtual } from "@/lib/sessao";
import { nomeCompleto } from "@/lib/nome-usuario";

import {
  alternarReduzirAnimacoes,
  definirContaPadrao,
  excluirContaEmail,
  salvarCidade,
  salvarContaEmail,
  salvarMensagemEnvioPadrao,
  salvarObservacoesPadrao,
  testarContaEmail,
} from "./acoes";
import { FormCidade } from "./cidade";
import { SecaoContasEmail } from "./contas-email";
import { FormMensagemEnvio } from "./mensagem-envio";
import { FormObservacoesPadrao } from "./observacoes-padrao";

export default async function PaginaConfiguracoes() {
  const sessao = await sessaoAtual();
  const reduzidas = sessao?.reduzirAnimacoes ?? false;

  const { usuarioId, db } = await escopoAtual();
  const [usuario, contas] = await Promise.all([
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
  ]);

  return (
    <Pagina>
      <Cabecalho
        icone={Sparkles}
        titulo="Configurações"
        descricao="Preferências da sua conta."
      />

      <div className="space-y-5 palco">
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
      </div>
    </Pagina>
  );
}
