"use client";

/**
 * Os dados para pagamento da indústria na ficha: campos para preencher na
 * edição; na leitura, o que foi preenchido e o botão Copiar, que leva tudo num
 * texto pronto para o WhatsApp ou o e-mail (`textoDoPagamento`).
 *
 * Fica FORA do `<fieldset disabled>` da ficha (ver `formulario.tsx`): ele
 * travaria o Copiar, que é justamente para a ficha em leitura — a do preposto
 * inclusive.
 */

import { Landmark } from "lucide-react";

import { BotaoCopiar } from "@/components/botao-copiar";
import { CampoDocumento } from "@/components/campo-mascarado";
import { AreaTexto, Campo, SecaoCartao, Selecao } from "@/components/ui";
import {
  TIPOS_CHAVE_PIX,
  TIPOS_CONTA,
  linhasDoPagamento,
  textoDoPagamento,
  type DadosPagamento,
} from "@/lib/dados-pagamento";

export function SecaoDadosPagamento({
  pagamento,
  editavel,
  podeEditar,
}: {
  pagamento: DadosPagamento;
  editavel: boolean;
  podeEditar: boolean;
}) {
  return (
    <SecaoCartao
      icone={Landmark}
      titulo="Dados para pagamento"
      descricao="PIX, banco e favorecido da indústria, guardados para copiar e enviar a quem precisar pagar."
    >
      {editavel ? <Campos pagamento={pagamento} /> : <Leitura pagamento={pagamento} podeEditar={podeEditar} />}
    </SecaoCartao>
  );
}

function Campos({ pagamento }: { pagamento: DadosPagamento }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 items-start">
      <Selecao name="pagamentoTipoChavePix" rotulo="Tipo da chave PIX" defaultValue={pagamento.tipoChavePix}>
        <option value="">—</option>
        {Object.entries(TIPOS_CHAVE_PIX).map(([valor, rotulo]) => (
          <option key={valor} value={valor}>
            {rotulo}
          </option>
        ))}
      </Selecao>
      <Campo
        name="pagamentoChavePix"
        rotulo="Chave PIX"
        className="lg:col-span-3"
        autoComplete="off"
        placeholder="12.345.678/0001-95"
        defaultValue={pagamento.chavePix}
      />

      <Campo
        name="pagamentoBanco"
        rotulo="Banco"
        placeholder="Itaú"
        autoComplete="off"
        defaultValue={pagamento.banco}
      />
      <Campo
        name="pagamentoAgencia"
        rotulo="Agência"
        inputMode="numeric"
        placeholder="1234"
        autoComplete="off"
        defaultValue={pagamento.agencia}
      />
      <Campo
        name="pagamentoConta"
        rotulo="Conta"
        placeholder="56789-0"
        autoComplete="off"
        defaultValue={pagamento.conta}
      />
      <Selecao name="pagamentoTipoConta" rotulo="Tipo da conta" defaultValue={pagamento.tipoConta}>
        <option value="">—</option>
        {Object.entries(TIPOS_CONTA).map(([valor, rotulo]) => (
          <option key={valor} value={valor}>
            {rotulo}
          </option>
        ))}
      </Selecao>

      <Campo
        name="pagamentoFavorecido"
        rotulo="Favorecido"
        className="sm:col-span-2 lg:col-span-3"
        dica="Em nome de quem está a conta."
        placeholder="INDÚSTRIA EXEMPLO LTDA"
        autoComplete="off"
        defaultValue={pagamento.favorecido}
      />
      <CampoDocumento
        name="pagamentoDocumento"
        rotulo="CPF / CNPJ do favorecido"
        className="sm:col-span-2 lg:col-span-1"
        defaultValue={pagamento.documento}
      />

      <AreaTexto
        name="pagamentoObservacoes"
        rotulo="Observações"
        className="sm:col-span-2 lg:col-span-4"
        rows={3}
        dica="O que não cabe nos campos acima. Vai no fim do texto copiado."
        placeholder="Boleto: pedir ao financeiro@industria.com.br"
        defaultValue={pagamento.observacoes}
      />
    </div>
  );
}

function Leitura({ pagamento, podeEditar }: { pagamento: DadosPagamento; podeEditar: boolean }) {
  const linhas = linhasDoPagamento(pagamento);

  if (linhas.length === 0) {
    return (
      <p className="text-corpo text-tinta-3">
        Nenhum dado de pagamento cadastrado.{podeEditar && " Clique em Editar para incluir."}
      </p>
    );
  }

  // O que se vê é o que se copia: as mesmas linhas, na mesma ordem.
  return (
    <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-start">
      <div className="flex-1 min-w-0 rounded-suave border border-filete bg-folha-2 px-4 py-3 text-corpo text-tinta space-y-1">
        {linhas.map((linha, i) => (
          <p key={i} className="whitespace-pre-wrap break-words">
            {linha}
          </p>
        ))}
      </div>
      <BotaoCopiar texto={textoDoPagamento(pagamento)} />
    </div>
  );
}
