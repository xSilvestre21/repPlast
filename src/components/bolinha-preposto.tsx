/**
 * O ponto colorido que identifica o preposto — na tabela da indústria e no
 * cartão "Por preposto". A cor vem de `corDoPreposto`; o nome ao lado continua
 * cinza, então a cor marca sem disputar com o vermelho e o verde dos valores.
 */
export function BolinhaPreposto({ cor }: { cor: string }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block size-2 shrink-0 rounded-full"
      style={{ background: cor }}
    />
  );
}
