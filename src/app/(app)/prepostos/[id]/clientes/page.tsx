import { notFound } from "next/navigation";
import { Users } from "lucide-react";

import { Pagina } from "@/components/pagina";
import { Cabecalho } from "@/components/ui";
import { nomeCompleto } from "@/lib/nome-usuario";
import { escopoAtual } from "@/lib/sessao";

import { definirClientesDoPreposto } from "../../acoes";
import { ListaClientesDoPreposto } from "./lista-clientes";

/**
 * Os clientes que o preposto atende, marcados de uma vez.
 *
 * O mesmo vínculo da ficha do cliente (campo Prepostos), visto pelo outro lado:
 * lá se marcam os prepostos de um cliente; aqui, os clientes de um preposto.
 */
export default async function PaginaClientesDoPreposto({
  params,
}: PageProps<"/prepostos/[id]/clientes">) {
  const { id } = await params;
  const { organizacaoId, db, ehAdmin, plano } = await escopoAtual();

  // O mesmo porteiro da ficha: preposto não administra preposto.
  if (!ehAdmin || plano !== "PLUS") notFound();

  const [preposto, clientes] = await Promise.all([
    db.usuario.findFirst({
      where: { id, organizacaoId, papel: "REPRESENTANTE" },
      select: { id: true, nome: true, sobrenome: true },
    }),
    // Os inativos entram só se já forem dele: escondê-los faria o vínculo
    // sumir no primeiro "Salvar", sem ninguém ter desmarcado.
    db.cliente.findMany({
      where: {
        organizacaoId,
        OR: [{ ativo: true }, { prepostos: { some: { usuarioId: id } } }],
      },
      orderBy: { apelido: "asc" },
      select: {
        id: true,
        apelido: true,
        razaoSocial: true,
        municipio: true,
        uf: true,
        ativo: true,
        prepostos: { select: { usuario: { select: { id: true, nome: true, sobrenome: true } } } },
      },
    }),
  ]);

  if (!preposto) notFound();

  const nome = nomeCompleto(preposto);

  return (
    <Pagina>
      <Cabecalho
        voltar={{ href: `/prepostos/${preposto.id}`, rotulo: nome }}
        icone={Users}
        titulo={`Clientes de ${preposto.nome}`}
        descricao="Marque os clientes que ele atende: ele passa a ver o cadastro, os produtos e lançar pedido para eles. Um cliente pode ser de mais de um preposto — e a comissão de cada pedido se divide só com quem for escolhido no próprio pedido."
      />
      <ListaClientesDoPreposto
        nome={preposto.nome}
        salvar={definirClientesDoPreposto.bind(null, preposto.id)}
        clientes={clientes.map((c) => ({
          id: c.id,
          apelido: c.apelido,
          razaoSocial: c.razaoSocial,
          lugar: [c.municipio, c.uf].filter(Boolean).join(" / "),
          ativo: c.ativo,
          marcado: c.prepostos.some((v) => v.usuario.id === preposto.id),
          outros: c.prepostos
            .filter((v) => v.usuario.id !== preposto.id)
            .map((v) => nomeCompleto(v.usuario)),
        }))}
      />
    </Pagina>
  );
}
