import { Cabecalho } from "@/components/ui";

import { criarFornecedor } from "../acoes";
import { FormularioFornecedor, VALORES_VAZIOS } from "../formulario";

export default function PaginaNovoFornecedor() {
  return (
    <>
      <Cabecalho
        titulo="Nova indústria"
        descricao="Depois de salvar você poderá subir o logo dela e cadastrar os aditivos."
      />
      <FormularioFornecedor
        acao={criarFornecedor}
        valores={VALORES_VAZIOS}
        rotuloEnvio="Cadastrar indústria"
      />
    </>
  );
}
