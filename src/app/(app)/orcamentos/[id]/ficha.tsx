"use client";

/**
 * As condições da proposta e o desfecho dela.
 *
 * Fica numa seção só porque é o que se relê antes de mandar: a quem é
 * dirigida, até quando vale, como se paga, e o texto de condições que a
 * indústria costuma exigir no rodapé.
 */

import {
  Ban,
  Check,
  FileSignature,
  PackagePlus,
  ScrollText,
  ThumbsDown,
  Timer,
  UserRoundPlus,
  X,
} from "lucide-react";
import { useActionState, useState } from "react";

import {
  AreaTexto,
  Botao,
  BotaoLink,
  BotaoTexto,
  Campo,
  MensagemErro,
  SecaoCartao,
} from "@/components/ui";
import { LIMITE_DO_MOTIVO } from "@/lib/motivo";

import type { EstadoFormulario } from "../acoes";

export type ValoresProposta = {
  attn: string;
  /** "AAAA-MM-DD", como o input date espera. */
  validoAte: string;
  prazoPagamento: string;
  vendedor: string;
  cidade: string;
  observacoes: string;
};

/** Já formatada no servidor: o fuso de quem lê não muda quando foi editado. */
export type EdicaoRegistrada = { id: string; quem: string; quando: string };

export function FichaProposta({
  valores,
  editavel,
  fechada,
  edicoes,
  salvar,
}: {
  valores: ValoresProposta;
  editavel: boolean;
  /** Aceita, recusada ou vencida — não volta a ser editável por um botão. */
  fechada: boolean;
  edicoes: EdicaoRegistrada[];
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
          : fechada
            ? "Proposta fechada: o que o cliente recebeu não muda mais."
            : "Em leitura. Para mexer em qualquer coisa, use Editar no alto da página."
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
          <Campo
            name="cidade"
            rotulo="Cidade"
            disabled={!editavel}
            dica="Abre o cabeçalho, antes da data. Vem da sua ficha em Configurações."
            placeholder="Americana"
            defaultValue={valores.cidade}
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
              {salvando ? "Salvando…" : "Salvar e voltar"}
            </Botao>
          </div>
        )}
      </form>

      {edicoes.length > 0 && (
        <div className="mt-5 pt-4 border-t border-filete">
          <h3 className="rotulo text-tinta-3 mb-2">Editada depois de pronta</h3>
          <ul className="space-y-1">
            {edicoes.map((edicao) => (
              <li key={edicao.id} className="text-mini text-tinta-2">
                {edicao.quem} · <span className="numerico">{edicao.quando}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
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
  viraPedido,
  jaVirouPedido,
  motivoRecusa,
  aceitar,
  recusar,
  vencer,
  reabrir,
  virarPedido,
  salvarMotivo,
}: {
  status: string;
  temItens: boolean;
  /** Cliente cadastrado e todo item é produto dele. Ver `PendenciasDoPedido`. */
  viraPedido: boolean;
  jaVirouPedido: boolean;
  motivoRecusa: string;
  aceitar: (formData: FormData) => void | Promise<void>;
  recusar: (formData: FormData) => void | Promise<void>;
  vencer: (formData: FormData) => void | Promise<void>;
  reabrir: (formData: FormData) => void | Promise<void>;
  virarPedido: (formData: FormData) => void | Promise<void>;
  salvarMotivo: (formData: FormData) => void | Promise<void>;
}) {
  const aberto = status === "ABERTO";

  /*
   * Recusar é de dois tempos: o clique abre o campo do motivo, e é o segundo
   * botão que fecha a proposta. O motivo se sabe JUSTO nesse instante — quem
   * acabou de ouvir do cliente é quem consegue escrever "fecharam com a
   * concorrência", e perguntar depois é perguntar quando já esqueceu.
   */
  const [recusando, setRecusando] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-3">
      {aberto ? (
        recusando ? (
          <form action={recusar} className="w-full max-w-xl space-y-3">
            <Campo
              name="motivoRecusa"
              rotulo="Por que o cliente recusou?"
              placeholder="Preço acima do concorrente, adiou a compra…"
              maxLength={LIMITE_DO_MOTIVO}
              autoFocus
              dica="Opcional. Fica visível na lista — é o que explica a proposta perdida meses depois."
            />
            <div className="flex flex-wrap items-center gap-3">
              <Botao type="submit" variante="secundaria" icone={ThumbsDown}>
                Marcar como recusada
              </Botao>
              <BotaoTexto type="button" onClick={() => setRecusando(false)}>
                voltar
              </BotaoTexto>
            </div>
          </form>
        ) : (
          <>
            <form action={aceitar}>
              <Botao type="submit" icone={Check} disabled={!temItens}>
                Cliente aceitou
              </Botao>
            </form>
            <Botao
              type="button"
              variante="secundaria"
              icone={ThumbsDown}
              onClick={() => setRecusando(true)}
            >
              Recusou
            </Botao>
            <form action={vencer}>
              <BotaoTexto type="submit">
                <Timer size={12} className="inline mr-1" aria-hidden="true" />
                marcar como vencida
              </BotaoTexto>
            </form>
          </>
        )
      ) : (
        <form action={reabrir}>
          <BotaoTexto type="submit">reabrir a proposta</BotaoTexto>
        </form>
      )}

      {status === "RECUSADO" && (
        <form action={salvarMotivo} className="w-full max-w-xl space-y-3">
          <Campo
            name="motivoRecusa"
            rotulo="Por que o cliente recusou?"
            defaultValue={motivoRecusa}
            placeholder="Preço acima do concorrente, adiou a compra…"
            maxLength={LIMITE_DO_MOTIVO}
            dica="Fica visível na lista de orçamentos."
          />
          <Botao type="submit" variante="secundaria" tamanho="compacto">
            Salvar motivo
          </Botao>
        </form>
      )}

      {status === "ACEITO" &&
        (viraPedido ? (
          <form action={virarPedido}>
            <Botao type="submit" icone={ScrollText} disabled={!temItens}>
              {jaVirouPedido ? "Gerar outro pedido" : "Virar pedido"}
            </Botao>
          </form>
        ) : (
          <p className="text-corpo text-tinta-2 max-w-sm leading-relaxed">
            Aceita, mas não vira pedido: falta cadastrar o cliente e os produtos dele — veja
            “Esta proposta não vira pedido”, acima.
          </p>
        ))}
    </div>
  );
}


/**
 * O que falta para a proposta poder virar pedido — dito antes, e não na hora.
 *
 * Proposta para quem ainda não é cliente NÃO vira pedido. O pedido leva razão
 * social, CNPJ e endereço à indústria, e cada linha dele é um produto do
 * cliente; a proposta avulsa não tem nenhum dos dois. O caminho existe e é este
 * cartão: cadastrar o cliente (pelo cadastro completo, que volta vinculado) e
 * depois os itens como produtos dele — um a um, pela tabela, ou todos de vez.
 */
export function PendenciasDoPedido({
  cadastrarClienteEm,
  cliente,
  itens,
  itensSemProduto,
  cadastrarTodos,
}: {
  cadastrarClienteEm: string;
  /** Apelido do cliente vinculado; nulo enquanto a proposta é avulsa. */
  cliente: string | null;
  itens: number;
  itensSemProduto: number;
  cadastrarTodos: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
}) {
  const [estado, enviar, cadastrando] = useActionState(cadastrarTodos, {});

  return (
    <SecaoCartao
      icone={Ban}
      tom="pessego"
      titulo="Esta proposta não vira pedido"
      descricao={
        cliente
          ? `Falta cadastrar os itens como produtos da ${cliente}. Enquanto houver linha feita só de conta, a proposta vale para cotar, mas não gera pedido.`
          : "Ela é para quem ainda não é cliente, e os itens são conta, sem produto. Vale normalmente como proposta — número, itens e PDF —, mas só vira pedido depois de cadastrar o cliente e os produtos dele."
      }
    >
      <MensagemErro>{estado.erro}</MensagemErro>

      <ol className="space-y-3 text-corpo">
        <li className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <Marca feito={cliente !== null} />
            {cliente ? (
              <>Cliente cadastrado: {cliente}</>
            ) : (
              <>1. Cadastrar o cliente, com razão social, CNPJ e endereço</>
            )}
          </span>
          {!cliente && (
            <BotaoLink href={cadastrarClienteEm} variante="secundaria" icone={UserRoundPlus}>
              Cadastrar cliente
            </BotaoLink>
          )}
        </li>

        <li className="flex flex-wrap items-center justify-between gap-3">
          <span className="flex items-center gap-2">
            <Marca feito={itens > 0 && itensSemProduto === 0} />
            <span>
              2. Cadastrar os itens como produtos dele
              <span className="text-tinta-3 numerico">
                {" "}
                — {itens - itensSemProduto} de {itens}
              </span>
            </span>
          </span>
          {cliente && itensSemProduto > 0 && (
            <form action={enviar}>
              <Botao type="submit" variante="secundaria" icone={PackagePlus} carregando={cadastrando}>
                {cadastrando ? "Cadastrando…" : "Cadastrar todos os produtos"}
              </Botao>
            </form>
          )}
        </li>
      </ol>

      {cliente && itensSemProduto > 0 && (
        <p className="mt-3 text-mini text-tinta-3 leading-relaxed">
          Para completar código da indústria ou do cliente, use “cadastrar como produto” na linha
          do item — abre o Novo produto com a conta já preenchida.
        </p>
      )}
    </SecaoCartao>
  );
}

function Marca({ feito }: { feito: boolean }) {
  return feito ? (
    <Check size={16} className="text-verde shrink-0" aria-label="feito" />
  ) : (
    <X size={16} className="text-perigo shrink-0" aria-label="falta" />
  );
}
