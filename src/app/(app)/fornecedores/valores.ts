/**
 * Valores iniciais do formulário de indústria.
 *
 * Vive FORA de `formulario.tsx` de propósito. Aquele arquivo é `"use client"`,
 * e um objeto exportado de um módulo de cliente não chega inteiro ao servidor:
 * o Next o substitui por uma referência, e a página de servidor que tentasse
 * lê-lo receberia um objeto sem os campos. Era o que fazia o formulário nascer
 * com os campos indefinidos — e, no de produto, mostrar a seção da família
 * errada até alguém mexer no seletor.
 */

import { PAGAMENTO_VAZIO, type DadosPagamento } from "@/lib/dados-pagamento";

export type ValoresFornecedor = {
  nome: string;
  razaoSocial: string;
  cnpj: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cep: string;
  municipio: string;
  uf: string;
  telefone: string;
  email: string;
  /** PIX, banco, conta e favorecido, para copiar e enviar. */
  pagamento: DadosPagamento;
  ipiPercentual: string;
  comissaoPercentual: string;
  fatorKgPadrao: string;
  /** "30", ou vazio quando a indústria paga no mês do vencimento. */
  diaFechamentoComissao: string;
  /** Último pedido emitido para esta indústria — o próximo sai com ele + 1. */
  ultimoNumeroPedido: string;
};

export const VALORES_VAZIOS: ValoresFornecedor = {
  nome: "",
  razaoSocial: "",
  cnpj: "",
  endereco: "",
  numero: "",
  complemento: "",
  bairro: "",
  cep: "",
  municipio: "",
  uf: "",
  telefone: "",
  email: "",
  pagamento: PAGAMENTO_VAZIO,
  ipiPercentual: "",
  comissaoPercentual: "",
  fatorKgPadrao: "",
  diaFechamentoComissao: "",
  ultimoNumeroPedido: "",
};
