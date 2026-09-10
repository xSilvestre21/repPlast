import { Plus, UserRoundPlus, Users } from "lucide-react";

import { BotaoLink, Cabecalho, Cartao, EstadoVazio, LinhaLista } from "@/components/ui";
import { dbParaOrganizacao } from "@/lib/db";
import { organizacaoAtual } from "@/lib/sessao";
import { Pagina } from "@/components/pagina";

/**
 * Iniciais do cliente, para o avatar da linha.
 *
 * Numa lista de razões sociais parecidas ("MARIOL EMBALAGENS", "MARIPLAST"),
 * duas letras em destaque dão à linha uma âncora visual que o texto corrido
 * não dá.
 */
function iniciaisDe(nome: string): string {
  // O hífen separa tanto quanto o espaço: "AN-PARAFUSOS" são duas palavras
  // para quem lê, e cortar só no espaço devolveria um "A" solitário.
  const partes = nome.split(/[\s-]+/).filter(Boolean);
  if (partes.length === 0) return "?";

  // Nome de uma palavra só rende as duas primeiras letras — uma letra sozinha
  // repete demais numa lista e deixa de distinguir qualquer coisa.
  if (partes.length === 1) return partes[0].slice(0, 2).toUpperCase();

  return partes
    .slice(0, 2)
    .map((parte) => parte[0].toUpperCase())
    .join("");
}

export default async function PaginaClientes() {
  const organizacaoId = await organizacaoAtual();
  const db = dbParaOrganizacao(organizacaoId);

  const clientes = await db.cliente.findMany({
    where: { organizacaoId, ativo: true },
    orderBy: { apelido: "asc" },
    include: { _count: { select: { pedidos: true } } },
  });

  return (
    <Pagina>
      <Cabecalho
        icone={Users}
        titulo="Clientes"
        descricao="Os dados fiscais daqui saem impressos no cabeçalho de todo pedido."
        acao={
          <BotaoLink href="/clientes/novo" icone={Plus}>
            Novo cliente
          </BotaoLink>
        }
      />

      {clientes.length === 0 ? (
        <EstadoVazio icone={UserRoundPlus}>Nenhum cliente cadastrado ainda.</EstadoVazio>
      ) : (
        <Cartao className="divide-y divide-filete overflow-hidden palco">
          {clientes.map((cliente) => (
            <LinhaLista key={cliente.id} href={`/clientes/${cliente.id}`}>
              <span
                aria-hidden="true"
                // Neutro, e não vermelho: o carimbo marca o que aconteceu com um
                // pedido. Gastá-lo numa inicial de cliente esvaziaria o sinal.
                className="grid place-items-center size-9 shrink-0 border border-filete
                  bg-folha-2 text-tinta-3 text-[0.6875rem] font-semibold tracking-wide"
              >
                {iniciaisDe(cliente.apelido)}
              </span>

              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{cliente.apelido}</div>
                <div className="text-sm text-tinta-2 truncate">{cliente.razaoSocial}</div>
              </div>

              <div className="text-right text-sm">
                <div className="text-tinta-2 numerico">{cliente.cnpj ?? "sem CNPJ"}</div>
                <div className="text-xs text-tinta-3">
                  {cliente.municipio ? `${cliente.municipio}/${cliente.uf ?? ""}` : "—"}
                  {cliente._count.pedidos > 0 && ` · ${cliente._count.pedidos} pedido(s)`}
                </div>
              </div>
            </LinhaLista>
          ))}
        </Cartao>
      )}
    </Pagina>
  );
}
