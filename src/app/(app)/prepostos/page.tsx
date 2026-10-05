import Link from "next/link";
import { notFound } from "next/navigation";
import { Factory, Plus, Sparkles, Users } from "lucide-react";

import { nomeDoMes } from "@/components/navegador-mes";
import { BotaoLink, Cabecalho, Cartao, EstadoVazio, Placa, Selo, formatarMoeda } from "@/components/ui";
import { Pagina } from "@/components/pagina";
import { competenciaDe } from "@/lib/comissao";
import { escreverNumeroBr } from "@/lib/numero-br";
import { escopoAtual } from "@/lib/sessao";

import { AvatarPreposto } from "./avatar-preposto";
import { prepostosComComissao } from "./consulta";

/**
 * A equipe em cards: um por preposto, com o que se quer saber de relance —
 * o acordo, a carteira e quanto ele já fez no mês. O card inteiro abre a ficha
 * (`/prepostos/[id]`), onde estão o resto e a edição. Inscrever é uma página
 * própria (`/prepostos/novo`), como o cadastro de cliente e de indústria.
 */
export default async function PaginaPrepostos() {
  const { organizacaoId, db, ehAdmin, plano } = await escopoAtual();

  // Preposto não administra preposto. Some da navegação dele, e some daqui.
  if (!ehAdmin) notFound();

  if (plano !== "PLUS") return <ConvitePlus />;

  const competencia = competenciaDe(new Date());
  const todos = await prepostosComComissao(db, organizacaoId, competencia);
  // Quem tem acesso primeiro, cada grupo em ordem alfabética.
  const prepostos = [...todos].sort(
    (a, b) => Number(b.ativo) - Number(a.ativo) || a.nomeCompleto.localeCompare(b.nomeCompleto, "pt-BR"),
  );
  // Só o mês ("outubro"): com o ano, o rótulo não cabia na coluna do card.
  const mes = nomeDoMes(competencia).split(" ")[0].toLowerCase();

  return (
    <Pagina>
      <Cabecalho
        icone={Users}
        titulo="Prepostos"
        descricao="Quem vende por você. Cada um entra com o próprio login e enxerga apenas a carteira dele — inclusive a comissão."
        acao={
          <BotaoLink href="/prepostos/novo" icone={Plus}>
            Novo preposto
          </BotaoLink>
        }
      />

      <div className="space-y-5">
        {prepostos.length === 0 ? (
          <EstadoVazio icone={Users}>
            Nenhum preposto inscrito ainda.
            <br />
            Quem você inscrever aqui entra com o próprio login e enxerga só a carteira dele.
          </EstadoVazio>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {prepostos.map((p) => (
              <Link key={p.id} href={`/prepostos/${p.id}`} className="block group">
                <Cartao className={`h-full elevavel p-5 flex flex-col gap-5 ${p.ativo ? "" : "opacity-70"}`}>
                  <div className="flex items-center gap-3.5 min-w-0">
                    <AvatarPreposto nome={p.nomeCompleto} cor={p.cor} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-realce font-semibold truncate group-hover:text-carimbo transition-colors">
                          {p.nomeCompleto}
                        </span>
                        {!p.ativo && <Selo>sem acesso</Selo>}
                      </div>
                      <div className="text-mini text-tinta-3 truncate">{p.email}</div>
                    </div>
                  </div>

                  <dl className="grid grid-cols-3 gap-3">
                    <Numero
                      valor={
                        p.comissaoPercentualPadrao
                          ? `${escreverNumeroBr(p.comissaoPercentualPadrao.toString())}%`
                          : "—"
                      }
                      rotulo="da comissão"
                    />
                    <Numero
                      valor={p._count.clientes}
                      rotulo={p._count.clientes === 1 ? "cliente" : "clientes"}
                    />
                    <Numero valor={formatarMoeda(p.comissao.prevista)} rotulo={`em ${mes}`} />
                  </dl>

                  <div className="mt-auto pt-4 border-t border-filete flex items-center gap-2 text-mini text-tinta-3 min-w-0">
                    <Factory size={13} strokeWidth={2} aria-hidden="true" className="shrink-0" />
                    <span className="truncate">
                      {p.fornecedores.length === 0
                        ? "Atende todas as indústrias"
                        : p.fornecedores
                            .map((f) => f.fornecedor.nome)
                            .sort()
                            .join(", ")}
                    </span>
                  </div>
                </Cartao>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Pagina>
  );
}

function Numero({ valor, rotulo }: { valor: React.ReactNode; rotulo: string }) {
  return (
    <div className="min-w-0">
      <dt className="sr-only">{rotulo}</dt>
      <dd className="numerico text-corpo font-semibold text-tinta truncate">{valor}</dd>
      <dd className="text-mini text-tinta-3 truncate">{rotulo}</dd>
    </div>
  );
}

/**
 * O que a pessoa vê quando o escritório está no plano Padrão.
 *
 * Um 404 seria mentira: a seção existe, ela só não está contratada. E o convite
 * fica sem botão de propósito — não há cobrança no sistema, então prometer
 * "assinar agora" levaria a lugar nenhum.
 */
function ConvitePlus() {
  return (
    <Pagina>
      <Cabecalho
        icone={Users}
        titulo="Prepostos"
        descricao="Põe gente para vender por você, com login próprio."
      />

      <Cartao marcada className="p-6 sm:p-8">
        <div className="flex flex-col gap-4 max-w-xl">
          <Placa icone={Sparkles} tom="sol" />
          <h2 className="text-realce font-semibold tracking-[-0.01em]">
            Isto faz parte do plano Plus
          </h2>
          <p className="text-corpo text-tinta-2 leading-relaxed">
            No Plus, você inscreve prepostos e dá acesso a eles. Cada um entra com o próprio
            e-mail e enxerga apenas os clientes, pedidos e comissões que são dele — o que você
            vê continua sendo tudo.
          </p>
          <p className="text-corpo text-tinta-2 leading-relaxed">
            A comissão passa a ser rateada: a indústria paga ao escritório, e cada preposto
            recebe a fatia combinada com ele.
          </p>
          <p className="text-corpo text-tinta-3 leading-relaxed">
            Seu escritório está no plano Padrão. Fale comigo para trocar.
          </p>
        </div>
      </Cartao>
    </Pagina>
  );
}
