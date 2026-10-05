import { iniciaisDe } from "@/components/ui";

/**
 * O disco com as iniciais do preposto, na cor dele.
 *
 * É a mesma cor da linha dele em Comissões e da fatia dele nos gráficos: quem
 * vê "MA" em lilás aqui reconhece a Maria lá, sem ler o nome.
 */
export function AvatarPreposto({
  nome,
  cor,
  grande = false,
}: {
  nome: string;
  cor: string;
  grande?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`grid place-items-center shrink-0 rounded-full font-semibold ${
        grande ? "size-14 text-realce" : "size-11 text-corpo"
      }`}
      style={{
        color: cor,
        background: `color-mix(in srgb, ${cor} 16%, transparent)`,
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${cor} 35%, transparent)`,
      }}
    >
      {iniciaisDe(nome)}
    </span>
  );
}
