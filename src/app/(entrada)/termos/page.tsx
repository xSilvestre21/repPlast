import type { Metadata } from "next";
import Link from "next/link";

import { Clausula, Itens, PaginaLegal } from "@/components/entrada/pagina-legal";
import { CONTROLADOR } from "@/lib/lgpd";

export const metadata: Metadata = { title: "Termos de Uso — RepPlast" };

/** As regras do serviço, aceitas no cadastro junto com a Política de Privacidade. */
export default function PaginaTermos() {
  return (
    <PaginaLegal
      titulo="Termos de Uso"
      resumo="As regras para usar o RepPlast: o que o sistema entrega, o que cabe a você, como funciona a assinatura e como encerrar."
    >
      <Clausula numero={1} titulo="O serviço">
        <p>
          O RepPlast é um sistema on-line para representantes comerciais de embalagens plásticas:
          cadastro de clientes, indústrias e produtos, cálculo de preço, pedidos e orçamentos em PDF,
          envio por e-mail e acompanhamento de comissões. É mantido por {CONTROLADOR.nome} (&quot;nós&quot;).
        </p>
        <p>
          Ao criar um escritório, você declara ter lido e aceitado estes Termos e a{" "}
          <Link href="/privacidade" className="text-carimbo underline underline-offset-4">
            Política de Privacidade
          </Link>
          , e ter pelo menos 18 anos.
        </p>
      </Clausula>

      <Clausula numero={2} titulo="A sua conta">
        <Itens>
          <li>Os dados do cadastro precisam ser verdadeiros e mantidos atualizados.</li>
          <li>
            A senha é pessoal. Você responde pelo que for feito com a sua conta — se suspeitar de uso
            indevido, troque a senha e nos avise.
          </li>
          <li>
            Quem cria o escritório é o administrador: é quem convida prepostos, define o que eles veem
            e responde pela assinatura.
          </li>
        </Itens>
      </Clausula>

      <Clausula numero={3} titulo="Assinatura e pagamento">
        <Itens>
          <li>
            A assinatura é mensal, no cartão de crédito, cobrada pelo Asaas. A primeira cobrança é no
            dia do cadastro, e o sistema abre assim que ela é confirmada.
          </li>
          <li>Sem taxa de implantação e sem fidelidade.</li>
          <li>
            Se uma cobrança não for paga, o acesso pode ser suspenso até a regularização. Os seus dados
            não são apagados por isso.
          </li>
          <li>
            Mudanças de preço são avisadas com pelo menos 30 dias de antecedência, e valem a partir da
            cobrança seguinte.
          </li>
        </Itens>
      </Clausula>

      <Clausula numero={4} titulo="Uso permitido">
        <p>Você se compromete a não:</p>
        <Itens>
          <li>usar o sistema para algo ilegal, ou para enviar e-mails que o destinatário não espera (spam);</li>
          <li>tentar acessar dados de outro escritório ou burlar os limites de segurança;</li>
          <li>copiar, revender ou tentar extrair o código do sistema.</li>
        </Itens>
        <p>O descumprimento pode levar à suspensão da conta.</p>
      </Clausula>

      <Clausula numero={5} titulo="Os seus dados são seus">
        <p>
          Tudo o que você cadastra continua sendo seu. Usamos esses dados só para prestar o serviço, como
          descreve a Política de Privacidade, e você pode pedir uma cópia deles a qualquer momento.
        </p>
        <p>
          Quanto aos dados dos seus clientes e contatos, o seu escritório é quem decide o que cadastrar e
          responde por ter base legal para isso; o RepPlast trata esses dados só por sua conta.
        </p>
      </Clausula>

      <Clausula numero={6} titulo="Conferência dos documentos">
        <p>
          O RepPlast calcula preços, totais, impostos e comissões a partir do que é cadastrado. Antes de
          enviar um pedido ou orçamento, confira os valores: o que vai para o cliente e para a indústria é
          responsabilidade de quem envia.
        </p>
      </Clausula>

      <Clausula numero={7} titulo="Disponibilidade">
        <p>
          Trabalhamos para o sistema ficar no ar o tempo todo, mas podem acontecer paradas para
          manutenção ou por falha de terceiros (hospedagem, internet, provedores de pagamento e de
          e-mail). Não respondemos por lucros cessantes ou danos indiretos dessas paradas, nos limites
          da lei.
        </p>
      </Clausula>

      <Clausula numero={8} titulo="Encerramento">
        <p>
          Você pode cancelar a assinatura quando quiser, escrevendo para{" "}
          <a href={`mailto:${CONTROLADOR.email}`} className="text-carimbo underline underline-offset-4">
            {CONTROLADOR.email}
          </a>
          . O acesso continua até o fim do mês já pago, e não há reembolso de mês em curso —
          ressalvado o direito de arrependimento de 7 dias após a contratação, quando o Código de
          Defesa do Consumidor se aplicar (art. 49). Antes de
          encerrar, você pode pedir uma cópia dos seus dados; depois, eles são apagados como diz a
          Política de Privacidade.
        </p>
      </Clausula>

      <Clausula numero={9} titulo="Mudanças e foro">
        <p>
          Estes Termos podem mudar; a data no topo indica a versão em vigor, e mudanças importantes
          serão avisadas antes. Vale a lei brasileira, e fica eleito o foro do domicílio de quem
          contrata.
        </p>
      </Clausula>
    </PaginaLegal>
  );
}
