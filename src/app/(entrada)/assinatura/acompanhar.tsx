"use client";

/**
 * As duas peças com estado da tela de assinatura.
 */

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState, type ReactNode } from "react";

import { ErroGeral, Formulario } from "@/components/formulario";
import { Botao } from "@/components/ui";

import type { EstadoFormulario } from "../acoes";

const INTERVALO_MS = 3000;
const LIMITE_MS = 60_000;

/**
 * Volta do checkout pago: o webhook do Asaas costuma chegar em segundos, mas
 * pode chegar DEPOIS da pessoa. Relê a página a cada 3 s — quando a
 * assinatura vira ATIVA, o servidor redireciona para o sistema sozinho.
 *
 * Desiste em 1 minuto e diz isso, em vez de girar para sempre: aí o mais
 * provável é o cartão ter sido recusado, e a pessoa precisa saber que pode
 * tentar de novo.
 *
 * O botão de pagar (`seDesistir`) só aparece depois de desistir. Ao lado do
 * "Confirmando o pagamento…", um "Ir para o pagamento" convidava quem acabou
 * de pagar a pagar outra vez.
 */
export function AguardarConfirmacao({ seDesistir }: { seDesistir?: ReactNode }) {
  const router = useRouter();
  const [desistiu, setDesistiu] = useState(false);

  useEffect(() => {
    const inicio = Date.now();
    const relogio = setInterval(() => {
      if (Date.now() - inicio > LIMITE_MS) {
        clearInterval(relogio);
        setDesistiu(true);
        return;
      }
      router.refresh();
    }, INTERVALO_MS);

    return () => clearInterval(relogio);
  }, [router]);

  if (desistiu) {
    return (
      <>
        <p className="text-corpo text-tinta-2" role="status">
          A confirmação está demorando mais que o normal. Se o cartão foi recusado, abra o pagamento
          de novo abaixo; se já foi aprovado, recarregue esta página em alguns minutos.
        </p>
        {seDesistir && <div className="mt-6">{seDesistir}</div>}
      </>
    );
  }

  return (
    <p className="flex items-center gap-2.5 text-corpo text-tinta-2" role="status">
      <span className="pulso inline-block size-2.5 rounded-full bg-verde" aria-hidden="true" />
      Confirmando o pagamento com o Asaas…
    </p>
  );
}

type Acao = (estado: EstadoFormulario, formData: FormData) => Promise<EstadoFormulario>;

export function ReabrirPagamento({ acao, rotulo }: { acao: Acao; rotulo: string }) {
  const [estado, enviar, enviando] = useActionState(acao, {});

  return (
    <Formulario estado={estado} action={enviar} className="space-y-3">
      <ErroGeral />
      <Botao type="submit" carregando={enviando} className="w-full">
        {enviando ? "Abrindo…" : rotulo}
      </Botao>
    </Formulario>
  );
}
