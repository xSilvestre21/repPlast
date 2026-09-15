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

export type ValoresFornecedor = {
  nome: string;
  razaoSocial: string;
  cnpj: string;
  emailsPedido: string;
  endereco: string;
  bairro: string;
  cep: string;
  municipio: string;
  uf: string;
  telefone: string;
  email: string;
  ipiPercentual: string;
  comissaoPercentual: string;
  fatorKgPadrao: string;
};

export const VALORES_VAZIOS: ValoresFornecedor = {
  nome: "",
  razaoSocial: "",
  cnpj: "",
  emailsPedido: "",
  endereco: "",
  bairro: "",
  cep: "",
  municipio: "",
  uf: "",
  telefone: "",
  email: "",
  ipiPercentual: "",
  comissaoPercentual: "",
  fatorKgPadrao: "",
};
