import { Factory, Plus } from "lucide-react";

import {
  BotaoLink,
  Cabecalho,
  Cartao,
  CorpoLinha,
  Emblema,
  EstadoVazio,
  FimDaLinha,
  LinhaLista,
  ValorLinha,
  formatarPercentual,
} from "@/components/ui";
import { escopoAtual } from "@/lib/sessao";
import { Pagina } from "@/components/pagina";

export default async function PaginaFornecedores() {
  const { organizacaoId, db } = await escopoAtual();

  const fornecedores = await db.fornecedor.findMany({
    where: { organizacaoId },
    orderBy: { nome: "asc" },
    include: { _count: { select: { produtos: true, aditivos: true } } },
  });

  return (
    <Pagina>
      <Cabecalho
        icone={Factory}
        titulo="Fornecedores"
        descricao="As indústrias que você representa. É aqui que ficam o IPI, a comissão e os aditivos."
        acao={
          <BotaoLink href="/fornecedores/novo" icone={Plus}>
            Nova indústria
          </BotaoLink>
        }
      />

      {fornecedores.length === 0 ? (
        <EstadoVazio icone={Factory}>
          Nenhuma indústria cadastrada ainda.
          <br />
          Comece por aqui: sem fornecedor não é possível cadastrar produto nem lançar pedido.
        </EstadoVazio>
      ) : (
        <Cartao className="divide-y divide-filete overflow-hidden palco">
          {fornecedores.map((f) => (
            <LinhaLista key={f.id} href={`/fornecedores/${f.id}`}>
              <Emblema icone={Factory} tom="fraco" className="size-4" />

              <CorpoLinha
                titulo={f.nome}
                detalhe={
                  <>
                    <span className="numerico">{f._count.produtos}</span> produto(s)
                    {f._count.aditivos > 0 && (
                      <>
                        {" · "}
                        <span className="numerico">{f._count.aditivos}</span> aditivo(s)
                      </>
                    )}
                  </>
                }
              />

              {/* Dois percentuais lado a lado, cada um na sua largura fixa: é o
                  que faz a coluna de comissão cair no mesmo x em toda a lista,
                  em vez de escorregar conforme o IPI ao lado tiver uma casa
                  decimal a mais. */}
              <FimDaLinha>
                <ValorLinha
                  className="w-20"
                  valor={formatarPercentual(f.ipiPercentual.toString())}
                  nota="IPI"
                />
                <ValorLinha
                  className="w-24"
                  valor={formatarPercentual(f.comissaoPercentual.toString())}
                  nota="Comissão"
                />
              </FimDaLinha>
            </LinhaLista>
          ))}
        </Cartao>
      )}
    </Pagina>
  );
}
