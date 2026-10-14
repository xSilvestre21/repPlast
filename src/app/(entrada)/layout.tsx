/**
 * Telas de entrada: landing com login, cadastro e assinatura.
 *
 * Só a casca. O argumento de venda morava aqui, ao lado do formulário, quando
 * login e cadastro eram a mesma composição; agora cada tela tem a sua — a
 * landing é uma página longa, o cadastro é escolher plano e preencher, e a
 * assinatura é um aviso — e o que é comum entre elas é só o topo
 * (`TopoEntrada`), que cada página põe com as opções de que precisa.
 */
export default function LayoutEntrada({ children }: LayoutProps<"/">) {
  return <main className="flex-1 w-full flex flex-col">{children}</main>;
}
