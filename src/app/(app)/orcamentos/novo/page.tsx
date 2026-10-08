import { FileText, UserRoundPlus } from "lucide-react";

import { Pagina } from "@/components/pagina";
import { BotaoLink, Cabecalho, EstadoVazio } from "@/components/ui";
import { escopoAtual } from "@/lib/sessao";
import { soIndustriasMarcadas } from "@/lib/industrias-do-ator";

import { criarOrcamento } from "../acoes";
import { FormularioNovoOrcamento } from "./formulario";

export default async function PaginaNovoOrcamento() {
  const { organizacaoId, usuarioId, ehAdmin, db } = await escopoAtual();

  const [clientes, fornecedores] = await Promise.all([
    db.cliente.findMany({
      where: { organizacaoId, ativo: true },
      orderBy: { apelido: "asc" },
      select: { id: true, apelido: true, municipio: true, uf: true },
    }),
    db.fornecedor.findMany({
      where: { organizacaoId, ativo: true, ...soIndustriasMarcadas({ ehAdmin, usuarioId }) },
      orderBy: { nome: "asc" },
      select: { id: true, nome: true, ipiPercentual: true },
    }),
  ]);

  // Cliente não é pré-requisito aqui: dá para cotar para quem ainda não é um.
  if (fornecedores.length === 0) {
    return (
      <Pagina>
        <Cabecalho
          voltar={{ href: "/orcamentos", rotulo: "Orçamentos" }}
          icone={FileText}
          titulo="Novo orçamento"
          acao={
            ehAdmin && (
              <BotaoLink href="/fornecedores/novo" icone={UserRoundPlus}>
                Cadastrar indústria
              </BotaoLink>
            )
          }
        />
        <EstadoVazio>
          {ehAdmin
            ? "Falta cadastrar uma indústria antes de montar uma proposta — é dela que vem o IPI e são dela os produtos."
            : "Nenhuma indústria marcada para você ainda. Quem cadastra e marca é o escritório — peça ao administrador."}
        </EstadoVazio>
      </Pagina>
    );
  }

  return (
    <Pagina>
      <Cabecalho
        voltar={{ href: "/orcamentos", rotulo: "Orçamentos" }}
        icone={FileText}
        titulo="Novo orçamento"
        descricao="O número é do seu escritório, e segue a sua própria sequência."
      />
      <FormularioNovoOrcamento
        acao={criarOrcamento}
        clientes={clientes.map((c) => ({
          id: c.id,
          rotulo: c.apelido,
          detalhe: c.municipio ? `${c.municipio}/${c.uf ?? ""}` : undefined,
        }))}
        fornecedores={fornecedores.map((f) => ({
          id: f.id,
          rotulo: f.nome,
          detalhe: `IPI ${Number(f.ipiPercentual).toLocaleString("pt-BR")}%`,
        }))}
      />
    </Pagina>
  );
}
