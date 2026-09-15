"use client";

/**
 * As condições da proposta e o desfecho dela.
 *
 * Fica numa seção só porque é o que se relê antes de mandar: a quem é
 * dirigida, até quando vale, como se paga, e o texto de condições que a
 * indústria costuma exigir no rodapé.
 */

import { Check, FileSignature, ScrollText, ThumbsDown, Timer, UserRoundPlus } from "lucide-react";
import { useActionState } from "react";

import {
  AreaTexto,
  Botao,
  BotaoTexto,
  Campo,
  MensagemErro,
  SecaoCartao,
} from "@/components/ui";

import type { EstadoFormulario } from "../acoes";

export type ValoresProposta = {
  attn: string;
  /** "AAAA-MM-DD", como o input date espera. */
  validoAte: string;
  prazoPagamento: string;
  vendedor: string;
  observacoes: string;
};

export function FichaProposta({
  valores,
  editavel,
  salvar,
}: {
  valores: ValoresProposta;
  editavel: boolean;
  salvar: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
}) {
  const [estado, enviar, salvando] = useActionState(salvar, {});

  return (
    <SecaoCartao
      icone={FileSignature}
      tom="pessego"
      titulo="A proposta"
      descricao={
        editavel
          ? "Sai tudo impresso no PDF que o cliente recebe."
          : "Proposta fechada: o que o cliente recebeu não muda mais."
      }
    >
      <form action={enviar} className="space-y-4">
        <MensagemErro>{estado.erro}</MensagemErro>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Campo
            name="attn"
            rotulo="Aos cuidados de"
            disabled={!editavel}
            dica="A pessoa no cliente. Sai abaixo do nome da empresa."
            placeholder="Sr. Marcelo"
            defaultValue={valores.attn}
          />
          <Campo
            name="validoAte"
            rotulo="Válido até"
            type="date"
            disabled={!editavel}
            dica="Não vence sozinho — quem fecha é você."
            defaultValue={valores.validoAte}
          />
          <Campo
            name="prazoPagamento"
            rotulo="Prazo de pagamento"
            disabled={!editavel}
            placeholder="28/35/42"
            defaultValue={valores.prazoPagamento}
          />
          <Campo
            name="vendedor"
            rotulo="Vendedor"
            disabled={!editavel}
            dica="Assina a proposta no rodapé."
            defaultValue={valores.vendedor}
          />
        </div>

        <label className="block">
          <span className="rotulo block mb-1.5 text-tinta-2">Condições</span>
          <AreaTexto
            name="observacoes"
            rows={6}
            disabled={!editavel}
            defaultValue={valores.observacoes}
            placeholder={"ICMS: 18% (incluso no preço acima)\nFrete: CIF\nPrazo de entrega: 15 dias úteis"}
          />
        </label>

        {editavel && (
          <div className="flex justify-end">
            <Botao type="submit" variante="secundaria" carregando={salvando}>
              {salvando ? "Salvando…" : "Salvar a proposta"}
            </Botao>
          </div>
        )}
      </form>
    </SecaoCartao>
  );
}

/**
 * O desfecho.
 *
 * Aceitar, recusar e vencer são as três saídas, e nenhuma acontece sozinha —
 * nem a de vencer. A data de validade é o que foi prometido; se o preço segue
 * de pé depois dela, quem sabe é quem negociou.
 */
export function DesfechoProposta({
  status,
  temItens,
  temCliente,
  jaVirouPedido,
  aceitar,
  recusar,
  vencer,
  reabrir,
  virarPedido,
}: {
  status: string;
  temItens: boolean;
  temCliente: boolean;
  jaVirouPedido: boolean;
  aceitar: (formData: FormData) => void | Promise<void>;
  recusar: (formData: FormData) => void | Promise<void>;
  vencer: (formData: FormData) => void | Promise<void>;
  reabrir: (formData: FormData) => void | Promise<void>;
  virarPedido: (formData: FormData) => void | Promise<void>;
}) {
  const aberto = status === "ABERTO";

  return (
    <div className="flex flex-wrap items-center gap-3">
      {aberto ? (
        <>
          <form action={aceitar}>
            <Botao type="submit" icone={Check} disabled={!temItens}>
              Cliente aceitou
            </Botao>
          </form>
          <form action={recusar}>
            <Botao type="submit" variante="secundaria" icone={ThumbsDown}>
              Recusou
            </Botao>
          </form>
          <form action={vencer}>
            <BotaoTexto type="submit">
              <Timer size={12} className="inline mr-1" aria-hidden="true" />
              marcar como vencida
            </BotaoTexto>
          </form>
        </>
      ) : (
        <form action={reabrir}>
          <BotaoTexto type="submit">reabrir a proposta</BotaoTexto>
        </form>
      )}

      {status === "ACEITO" &&
        (temCliente ? (
          <form action={virarPedido}>
            <Botao type="submit" icone={ScrollText} disabled={!temItens}>
              {jaVirouPedido ? "Gerar outro pedido" : "Virar pedido"}
            </Botao>
          </form>
        ) : (
          <p className="text-corpo text-tinta-2 max-w-sm leading-relaxed">
            Para virar pedido, cadastre o cliente acima — o pedido leva razão social, CNPJ e
            endereço para a indústria, e um nome solto não fatura.
          </p>
        ))}
    </div>
  );
}


/**
 * Transforma o destinatário avulso em cliente, sem sair da proposta.
 *
 * O sistema antigo recusava a conversão e mandava a pessoa para outra tela,
 * copiar o nome na mão. O cadastro completo continua sendo em Clientes; aqui
 * nasce só o suficiente para o pedido existir.
 */
export function CadastrarCliente({
  nome,
  municipio,
  cadastrar,
}: {
  nome: string;
  municipio: string;
  cadastrar: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
}) {
  const [estado, enviar, salvando] = useActionState(cadastrar, {});

  return (
    <SecaoCartao
      icone={UserRoundPlus}
      tom="mar"
      titulo="Ainda não é cliente"
      descricao="Esta proposta foi feita para quem não está no cadastro. Enquanto for assim ela vive normalmente — só não vira pedido."
    >
      <form action={enviar} className="space-y-4">
        <MensagemErro>{estado.erro}</MensagemErro>

        <div className="grid gap-4 sm:grid-cols-3">
          <Campo
            name="apelido"
            rotulo="Nome curto"
            required
            defaultValue={nome}
            dica="Usado nas listas e no nome do PDF."
          />
          <Campo
            name="razaoSocial"
            rotulo="Razão social"
            defaultValue={nome}
            dica="Sai impressa no pedido. Dá para corrigir depois."
          />
          <Campo name="municipio" rotulo="Município" defaultValue={municipio} />
        </div>

        <div className="flex justify-end">
          <Botao type="submit" variante="secundaria" icone={UserRoundPlus} carregando={salvando}>
            {salvando ? "Cadastrando…" : "Cadastrar e vincular"}
          </Botao>
        </div>
      </form>
    </SecaoCartao>
  );
}
