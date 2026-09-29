import { Sparkles } from "lucide-react";

import { Pagina } from "@/components/pagina";
import { Botao, Cabecalho, SecaoCartao } from "@/components/ui";
import { CAMPOS_PUBLICOS_CONTA } from "@/lib/conta-email";
import { criptoConfigurada } from "@/lib/cripto";
import { ASSUNTO_ENVIO_PADRAO, MENSAGEM_ENVIO_PADRAO } from "@/lib/envio-pedido";
import { escopoAtual, sessaoAtual } from "@/lib/sessao";

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
        email: true,
        observacoesPadrao: true,
        municipio: true,
        assuntoEnvioPadrao: true,
        mensagemEnvioPadrao: true,
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
          nomeUsuario={usuario?.nome ?? ""}
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
          assunto={usuario?.assuntoEnvioPadrao ?? ASSUNTO_ENVIO_PADRAO}
          mensagem={usuario?.mensagemEnvioPadrao ?? MENSAGEM_ENVIO_PADRAO}
          salvar={salvarMensagemEnvioPadrao}
        />

        <FormCidade valor={usuario?.municipio ?? ""} salvar={salvarCidade} />

        <FormObservacoesPadrao
          valor={usuario?.observacoesPadrao ?? ""}
          salvar={salvarObservacoesPadrao}
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
