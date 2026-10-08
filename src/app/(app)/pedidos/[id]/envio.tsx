"use client";

/**
 * Envio do pedido por e-mail.
 *
 * Fica separado das outras ações porque é o único caminho que sai do sistema:
 * manda o PDF para a indústria e, dando certo, marca o pedido como enviado —
 * o que dispara a comissão.
 *
 * O diálogo é o de `components/envio-email.tsx`, o mesmo da proposta. Aqui só
 * se diz o que é do pedido: vai para os contatos da INDÚSTRIA, oferece cópia
 * ao cliente e guarda na lista da indústria os e-mails digitados.
 */

import Link from "next/link";

import {
  type ContaEnvio,
  type ContatoEnvio,
  type EdicaoAConferir,
  EnvioPorEmail,
} from "@/components/envio-email";
import type { EstadoEnvio } from "@/lib/envio-pedido";

export type { ContaEnvio, ContatoEnvio, EdicaoAConferir };

export function BotaoEnviarEmail({
  jaEnviado,
  aConferir = [],
  acao,
  contas,
  contatos,
  fornecedor,
  editaIndustria = false,
  cliente,
  textoPadrao,
  nomeArquivoPdf,
}: {
  jaEnviado: boolean;
  /** Vazio para quem não é administrador: o aviso é dele. */
  aConferir?: EdicaoAConferir[];
  acao: (estado: EstadoEnvio, formData: FormData) => Promise<EstadoEnvio>;
  contas: ContaEnvio[];
  contatos: ContatoEnvio[];
  fornecedor: { id: string; nome: string };
  /** Só o administrador mexe no cadastro da indústria, contatos inclusive. */
  editaIndustria?: boolean;
  cliente: { apelido: string; email: string | null };
  textoPadrao: { assunto: string; corpo: string };
  nomeArquivoPdf: string;
}) {
  return (
    <EnvioPorEmail
      jaEnviado={jaEnviado}
      aConferir={aConferir}
      acao={acao}
      contas={contas}
      contatos={contatos}
      textoPadrao={textoPadrao}
      nomeArquivoPdf={nomeArquivoPdf}
      documento={{
        titulo: jaEnviado ? "Reenviar pedido por e-mail" : "Enviar pedido por e-mail",
        descricao: `Para a ${fornecedor.nome}. Dando certo, o pedido fica marcado como enviado.`,
        rotuloPara: `Para — ${fornecedor.nome}`,
        semContatos: editaIndustria ? (
          <>
            Nenhum contato cadastrado nesta indústria. Digite o e-mail abaixo, ou{" "}
            <Link
              href={`/fornecedores/${fornecedor.id}`}
              className="text-carimbo font-medium hover:underline"
            >
              cadastre os contatos dela
            </Link>
            .
          </>
        ) : (
          <>Nenhum contato cadastrado nesta indústria. Digite o e-mail abaixo.</>
        ),
        placeholderAvulsos: "alguem@industria.com.br",
        guardarAvulsosEm: editaIndustria ? fornecedor.nome : undefined,
        copiaCliente: cliente,
        faltaDestinatario: "Escolha pelo menos um destinatário na indústria",
        tituloEntrega: `Pedido enviado para a ${fornecedor.nome}`,
        este: "este pedido",
      }}
    />
  );
}
