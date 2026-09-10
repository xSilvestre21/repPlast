import { Cabecalho } from "@/components/ui";

import { criarFornecedor } from "../acoes";
import { FormularioFornecedor } from "../formulario";
import { VALORES_VAZIOS } from "../valores";
import { Factory } from "lucide-react";
import { Pagina } from "@/components/pagina";

export default function PaginaNovoFornecedor() {
  return (
    <Pagina>
      <Cabecalho
        icone={Factory}
        titulo="Nova indústria"
        descricao="Depois de salvar você poderá subir o logo dela e cadastrar os aditivos."
      />
      <FormularioFornecedor
        acao={criarFornecedor}
        valores={VALORES_VAZIOS}
        rotuloEnvio="Cadastrar indústria"
      />
    </Pagina>
  );
}
