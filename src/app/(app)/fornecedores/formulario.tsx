"use client";

import { BadgeCheck, MapPin, Percent, Phone } from "lucide-react";
import { useActionState } from "react";

import { CampoCep, CampoDocumento, CampoTelefone } from "@/components/campo-mascarado";
import { Botao, Campo, MensagemErro, SecaoCartao } from "@/components/ui";

import type { EstadoFormulario } from "./acoes";
import type { ValoresFornecedor } from "./valores";

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
            dica="Com quem se fala na indústria."
            defaultValue={valores.email}
          />
          {/*
            Fica ao lado do e-mail de contato, e não junto da identificação: os
            dois são e-mail, mas só ESTE recebe o PDF do pedido. Separados em
            cartões diferentes, era fácil preencher um achando que era o outro.
          */}
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
        </div>
      </SecaoCartao>

      <div className="flex justify-end">
        <Botao type="submit" carregando={enviando}>
          {enviando ? "Salvando…" : rotuloEnvio}
        </Botao>
      </div>
    </form>
  );
}
