import type { Metadata } from "next";
import Link from "next/link";

import {
  Clausula,
  Itens,
  PaginaLegal,
} from "@/components/entrada/pagina-legal";
import { CONTROLADOR } from "@/lib/lgpd";

export const metadata: Metadata = {
  title: "Política de Privacidade — RepPlast",
};

/**
 * A Política de Privacidade (LGPD, arts. 6º, 9º e 18): o que o RepPlast guarda,
 * para quê, com quem divide, como protege e como pedir de volta.
 *
 * Cada frase aqui descreve o que o sistema FAZ — se o código mudar o que guarda
 * ou com quem fala, este texto muda junto e `VERSAO_TERMOS` sobe.
 */
export default function PaginaPrivacidade() {
  return (
    <PaginaLegal
      titulo="Política de Privacidade"
      resumo="O que o RepPlast guarda sobre você e o seu escritório, para que serve, com quem é dividido e como você pede para ver, corrigir ou apagar."
    >
      <Clausula numero={1} titulo="Quem cuida dos seus dados">
        <p>
          O RepPlast é mantido por{" "}
          <strong className="text-tinta">{CONTROLADOR.nome}</strong>, o
          controlador dos dados pessoais tratados no sistema, nos termos da Lei
          Geral de Proteção de Dados (Lei nº 13.709/2018, a LGPD).
        </p>
        <p>
          Para qualquer assunto sobre os seus dados — inclusive como encarregado
          (art. 41) —, o canal é{" "}
          <a
            href={`mailto:${CONTROLADOR.email}`}
            className="text-carimbo underline underline-offset-4"
          >
            {CONTROLADOR.email}
          </a>
          .
        </p>
      </Clausula>

      <Clausula numero={2} titulo="O que guardamos">
        <Itens>
          <li>
            <strong className="text-tinta">Da sua conta:</strong> nome do
            escritório, seu nome, e-mail, celular e senha. A senha nunca é
            guardada como você digitou — só um código embaralhado (hash) que não
            dá para desfazer.
          </li>
          <li>
            <strong className="text-tinta">Da cobrança:</strong> CPF ou CNPJ,
            CEP, endereço, número, bairro e complemento de quem paga a
            assinatura. Os dados do cartão são digitados na página do Asaas e{" "}
            <strong className="text-tinta">nunca passam pelo RepPlast</strong>.
          </li>
          <li>
            <strong className="text-tinta">Do aceite:</strong> a data e a versão
            destes termos que você aceitou, como prova do consentimento.
          </li>
          <li>
            <strong className="text-tinta">De segurança:</strong> o endereço IP
            e o horário de senhas erradas e de pedidos de nova senha, para
            limitar tentativas de invasão.
          </li>
          <li>
            <strong className="text-tinta">
              O que você cadastra no sistema:
            </strong>{" "}
            clientes, indústrias, produtos, pedidos, orçamentos, comissões,
            compromissos e as contas de e-mail que você liga ao sistema para
            enviar pedidos (a senha dessas contas fica cifrada).
          </li>
        </Itens>
      </Clausula>

      <Clausula numero={3} titulo="Para que usamos, e com que base na lei">
        <Itens>
          <li>
            Criar e manter a sua conta e entregar o que o sistema faz — execução
            do contrato (art. 7º, V).
          </li>
          <li>
            Cobrar a assinatura mensal — execução do contrato (art. 7º, V).
          </li>
          <li>
            Mandar os e-mails do próprio sistema, como o link de nova senha e o
            aviso de senha trocada — execução do contrato (art. 7º, V).
          </li>
          <li>
            Proteger as contas contra acesso indevido — legítimo interesse (art.
            7º, IX), limitado ao necessário.
          </li>
          <li>
            Guardar registros que a lei exige, como os de cobrança — obrigação
            legal (art. 7º, II).
          </li>
        </Itens>
        <p>
          Não vendemos, alugamos nem usamos os seus dados para publicidade. Não
          há rastreadores de anúncio no RepPlast.
        </p>
      </Clausula>

      <Clausula numero={4} titulo="Com quem dividimos">
        <p>
          Só com quem é necessário para o serviço funcionar, e só o necessário:
        </p>
        <Itens>
          <li>
            <strong className="text-tinta">Asaas</strong> (instituição de
            pagamento): nome, e-mail, celular, CPF/CNPJ e endereço de quem paga,
            para emitir a cobrança.
          </li>
          <li>
            <strong className="text-tinta">ViaCEP</strong>: só o CEP digitado no
            cadastro, para preencher o endereço.
          </li>
          <li>
            <strong className="text-tinta">Provedores de e-mail</strong>: os
            e-mails do sistema saem por um serviço de e-mail; os pedidos que
            você envia saem pela sua própria caixa.
          </li>
          <li>
            <strong className="text-tinta">Hospedagem e banco de dados</strong>:
            onde o sistema roda e os dados ficam guardados.
          </li>
          <li>Autoridades, quando a lei ou uma ordem judicial exigir.</li>
        </Itens>
      </Clausula>

      <Clausula numero={5} titulo="Os dados dos seus clientes">
        <p>
          Os dados que você cadastra sobre os seus clientes e contatos são do
          seu escritório: quanto a eles, o seu escritório é o controlador, e o
          RepPlast atua como operador (art. 5º, VII) — trata esses dados só para
          prestar o serviço a você, conforme as suas instruções, e nunca para
          outro fim.
        </p>
      </Clausula>

      <Clausula numero={6} titulo="Como protegemos">
        <Itens>
          <li>
            Cada escritório é isolado dos outros no próprio banco de dados (Row
            Level Security): um escritório não consegue ler os dados de outro,
            nem por erro do sistema.
          </li>
          <li>
            Senhas guardadas só como hash; senhas das contas de e-mail,
            cifradas.
          </li>
          <li>Conexão cifrada (HTTPS) entre o seu navegador e o sistema.</li>
          <li>
            Limite de tentativas de senha e links de nova senha que valem uma
            vez só, por 1 hora.
          </li>
          <li>
            Acesso aos dados restrito a quem mantém o sistema, e só quando
            necessário.
          </li>
        </Itens>
        <p>
          Se acontecer um incidente de segurança que possa trazer risco a você,
          avisaremos você e a Autoridade Nacional de Proteção de Dados (ANPD),
          como manda o art. 48.
        </p>
      </Clausula>

      <Clausula numero={7} titulo="Por quanto tempo">
        <p>
          Enquanto a sua conta existir. Pedido o encerramento, os dados são
          apagados em até 30 dias — menos o que a lei obriga a guardar por mais
          tempo, como os registros de cobrança, mantidos só pelo prazo legal. Os
          registros de senha errada são apagados em 24 horas.
        </p>
      </Clausula>

      <Clausula numero={8} titulo="Os seus direitos">
        <p>
          Pelo art. 18 da LGPD, você pode pedir a qualquer momento, sem custo:
        </p>
        <Itens>
          <li>confirmação de que tratamos os seus dados, e acesso a eles;</li>
          <li>correção de dados incompletos, errados ou desatualizados;</li>
          <li>
            anonimização, bloqueio ou eliminação do que for desnecessário ou
            excessivo;
          </li>
          <li>portabilidade dos seus dados para outro serviço;</li>
          <li>informação sobre com quem os dados foram divididos;</li>
          <li>
            eliminação dos dados e revogação do consentimento, com o
            encerramento da conta.
          </li>
        </Itens>
        <p>
          Escreva para{" "}
          <a
            href={`mailto:${CONTROLADOR.email}`}
            className="text-carimbo underline underline-offset-4"
          >
            {CONTROLADOR.email}
          </a>{" "}
          a partir do e-mail da sua conta. Respondemos em até 15 dias. Se não
          ficar satisfeito, você pode reclamar à ANPD (gov.br/anpd).
        </p>
      </Clausula>

      <Clausula numero={9} titulo="Cookies">
        <p>
          O RepPlast usa um único cookie, o da sessão, que mantém você conectado
          e é indispensável para o sistema funcionar. Preferências como o tema
          claro ou escuro ficam guardadas no seu próprio navegador. Não usamos
          cookies de publicidade nem de rastreamento.
        </p>
      </Clausula>

      <Clausula numero={10} titulo="Mudanças nesta política">
        <p>
          Se esta política mudar, a data no topo muda junto, e mudanças
          importantes serão avisadas por e-mail ou no sistema. O uso do RepPlast
          também segue os{" "}
          <Link
            href="/termos"
            className="text-carimbo underline underline-offset-4"
          >
            Termos de Uso
          </Link>
          .
        </p>
      </Clausula>
    </PaginaLegal>
  );
}
