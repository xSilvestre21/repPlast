import { Cabecalho } from "@/components/ui";

import { criarCliente } from "../acoes";
import { FormularioCliente, VALORES_VAZIOS } from "../formulario";

export default function PaginaNovoCliente() {
  return (
    <>
      <Cabecalho
        titulo="Novo cliente"
        descricao="Depois de salvar você poderá registrar os códigos que este cliente usa para cada produto."
      />
      <FormularioCliente
        acao={criarCliente}
        valores={VALORES_VAZIOS}
        rotuloEnvio="Cadastrar cliente"
      />
    </>
  );
}
