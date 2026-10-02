import { CalendarDays, Plus } from "lucide-react";

import { ManterEscolhas } from "@/components/manter-escolhas";
import { NavegadorMes } from "@/components/navegador-mes";
import { Pagina } from "@/components/pagina";
import { BotaoLink, Cabecalho } from "@/components/ui";
import { DIAS_DA_LISTA } from "@/lib/agenda";
import { hojeIso, semanasDoMes, somarDias } from "@/lib/calendario";
import { escopoAtual } from "@/lib/sessao";

import { Agenda } from "./agenda";
import { agendaDoIntervalo } from "./consulta";

export default async function PaginaCalendario({ searchParams }: PageProps<"/calendario">) {
  const parametros = await searchParams;
  const hoje = hojeIso();

  const competencia =
    typeof parametros.mes === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(parametros.mes)
      ? parametros.mes
      : hoje.slice(0, 7);

  const { organizacaoId, db, ehAdmin, usuarioId } = await escopoAtual();

  /*
   * Um intervalo só, que cobre a grade do mês mostrado (as seis semanas
   * inteiras, com os dias vizinhos) E os próximos 30 dias da lista — que podem
   * cair em outro mês quando se navega para trás.
   */
  const semanas = semanasDoMes(`${competencia}-01`);
  const de = [semanas[0][0], hoje].sort()[0];
  const ate = [somarDias(semanas.at(-1)!.at(-1)!, 1), somarDias(hoje, DIAS_DA_LISTA)].sort().at(-1)!;

  const [agenda, clientes] = await Promise.all([
    agendaDoIntervalo(
      db,
      organizacaoId,
      { de, ate },
      { usuarioId, apenasDoPreposto: ehAdmin ? null : usuarioId, hoje },
    ),
    // Para o campo "Cliente" do formulário. O RLS já deixa só os que a pessoa vê.
    db.cliente.findMany({
      where: { organizacaoId, ativo: true },
      orderBy: { apelido: "asc" },
      select: { id: true, apelido: true, municipio: true },
    }),
  ]);

  const clientePadrao =
    typeof parametros.cliente === "string" && clientes.some((c) => c.id === parametros.cliente)
      ? parametros.cliente
      : "";

  /** Mantém a visão e os filtros ao trocar de mês pelas setas. */
  const endereco = (mes: string) => {
    const busca = new URLSearchParams();
    for (const [chave, valor] of Object.entries(parametros)) {
      if (typeof valor === "string" && !["mes", "novo", "cliente"].includes(chave)) {
        busca.set(chave, valor);
      }
    }
    if (mes !== hoje.slice(0, 7)) busca.set("mes", mes);
    const consulta = busca.toString();
    return consulta ? `/calendario?${consulta}` : "/calendario";
  };

  return (
    <Pagina>
      <Cabecalho
        icone={CalendarDays}
        titulo="Calendário"
        descricao="Seus compromissos, as entregas prometidas, as parcelas a receber e os clientes a ligar."
        acao={
          // No cabeçalho, como o "Novo pedido": é a ação principal da tela.
          // Um link com `?novo=1`, que a agenda lê para abrir o formulário — e
          // `ManterEscolhas` leva junto o mês, a visão e os filtros atuais.
          <ManterEscolhas doLink={["novo"]}>
            <BotaoLink href="/calendario?novo=1" icone={Plus}>
              Novo compromisso
            </BotaoLink>
          </ManterEscolhas>
        }
      />

      {/* A visão e os filtros escolhidos depois do carregamento vão junto. */}
      <ManterEscolhas>
        <NavegadorMes competencia={competencia} href={endereco} className="mb-6" />
      </ManterEscolhas>

      <Agenda
        competencia={competencia}
        hoje={hoje}
        semanas={semanas}
        compromissos={agenda.compromissos}
        automaticos={agenda.automaticos}
        clientes={clientes.map((c) => ({
          id: c.id,
          rotulo: c.apelido,
          detalhe: c.municipio ?? undefined,
        }))}
        abrirNovo={parametros.novo === "1"}
        clientePadrao={clientePadrao}
      />
    </Pagina>
  );
}
