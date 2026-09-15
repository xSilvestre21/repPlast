import { BotaoLink, Cabecalho, EstadoVazio } from "@/components/ui";

import { criarProduto } from "../acoes";
import { carregarClientes, carregarFornecedores } from "../dados";
import { FormularioProduto } from "../formulario";
import { VALORES_VAZIOS } from "../valores";
import { Factory, PackagePlus } from "lucide-react";
import { Pagina } from "@/components/pagina";

export default async function PaginaNovoProduto() {
  const [fornecedores, clientes] = await Promise.all([
    carregarFornecedores(),
    carregarClientes(),
  ]);

  if (fornecedores.length === 0) {
    return (
      <Pagina>
        <Cabecalho
          icone={PackagePlus}
          titulo="Novo produto"
          acao={
            <BotaoLink href="/fornecedores/novo" icone={Factory}>
              Cadastrar indústria
            </BotaoLink>
          }
        />
        <EstadoVazio icone={Factory}>
          Não há indústria cadastrada.
          <br />
          Todo produto pertence a uma, e é dela que vêm o IPI, a comissão e os aditivos.
        </EstadoVazio>
      </Pagina>
    );
  }

  return (
    <Pagina>
      <Cabecalho
        icone={PackagePlus}
        titulo="Novo produto"
        descricao="Digite as medidas e veja a descrição e o preço se montarem."
      />
      <FormularioProduto
        fornecedores={fornecedores}
        clientes={clientes}
        valores={{
          ...VALORES_VAZIOS,
          // Com uma única indústria não faz sentido obrigar a escolha.
          fornecedorId: fornecedores.length === 1 ? fornecedores[0].id : "",
        }}
        acao={criarProduto}
        rotuloEnvio="Cadastrar produto"
      />
    </Pagina>
  );
}
