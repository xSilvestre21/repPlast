import { Cabecalho } from "@/components/ui";

import { criarCliente } from "../acoes";
import { FormularioCliente } from "../formulario";
import { VALORES_VAZIOS } from "../valores";
import { UserRoundPlus } from "lucide-react";
import { Pagina } from "@/components/pagina";

export default function PaginaNovoCliente() {
  return (
    <Pagina>
      <Cabecalho
        voltar={{ href: "/clientes", rotulo: "Clientes" }}
        icone={UserRoundPlus}
        titulo="Novo cliente"
        descricao="Depois de salvar você poderá registrar os códigos que este cliente usa para cada produto."
      />
      <FormularioCliente
        acao={criarCliente}
        valores={VALORES_VAZIOS}
        rotuloEnvio="Cadastrar cliente"
      />
    </Pagina>
  );
}
