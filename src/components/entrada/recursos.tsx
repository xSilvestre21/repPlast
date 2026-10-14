/**
 * O que o sistema faz, em cartões curtos.
 *
 * Cada cartão é um módulo de verdade do sistema, com o nome que ele tem lá
 * dentro — a pessoa que assinar reconhece as telas. O que é só do Max diz
 * isso no próprio cartão, em vez de numa nota de rodapé.
 */

import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  FileSignature,
  Package,
  ShieldCheck,
  Users,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { Placa } from "@/components/ui";

import { Revelar } from "./revelar";

type Tom = "sol" | "mar" | "menta" | "pessego" | "lilas";

const RECURSOS: { icone: LucideIcon; tom: Tom; titulo: string; texto: string; max?: boolean }[] = [
  {
    icone: Package,
    tom: "sol",
    titulo: "Produtos por indústria",
    texto: "Catálogo de cada representada — saco por milheiro ou quilo, stretch por quilo, fita por caixa ou unidade.",
  },
  {
    icone: FileSignature,
    tom: "mar",
    titulo: "Orçamentos",
    texto: "A proposta para o cliente vira pedido com um clique, sem digitar de novo.",
  },
  {
    icone: ClipboardList,
    tom: "menta",
    titulo: "Pedidos com PDF",
    texto: "Numeração por indústria, IPI por item e o PDF no layout que ela espera.",
  },
  {
    icone: Wallet,
    tom: "pessego",
    titulo: "Comissões",
    texto: "Por pedido, por parcela e por mês de entrega — com meta e acerto.",
  },
  {
    icone: Users,
    tom: "lilas",
    titulo: "Clientes e carteira",
    texto: "Quem compra, quem parou de comprar e há quanto tempo — antes que vire cliente perdido.",
  },
  {
    icone: CalendarDays,
    tom: "sol",
    titulo: "Agenda",
    texto: "Visitas e retornos com aviso na véspera, no painel de quem precisa lembrar.",
  },
  {
    icone: BarChart3,
    tom: "mar",
    titulo: "Painel e gráficos",
    texto: "Vendas por indústria, por cliente e por mês, exportáveis em PDF e planilha.",
  },
  {
    icone: UsersRound,
    tom: "menta",
    titulo: "Prepostos",
    texto: "Cada um vê só a própria carteira; a comissão é rateada e o repasse sai pronto.",
    max: true,
  },
  {
    icone: ShieldCheck,
    tom: "pessego",
    titulo: "Dados isolados",
    texto: "Cada escritório num cofre próprio, separado no banco — não só na tela.",
  },
];

export function Recursos() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {RECURSOS.map((recurso, i) => (
        <Revelar key={recurso.titulo} como="li" atraso={(i % 3) * 0.08}>
          <div className="folha elevavel h-full p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <Placa icone={recurso.icone} tom={recurso.tom} />
              {recurso.max && (
                <span className="rounded-full bg-carimbo-fraco text-carimbo text-mini font-semibold px-2.5 py-0.5">
                  Plano Max
                </span>
              )}
            </div>
            <h3 className="mt-4 text-medio font-semibold text-tinta">{recurso.titulo}</h3>
            <p className="mt-1.5 text-corpo text-tinta-2 leading-relaxed">{recurso.texto}</p>
          </div>
        </Revelar>
      ))}
    </ul>
  );
}
