import { redirect } from "next/navigation";

/**
 * O painel de comissões é a fase 7. Até lá, a porta de entrada é o cadastro de
 * fornecedores, que é a raiz de tudo: sem indústria não há produto nem pedido.
 */
export default function Inicio() {
  redirect("/fornecedores");
}
