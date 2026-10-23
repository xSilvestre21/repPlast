/**
 * O endereço de cliente e indústria numa linha só — "Rua X, 123 - Galpão F".
 *
 * No cadastro, rua, número e complemento são campos separados (o CEP preenche
 * a rua, e a pessoa digita o número). Onde o endereço é lido como uma coisa só
 * — o PDF que vai para a indústria, o resumo do pedido — eles voltam a se
 * juntar, no formato que o SICOV sempre imprimiu.
 */

export type PartesDoEndereco = {
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
};

export function enderecoCompleto({ endereco, numero, complemento }: PartesDoEndereco): string | null {
  const ruaENumero = [endereco, numero].map((parte) => parte?.trim()).filter(Boolean).join(", ");
  const linha = [ruaENumero, complemento?.trim()].filter(Boolean).join(" - ");
  return linha || null;
}
