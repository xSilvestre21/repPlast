"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState, type ComponentProps, type ReactNode } from "react";

import { CLASSE_CONTROLE, CLASSE_ERRO } from "./controle";
import { useCampoDoFormulario } from "./contexto-formulario";

/*
 * Campo com caixa preenchida.
 *
 * O fundo cinza é o que diz "escreva aqui" antes de a pessoa clicar — num
 * formulário de vinte campos, o filete embaixo dependia da pessoa já saber
 * onde era o campo. Ao focar, o fundo some, a borda vira azul e o anel abre:
 * o campo ativo é o único elemento branco da coluna.
 *
 * Rótulo e rodapé são os mesmos nos três controles.
 *
 * Antes não eram: `Campo` tinha rótulo, dica e erro; `Selecao` tinha rótulo e
 * dica; `AreaTexto` não tinha nada, e cada tela montava o `<label>` na mão com
 * um espaçamento diferente. Era metade do "formulário bagunçado".
 *
 * Dentro de um `Formulario`, cada controle acha sozinho o próprio erro e o
 * valor que a pessoa tinha digitado, pelo `name`. A prop `erro` continua
 * valendo e ganha da do formulário — é o caso da célula de tabela, cujo nome
 * se repete em toda linha.
 */

export function Rotulo({ children }: { children: ReactNode }) {
  return <span className="rotulo block mb-1.5 text-tinta-2">{children}</span>;
}

/**
 * O espaço de um rótulo, sem texto — para o botão que divide a linha com um
 * campo. Com `items-start`, o botão fica na altura da caixa mesmo quando a
 * frase de erro aparece embaixo dela; com `items-end`, ele descia junto com
 * a frase. Só em tela larga: no celular a linha quebra e o botão vai embaixo.
 */
export function EspacoDoRotulo() {
  return (
    <span aria-hidden="true" className="rotulo mb-1.5 hidden sm:block invisible">
      &nbsp;
    </span>
  );
}

/**
 * Erro OU dica, nunca os dois: com erro, a dica já não é o que importa.
 *
 * O `id` liga o texto ao controle (`aria-describedby`): o leitor de tela lê o
 * erro ao chegar no campo, e não só quando ele aparece.
 */
export function RodapeCampo({ erro, dica, id }: { erro?: string; dica?: string; id?: string }) {
  if (erro) {
    return (
      <span id={id} role="alert" className="block text-mini text-perigo mt-1.5">
        {erro}
      </span>
    );
  }
  if (dica) {
    return (
      <span id={id} className="block text-mini text-tinta-3 mt-1.5">
        {dica}
      </span>
    );
  }
  return null;
}

/**
 * O que os três controles têm em comum: erro (o explícito ganha), valor
 * digitado de volta e a ligação acessível com o rodapé.
 */
function useControle<T extends { name?: string; defaultValue?: unknown; value?: unknown }>(
  props: T,
  erroExplicito: string | undefined,
  dica: string | undefined,
) {
  const id = useId();
  const formulario = useCampoDoFormulario(props.name);
  const erro = erroExplicito ?? formulario.erro;

  // Controle CONTROLADO (`value`) é da tela; só o não controlado volta com o
  // que foi digitado.
  const defaultValue =
    props.value === undefined && formulario.valorDigitado !== undefined
      ? formulario.valorDigitado
      : props.defaultValue;

  return {
    erro,
    idRodape: erro || dica ? `${id}-rodape` : undefined,
    defaultValue,
  };
}

export function Campo({
  rotulo,
  dica,
  erro: erroExplicito,
  sufixo,
  adorno,
  className = "",
  ...props
}: ComponentProps<"input"> & {
  rotulo: string;
  dica?: string;
  erro?: string;
  sufixo?: string;
  /** Botão dentro da caixa, à direita — o olho do `CampoSenha`. */
  adorno?: ReactNode;
}) {
  const { erro, idRodape, defaultValue } = useControle(props, erroExplicito, dica);

  return (
    <label className={`block ${className}`}>
      <Rotulo>{rotulo}</Rotulo>
      <div className="relative">
        <input
          {...props}
          defaultValue={defaultValue as ComponentProps<"input">["defaultValue"]}
          aria-invalid={erro ? true : undefined}
          aria-describedby={idRodape}
          className={`${CLASSE_CONTROLE} ${sufixo || adorno ? "pr-11" : ""} ${erro ? CLASSE_ERRO : ""} ${
            props.type === "number" ? "numerico text-right" : ""
          }`}
        />
        {sufixo && (
          <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-mini text-tinta-3 pointer-events-none">
            {sufixo}
          </span>
        )}
        {adorno}
      </div>
      <RodapeCampo erro={erro} dica={dica} id={idRodape} />
    </label>
  );
}

/**
 * Campo de senha com o olho: mostra o que foi digitado, para conferir antes de
 * enviar — a senha de app de 16 letras, sobretudo, é fácil de colar errado.
 *
 * O botão vem DEPOIS do input dentro do `<label>`: o rótulo continua
 * apontando para a caixa, não para o botão.
 */
export function CampoSenha(props: Omit<ComponentProps<typeof Campo>, "type" | "sufixo" | "adorno">) {
  const [visivel, setVisivel] = useState(false);
  // O ícone mostra o estado: riscado com a senha escondida, aberto com ela à vista.
  const Icone = visivel ? Eye : EyeOff;

  return (
    <Campo
      {...props}
      type={visivel ? "text" : "password"}
      adorno={
        <button
          type="button"
          onClick={() => setVisivel((atual) => !atual)}
          aria-label={visivel ? "Esconder a senha" : "Mostrar a senha"}
          aria-pressed={visivel}
          title={visivel ? "Esconder a senha" : "Mostrar a senha"}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 size-8 grid place-items-center rounded-full
            text-tinta-3 hover:text-carimbo cursor-pointer"
        >
          <Icone size={16} aria-hidden="true" />
        </button>
      }
    />
  );
}

export function Selecao({
  rotulo,
  dica,
  erro: erroExplicito,
  children,
  className = "",
  ...props
}: ComponentProps<"select"> & { rotulo: string; dica?: string; erro?: string }) {
  const { erro, idRodape, defaultValue } = useControle(props, erroExplicito, dica);

  return (
    <label className={`block ${className}`}>
      <Rotulo>{rotulo}</Rotulo>
      <select
        {...props}
        defaultValue={defaultValue as ComponentProps<"select">["defaultValue"]}
        aria-invalid={erro ? true : undefined}
        aria-describedby={idRodape}
        className={`${CLASSE_CONTROLE} ${erro ? CLASSE_ERRO : ""} appearance-none pr-9 bg-[position:right_0.75rem_center] bg-no-repeat bg-[length:0.65rem] bg-[image:var(--seta-selecao)]`}
      >
        {children}
      </select>
      <RodapeCampo erro={erro} dica={dica} id={idRodape} />
    </label>
  );
}

/**
 * Área de texto.
 *
 * `rotulo` é opcional aqui, ao contrário de `Campo`: a caixa de condições da
 * proposta ocupa a linha inteira debaixo de um título de seção que já diz o
 * que ela é, e um rótulo em cima seria a mesma palavra duas vezes.
 */
export function AreaTexto({
  rotulo,
  dica,
  erro: erroExplicito,
  className = "",
  ...props
}: ComponentProps<"textarea"> & { rotulo?: string; dica?: string; erro?: string }) {
  const { erro, idRodape, defaultValue } = useControle(props, erroExplicito, dica);

  const caixa = (
    <textarea
      {...props}
      defaultValue={defaultValue as ComponentProps<"textarea">["defaultValue"]}
      aria-invalid={erro ? true : undefined}
      aria-describedby={idRodape}
      className={`${CLASSE_CONTROLE} resize-y ${erro ? CLASSE_ERRO : ""} ${
        rotulo ? "" : className
      }`}
    />
  );

  if (!rotulo) {
    if (!erro && !dica) return caixa;
    return (
      <div className={className}>
        {caixa}
        <RodapeCampo erro={erro} dica={dica} id={idRodape} />
      </div>
    );
  }

  return (
    <label className={`block ${className}`}>
      <Rotulo>{rotulo}</Rotulo>
      {caixa}
      <RodapeCampo erro={erro} dica={dica} id={idRodape} />
    </label>
  );
}
