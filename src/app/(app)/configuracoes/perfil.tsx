"use client";

/**
 * Nome, sobrenome e telefone de quem está logado.
 *
 * Existia só na ficha do preposto, editada pelo administrador; o próprio
 * administrador, que se cadastrou sozinho, não tinha onde corrigir um nome
 * digitado errado — e o nome assina as propostas e aparece no menu.
 */

import { BadgeCheck } from "lucide-react";
import { useActionState } from "react";

import { CampoTelefone } from "@/components/campo-mascarado";
import { ErroGeral, Formulario } from "@/components/formulario";
import { Botao, Campo, Mensagem, SecaoCartao } from "@/components/ui";

import type { EstadoConta } from "./acoes";

export function FormPerfil({
  nome,
  sobrenome,
  telefone,
  ehAdmin,
  salvar,
}: {
  nome: string;
  sobrenome: string;
  telefone: string;
  ehAdmin: boolean;
  salvar: (estado: EstadoConta, formData: FormData) => Promise<EstadoConta>;
}) {
  const [estado, enviar, salvando] = useActionState(salvar, {});

  return (
    <SecaoCartao
      icone={BadgeCheck}
      titulo="Nome e telefone"
      descricao="O nome aparece no menu, assina o rodapé das propostas e sai como vendedor no pedido."
    >
      <Formulario estado={estado} action={enviar} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo name="nome" rotulo="Nome" required placeholder="João" defaultValue={nome} autoComplete="given-name" />
          <Campo
            name="sobrenome"
            rotulo="Sobrenome"
            required={ehAdmin}
            placeholder="da Silva"
            defaultValue={sobrenome}
            autoComplete="family-name"
            dica={ehAdmin ? "O pagamento da assinatura pede o nome completo." : undefined}
          />
          <CampoTelefone name="telefone" rotulo="Telefone" defaultValue={telefone} />
        </div>

        <ErroGeral />
        <Mensagem tom="verde">{estado.ok}</Mensagem>

        <div className="flex justify-end">
          <Botao type="submit" variante="secundaria" carregando={salvando}>
            {salvando ? "Salvando…" : "Salvar perfil"}
          </Botao>
        </div>
      </Formulario>
    </SecaoCartao>
  );
}
