"use client";

import { BadgeCheck, Hash, MapPin, Percent, Phone } from "lucide-react";
import { useActionState } from "react";

import { CampoCep, CampoDocumento, CampoTelefone } from "@/components/campo-mascarado";
import { ErroGeral, Formulario } from "@/components/formulario";
import { Botao, Campo, SecaoCartao } from "@/components/ui";

import type { EstadoFormulario } from "./acoes";
import type { ValoresFornecedor } from "./valores";

export function FormularioFornecedor({
  acao,
  valores,
  rotuloEnvio,
  editavel = true,
}: {
  acao: (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;
  valores: ValoresFornecedor;
  rotuloEnvio: string;
  /** Ficha já gravada, aberta para leitura: tudo travado até clicar em Editar. */
  editavel?: boolean;
}) {
  const [estado, enviar, enviando] = useActionState(acao, {});

  return (
    <Formulario estado={estado} action={enviar} className="space-y-5">

      {/*
        Em leitura, o formulário inteiro trava de uma vez — mesmo recurso da
        ficha do cliente. Mexer exige clicar em Editar no alto da página.
      */}
      <fieldset disabled={!editavel} className="space-y-5 min-w-0">
        <SecaoCartao icone={BadgeCheck} titulo="Identificação">
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
            <CampoDocumento name="cnpj" rotulo="CNPJ" defaultValue={valores.cnpj} />
          </div>
        </SecaoCartao>

        <SecaoCartao icone={MapPin} titulo="Endereço">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Campo
              name="endereco"
              rotulo="Logradouro e número"
              className="sm:col-span-2 lg:col-span-3"
              defaultValue={valores.endereco}
            />
            <CampoCep name="cep" rotulo="CEP" defaultValue={valores.cep} />
            <Campo
              name="bairro"
              rotulo="Bairro"
              className="sm:col-span-2"
              defaultValue={valores.bairro}
            />
            <Campo name="municipio" rotulo="Município" defaultValue={valores.municipio} />
            <Campo name="uf" rotulo="UF" maxLength={2} defaultValue={valores.uf} placeholder="SP" />
          </div>
        </SecaoCartao>

        <SecaoCartao icone={Phone} titulo="Contato">
          <div className="grid gap-4 sm:grid-cols-2">
            <CampoTelefone name="telefone" rotulo="Telefone" defaultValue={valores.telefone} />
            <Campo
              name="email"
              rotulo="E-mail"
              type="email"
              dica="Com quem se fala na indústria. Quem recebe o pedido fica em Contatos para pedidos."
              defaultValue={valores.email}
            />
          </div>
        </SecaoCartao>

        <SecaoCartao
          icone={Percent}
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
              rotulo="Comissão"
              inputMode="decimal"
              sufixo="%"
              dica="Cada pedido nasce com ele e pode ser ajustado enquanto estiver aberto."
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
            <Campo
              name="diaFechamentoComissao"
              rotulo="Só paga a comissão após faturar até o dia"
              inputMode="numeric"
              dica="Os pedidos novos já nascem com esse dia: o que vence ou é entregue até ele conta na comissão do mês seguinte. Em branco, conta no próprio mês. A exceção se troca no acerto do pedido."
              defaultValue={valores.diaFechamentoComissao}
              placeholder="30"
            />
          </div>
        </SecaoCartao>

        <SecaoCartao
          icone={Hash}
          titulo="Numeração de pedidos"
          descricao="Cada indústria tem a sua sequência; o mesmo número em outra não conflita."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo
              name="ultimoNumeroPedido"
              rotulo="Último pedido emitido"
              inputMode="numeric"
              dica={
                valores.ultimoNumeroPedido === ""
                  ? "Vindo de outro sistema, informe o último pedido de lá. Em branco, o primeiro sai com o nº 1."
                  : `O próximo pedido desta indústria sai com o nº ${(Number(valores.ultimoNumeroPedido) + 1).toLocaleString("pt-BR")}.`
              }
              defaultValue={valores.ultimoNumeroPedido}
              placeholder="0"
            />
            {/* O que a ficha mostrava ao abrir: o contador só se mexe se mudou. */}
            <input
              type="hidden"
              name="ultimoNumeroPedidoVisto"
              value={valores.ultimoNumeroPedido}
            />
          </div>
        </SecaoCartao>
      </fieldset>

      {editavel && (
        <div className="space-y-3">
          {/* Cada erro de campo aparece embaixo do campo; aqui só o que não é
              de campo nenhum, perto de onde a pessoa acabou de clicar. */}
          <ErroGeral />
          <div className="flex justify-end">
            <Botao type="submit" carregando={enviando}>
              {enviando ? "Salvando…" : rotuloEnvio}
            </Botao>
          </div>
        </div>
      )}
    </Formulario>
  );
}
