/**
 * Valores iniciais do formulário de cliente.
 *
 * Vive FORA de `formulario.tsx` de propósito. Aquele arquivo é `"use client"`,
 * e um objeto exportado de um módulo de cliente não chega inteiro ao servidor:
 * o Next o substitui por uma referência, e a página de servidor que tentasse
 * lê-lo receberia um objeto sem os campos. Era o que fazia o formulário nascer
 * com os campos indefinidos — e, no de produto, mostrar a seção da família
 * errada até alguém mexer no seletor.
 */

export type ValoresCliente = {
  apelido: string;
  razaoSocial: string;
  cnpj: string;
  ie: string;
  endereco: string;
  bairro: string;
  cep: string;
  municipio: string;
  uf: string;
  telefone: string;
  email: string;
  emailNfe: string;
  observacoes: string;
};

export const VALORES_VAZIOS: ValoresCliente = {
  apelido: "",
  razaoSocial: "",
  cnpj: "",
  ie: "",
  endereco: "",
  bairro: "",
  cep: "",
  municipio: "",
  uf: "",
  telefone: "",
  email: "",
  emailNfe: "",
  observacoes: "",
};
