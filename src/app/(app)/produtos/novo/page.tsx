import { BotaoLink, Cabecalho, EstadoVazio } from "@/components/ui";

import { criarProduto } from "../acoes";
import { carregarFornecedores } from "../dados";
import { FormularioProduto, VALORES_VAZIOS } from "../formulario";

export default async function PaginaNovoProduto() {
  const fornecedores = await carregarFornecedores();

  if (fornecedores.length === 0) {
    return (
      <>
        <Cabecalho
          titulo="Novo produto"
          acao={<BotaoLink href="/fornecedores/novo">Cadastrar indústria</BotaoLink>}
        />
        <EstadoVazio>
          Não há indústria cadastrada.
          <br />
          Todo produto pertence a uma, e é dela que vêm o IPI, a comissão e os aditivos.
        </EstadoVazio>
      </>
    );
  }

  return (
    <>
      <Cabecalho
        titulo="Novo produto"
        descricao="Digite as medidas e veja a descrição e o preço se montarem."
      />
      <FormularioProduto
        fornecedores={fornecedores}
        valores={{
          ...VALORES_VAZIOS,
          // Com uma única indústria não faz sentido obrigar a escolha.
          fornecedorId: fornecedores.length === 1 ? fornecedores[0].id : "",
        }}
        acao={criarProduto}
        rotuloEnvio="Cadastrar produto"
      />
    </>
  );
}
