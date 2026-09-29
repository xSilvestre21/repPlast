/**
 * Os dois e-mails que têm texto padrão: o do pedido e o da proposta.
 *
 * Um lugar só para o que Configurações precisa de cada um — a tabela de
 * variáveis, o texto de sempre e onde o do usuário fica guardado —, usado pela
 * tela (sugestões e prévia) e pela ação que salva (validação e colunas).
 */

import type { TabelaDeVariaveis } from "./modelo-email";
import {
  ASSUNTO_ENVIO_PADRAO,
  MENSAGEM_ENVIO_PADRAO,
  VARIAVEIS_ENVIO,
} from "./envio-pedido";
import {
  ASSUNTO_ORCAMENTO_PADRAO,
  MENSAGEM_ORCAMENTO_PADRAO,
  VARIAVEIS_ORCAMENTO,
} from "./envio-orcamento";

export type TipoDeEmail = "pedido" | "orcamento";

export type ModeloDeEmail = {
  tabela: TabelaDeVariaveis;
  assuntoPadrao: string;
  mensagemPadrao: string;
  /** Completa "não é um dado …". */
  doDocumento: string;
  /** As colunas de `usuario` onde o texto de cada um fica. */
  colunas: {
    assunto: "assuntoEnvioPadrao" | "assuntoOrcamentoPadrao";
    mensagem: "mensagemEnvioPadrao" | "mensagemOrcamentoPadrao";
  };
};

export const MODELOS_DE_EMAIL: Record<TipoDeEmail, ModeloDeEmail> = {
  pedido: {
    tabela: VARIAVEIS_ENVIO,
    assuntoPadrao: ASSUNTO_ENVIO_PADRAO,
    mensagemPadrao: MENSAGEM_ENVIO_PADRAO,
    doDocumento: "do pedido",
    colunas: { assunto: "assuntoEnvioPadrao", mensagem: "mensagemEnvioPadrao" },
  },
  orcamento: {
    tabela: VARIAVEIS_ORCAMENTO,
    assuntoPadrao: ASSUNTO_ORCAMENTO_PADRAO,
    mensagemPadrao: MENSAGEM_ORCAMENTO_PADRAO,
    doDocumento: "da proposta",
    colunas: { assunto: "assuntoOrcamentoPadrao", mensagem: "mensagemOrcamentoPadrao" },
  },
};

export function ehTipoDeEmail(valor: unknown): valor is TipoDeEmail {
  return valor === "pedido" || valor === "orcamento";
}
