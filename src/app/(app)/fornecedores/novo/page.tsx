import { redirect } from "next/navigation";

import { Cabecalho } from "@/components/ui";
import { escopoAtual } from "@/lib/sessao";

import { criarFornecedor } from "../acoes";
import { FormularioFornecedor } from "../formulario";
import { VALORES_VAZIOS } from "../valores";
import { Factory } from "lucide-react";
import { Pagina } from "@/components/pagina";

export default async function PaginaNovoFornecedor() {
  // Cadastro é do administrador; o preposto que chega por link volta à lista.
  if (!(await escopoAtual()).ehAdmin) redirect("/fornecedores");

  return (
    <Pagina>
      <Cabecalho
        voltar={{ href: "/fornecedores", rotulo: "Fornecedores" }}
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
