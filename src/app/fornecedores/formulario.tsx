"use client";

import { useActionState } from "react";

import { Botao, Campo, MensagemErro, SecaoCartao, Selecao } from "@/components/ui";

import type { EstadoFormulario } from "./acoes";

export type ValoresFornecedor = {
  nome: string;
  razaoSocial: string;
  cnpj: string;
  emailsPedido: string;
  ipiPercentual: string;
  comissaoPercentual: string;
  unidadeMeta: string;
  modoFaixa: string;
  fatorKgPadrao: string;
};

export const VALORES_VAZIOS: ValoresFornecedor = {
  nome: "",
  razaoSocial: "",
  cnpj: "",
  emailsPedido: "",
  ipiPercentual: "",
  comissaoPercentual: "",
  unidadeMeta: "REAIS",
  modoFaixa: "PROGRESSIVA",
  fatorKgPadrao: "",
};

export function FormularioFornecedor({
  acao,
  valores,
  rotuloEnvio,
}: {
  acao: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  valores: ValoresFornecedor;
  rotuloEnvio: string;
}) {
  const [estado, enviar, enviando] = useActionState(acao, {});

  return (
    <form action={enviar} className="space-y-5">
      <MensagemErro>{estado.erro}</MensagemErro>

      <SecaoCartao titulo="Identificação">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            name="nome"
            rotulo="Nome da indústria"
            required
            defaultValue={valores.nome}
            placeholder="QUALYPLAST EMBALAGENS"
            className="sm:col-span-2"
          />
          <Campo
            name="razaoSocial"
            rotulo="Razão social"
            defaultValue={valores.razaoSocial}
          />
          <Campo name="cnpj" rotulo="CNPJ" defaultValue={valores.cnpj} />
          <Campo
            name="emailsPedido"
            rotulo="E-mails para envio do pedido"
            dica="Separe por vírgula. É para cá que o PDF do pedido será enviado."
            defaultValue={valores.emailsPedido}
            className="sm:col-span-2"
          />
        </div>
      </SecaoCartao>

      <SecaoCartao
        titulo="Condições comerciais"
        descricao="Valores usados no cálculo do pedido e da sua comissão."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo
            name="ipiPercentual"
            rotulo="IPI"
            inputMode="decimal"
            sufixo="%"
            dica="Aplicado sobre o subtotal dos produtos."
            defaultValue={valores.ipiPercentual}
            placeholder="9,75"
          />
          <Campo
            name="comissaoPercentual"
            rotulo="Comissão base"
            inputMode="decimal"
            sufixo="%"
            dica="Vale quando nenhuma faixa de volume se aplica."
            defaultValue={valores.comissaoPercentual}
            placeholder="3"
          />
          <Campo
            name="fatorKgPadrao"
            rotulo="Fator kg padrão"
            inputMode="decimal"
            dica="Apenas sugestão ao cadastrar produto. O valor que vale é o do produto."
            defaultValue={valores.fatorKgPadrao}
            placeholder="13,50"
          />
        </div>
      </SecaoCartao>

      <SecaoCartao
        titulo="Meta mensal"
        descricao="Como esta indústria apura o volume que define a faixa de comissão."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Selecao
            name="unidadeMeta"
            rotulo="Meta medida em"
            defaultValue={valores.unidadeMeta}
            dica="A meta zera todo dia 1º e é contada só desta indústria."
          >
            <option value="REAIS">Reais vendidos</option>
            <option value="KG">Quilos vendidos</option>
          </Selecao>

          <Selecao
            name="modoFaixa"
            rotulo="Ao subir de faixa"
            defaultValue={valores.modoFaixa}
            dica="Retroativo recalcula as comissões já lançadas no mês."
          >
            <option value="PROGRESSIVA">Novo percentual só sobre o excedente</option>
            <option value="RETROATIVA">Novo percentual sobre o mês inteiro</option>
          </Selecao>
        </div>
      </SecaoCartao>

      <div className="flex justify-end">
        <Botao type="submit" disabled={enviando}>
          {enviando ? "Salvando…" : rotuloEnvio}
        </Botao>
      </div>
    </form>
  );
}
