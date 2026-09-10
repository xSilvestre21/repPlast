import {
  BotaoLink,
  Cabecalho,
  Cartao,
  EstadoVazio,
  LinhaLista,
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
            <LinhaLista key={f.id} href={`/fornecedores/${f.id}`}>
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
                  <dt className="text-xs text-texto-fraco uppercase tracking-wide">IPI</dt>
                  <dd>{formatarPercentual(f.ipiPercentual.toString())}</dd>
                </div>
                <div>
                  <dt className="text-xs text-texto-fraco uppercase tracking-wide">Comissão</dt>
                  <dd className="texto-gradiente font-semibold">
                    {formatarPercentual(f.comissaoPercentual.toString())}
                  </dd>
                </div>
              </dl>
            </LinhaLista>
          ))}
        </Cartao>
      )}
    </>
  );
}
