"use client";

/**
 * "Como o sistema funciona": o caminho de um pedido, em sete paradas.
 *
 * A pessoa clica numa parada e lê o que se faz nela, com o atalho para a tela.
 * A linha que liga as paradas enche até a escolhida — é o "você está aqui".
 */

import {
  BadgePercent,
  Factory,
  FileText,
  Package,
  ScrollText,
  Send,
  Users,
  type LucideIcon,
} from "lucide-react";
import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";
import Link from "next/link";
import { useState } from "react";

import { SUAVE } from "../pecas";

type Parada = {
  icone: LucideIcon;
  nome: string;
  titulo: string;
  texto: string;
  dica: string;
  href: string;
  abrir: string;
};

const PARADAS: Parada[] = [
  {
    icone: Factory,
    nome: "Indústria",
    titulo: "1. Cadastre a indústria e a tabela dela",
    texto:
      "Tudo começa pela indústria: o percentual de comissão, o IPI, o dia de faturamento e a tabela de " +
      "materiais (o preço do quilo de cada um). É dessa tabela que o preço dos produtos sai.",
    dica: "Cadastre a tabela antes dos produtos — o saco novo já nasce com o valor do material como sugestão.",
    href: "/fornecedores",
    abrir: "Abrir Fornecedores",
  },
  {
    icone: Users,
    nome: "Cliente",
    titulo: "2. Cadastre o cliente",
    texto:
      "O apelido é o nome pelo qual você chama o cliente no dia a dia, e é por ele que as listas procuram. " +
      "O prazo de pagamento do cadastro (como 28/35/42) já vai para os pedidos dele.",
    dica: "Digite o CEP e o endereço se preenche sozinho.",
    href: "/clientes",
    abrir: "Abrir Clientes",
  },
  {
    icone: Package,
    nome: "Produto",
    titulo: "3. Cadastre o produto",
    texto:
      "Escolha o tipo (saco, fita, frasco, bombona…) e informe as medidas. No saco, o sistema calcula o " +
      "preço do milheiro pelas medidas e pelo material; a descrição que sai no pedido é montada sozinha.",
    dica: "Não digite a descrição à mão: mude a medida e ela muda junto.",
    href: "/produtos",
    abrir: "Abrir Produtos",
  },
  {
    icone: FileText,
    nome: "Orçamento",
    titulo: "4. Faça o orçamento (se o cliente pediu preço)",
    texto:
      "O orçamento é a proposta: os itens, as quantidades e a validade. Ele pode ir até para quem ainda " +
      "não é cliente. Aceito, vira pedido com um clique em “Aceitar e gerar pedido” — sem digitar de novo.",
    dica: "Recusou? Escreva o motivo: ele fica na lista e ajuda na próxima negociação.",
    href: "/orcamentos",
    abrir: "Abrir Orçamentos",
  },
  {
    icone: ScrollText,
    nome: "Pedido",
    titulo: "5. Lance o pedido",
    texto:
      "Escolha o cliente e a indústria, lance os itens e confira os totais com IPI. Depois de salvo, o " +
      "pedido abre só para leitura: para mexer, clique em Editar no alto da página.",
    dica: "O número do pedido é uma sequência de cada indústria: o 133 de uma não briga com o 133 de outra.",
    href: "/pedidos",
    abrir: "Abrir Pedidos",
  },
  {
    icone: Send,
    nome: "Envio",
    titulo: "6. Envie o PDF para a indústria",
    texto:
      "O PDF sai no formato de cada indústria, e o e-mail vai direto do sistema, pela sua caixa de e-mail, " +
      "com o pedido anexado. Enviado, o pedido passa a contar na comissão.",
    dica: "Para enviar, a sua caixa de e-mail precisa estar ligada em Configurações (veja “E-mail: a senha de app”).",
    href: "/pedidos",
    abrir: "Abrir Pedidos",
  },
  {
    icone: BadgePercent,
    nome: "Comissão",
    titulo: "7. Confira e acerte a comissão",
    texto:
      "Cada pedido enviado aparece em Comissões no mês em que a indústria paga. Quando o extrato dela " +
      "chegar, busque o pedido pelo número, lance o que foi recebido e parcele, se for o caso.",
    dica: "Com muitos pedidos da mesma indústria, troque a ordem para “Nº do pedido” e confira de cima para baixo.",
    href: "/comissoes",
    abrir: "Abrir Comissões",
  },
];

export function Caminho() {
  const [atual, setAtual] = useState(0);
  const parada = PARADAS[atual];
  const cheio = PARADAS.length > 1 ? atual / (PARADAS.length - 1) : 0;

  return (
    <div className="space-y-5">
      {/* A trilha rola de lado no celular, em vez de espremer sete paradas. */}
      <div className="overflow-x-auto [scrollbar-width:none] -mx-1 px-1 pb-1">
        <div className="relative min-w-[36rem]">
          {/* O fio, e a parte dele já percorrida. */}
          <div className="absolute left-[7%] right-[7%] top-5 h-0.5 bg-filete-forte" aria-hidden="true">
            <m.div
              className="h-full bg-carimbo origin-left"
              initial={false}
              animate={{ scaleX: cheio }}
              transition={{ duration: 0.5, ease: SUAVE }}
            />
          </div>

          <ol className="relative grid grid-cols-7">
            {PARADAS.map((p, i) => {
              const passada = i <= atual;
              return (
                <li key={p.nome} className="flex justify-center">
                  <button
                    type="button"
                    onClick={() => setAtual(i)}
                    aria-current={i === atual ? "step" : undefined}
                    className="group flex flex-col items-center gap-2 cursor-pointer"
                  >
                    <m.span
                      initial={false}
                      animate={{ scale: i === atual ? 1.15 : 1 }}
                      transition={{ duration: 0.3, ease: SUAVE }}
                      className={`flex size-10 items-center justify-center rounded-full border-2 transition-colors duration-300 ${
                        passada
                          ? "bg-carimbo border-carimbo text-sobre-carimbo"
                          : "bg-folha border-filete-forte text-tinta-3 group-hover:text-tinta"
                      }`}
                    >
                      <p.icone size={17} strokeWidth={2} aria-hidden="true" />
                    </m.span>
                    <span
                      className={`text-mini font-semibold transition-colors ${
                        i === atual ? "text-tinta" : "text-tinta-2 group-hover:text-tinta"
                      }`}
                    >
                      {p.nome}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      <div className="rounded-suave border border-filete bg-folha-2 p-4 sm:p-5 min-h-44">
        <AnimatePresence mode="wait" initial={false}>
          <m.div
            key={parada.nome}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.25, ease: SUAVE }}
          >
            <h3 className="text-realce font-semibold text-tinta">{parada.titulo}</h3>
            <p className="text-corpo text-tinta-2 mt-2 max-w-2xl">{parada.texto}</p>
            <p className="text-mini text-tinta-2 mt-3 max-w-2xl">
              <span className="rotulo text-carimbo mr-2">Dica</span>
              {parada.dica}
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2">
              <Link href={parada.href} className="text-corpo font-semibold text-carimbo hover:underline">
                {parada.abrir} →
              </Link>
              {atual < PARADAS.length - 1 && (
                <button
                  type="button"
                  onClick={() => setAtual(atual + 1)}
                  className="text-corpo text-tinta-2 hover:text-tinta cursor-pointer"
                >
                  Próxima etapa
                </button>
              )}
            </div>
          </m.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
