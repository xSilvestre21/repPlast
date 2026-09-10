import { Cabecalho } from "@/components/ui";

import { criarFornecedor } from "../acoes";
import { FormularioFornecedor, VALORES_VAZIOS } from "../formulario";

export default function PaginaNovoFornecedor() {
  return (
    <>
      <Cabecalho
        titulo="Nova indústria"
        descricao="Depois de salvar você poderá cadastrar as faixas de comissão e os aditivos."
      />
      <FormularioFornecedor
        acao={criarFornecedor}
        valores={VALORES_VAZIOS}
        rotuloEnvio="Cadastrar indústria"
      />
    </>
  );
}
