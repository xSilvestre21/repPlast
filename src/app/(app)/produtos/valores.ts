/**
 * Valores iniciais do formulário de produto.
 *
 * Vive FORA de `formulario.tsx` de propósito. Aquele arquivo é `"use client"`,
 * e um objeto exportado de um módulo de cliente não chega inteiro ao servidor:
 * o Next o substitui por uma referência, e a página de servidor que tentasse
 * lê-lo receberia um objeto sem os campos. Era o que fazia o formulário nascer
 * com os campos indefinidos — e, no de produto, mostrar a seção da família
 * errada até alguém mexer no seletor.
 */

export type ValoresProduto = {
  fornecedorId: string;
  familia: string;
  codigoFornecedor: string;
  descricao: string;
  material: string;
  complemento: string;
  larguraCm: string;
  comprimentoCm: string;
  espessuraMm: string;
  sanfona: string;
  fatorKg: string;
  larguraMm: string;
  metragemM: string;
  micragem: string;
  unidadesPorCaixa: string;
  precoUnidade: string;
  precoCaixa: string;
  precoKg: string;
  aditivos: string[];
};

export const VALORES_VAZIOS: ValoresProduto = {
  fornecedorId: "",
  familia: "SACO",
  codigoFornecedor: "",
  descricao: "",
  material: "",
  complemento: "",
  larguraCm: "",
  comprimentoCm: "",
  espessuraMm: "",
  sanfona: "",
  fatorKg: "",
  larguraMm: "",
  metragemM: "",
  micragem: "",
  unidadesPorCaixa: "",
  precoUnidade: "",
  precoCaixa: "",
  precoKg: "",
  aditivos: [],
};
