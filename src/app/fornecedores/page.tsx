import Link from "next/link";

import {
  BotaoLink,
  Cabecalho,
  Cartao,
  EstadoVazio,
  formatarPercentual,
} from "@/components/ui";
import { dbParaOrganizacao } from "@/lib/db";
import { organizacaoAtual } from "@/lib/sessao";

export default async function PaginaFornecedores() {
  const organizacaoId = await organizacaoAtual();
  const db = dbParaOrganizacao(organizacaoId);

  const fornecedores = await db.fornecedor.findMany({
    where: { organizacaoId },
    orderBy: { nome: "asc" },
    include: { _count: { select: { produtos: true, faixas: true, aditivos: true } } },
  });

  return (
    <>
      <Cabecalho
        titulo="Fornecedores"
        descricao="As indústrias que você representa. É aqui que ficam o IPI, a comissão e os aditivos."
        acao={<BotaoLink href="/fornecedores/novo">Nova indústria</BotaoLink>}
      />

      {fornecedores.length === 0 ? (
        <EstadoVazio>
          Nenhuma indústria cadastrada ainda.
          <br />
          Comece por aqui: sem fornecedor não é possível cadastrar produto nem lançar pedido.
        </EstadoVazio>
      ) : (
        <Cartao className="divide-y divide-borda">
          {fornecedores.map((f) => (
            <Link
              key={f.id}
              href={`/fornecedores/${f.id}`}
              className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4 hover:bg-superficie-alta/60 transition-colors first:rounded-t-lg last:rounded-b-lg"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{f.nome}</div>
                <div className="text-sm text-texto-suave truncate">
                  {f._count.produtos} produto(s)
                  {f._count.faixas > 0 && ` · ${f._count.faixas} faixa(s)`}
                  {f._count.aditivos > 0 && ` · ${f._count.aditivos} aditivo(s)`}
                </div>
              </div>

              <dl className="flex gap-6 text-sm numerico">
                <div>
                  <dt className="text-xs text-texto-fraco">IPI</dt>
                  <dd>{formatarPercentual(f.ipiPercentual.toString())}</dd>
                </div>
                <div>
                  <dt className="text-xs text-texto-fraco">Comissão</dt>
                  <dd className="text-acento">
                    {formatarPercentual(f.comissaoPercentual.toString())}
                  </dd>
                </div>
              </dl>
            </Link>
          ))}
        </Cartao>
      )}
    </>
  );
}
