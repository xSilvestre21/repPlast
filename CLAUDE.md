@AGENTS.md

# Project: RepPlast

SaaS para representantes comerciais de embalagens plásticas — pedidos, PDF para a indústria e
comissões. Porta o sistema legado SICOV (dados reais em `referencia/`, nunca versionado).

## Tech Stack

- Next.js 16 (App Router), React 19, TypeScript
- Tailwind CSS 4 — paleta em variáveis CSS puras (`src/app/globals.css`), sem shadcn/ui
- Zod para validação; `Decimal` (decimal.js) para todo valor monetário — nunca `float`
- Prisma 7 + `@prisma/adapter-pg` sobre PostgreSQL
- Server Component First — `'use client'` só onde há interação (formulários com
  `useActionState`, campos, listas com busca); formulários usam `<Formulario>` com Server Actions

## Commands

- `npm run dev` — servidor local
- `npm run build` / `npm start` — build e produção
- `npm test` — testes unitários (Vitest, sem banco)
- `npm run test:db` — testes de integração (`*.itest.ts`), incluindo isolamento multi-tenant
- `npm run test:navegador` — testes em Chromium (`*.btest.tsx`), para o que só existe depois do
  layout: um componente que mede a janela não é testável em `node`, onde tudo tem altura zero
- `npm run typecheck` — TypeScript sem emitir
- `npm run lint` — ESLint
- `npm run db:setup` / `npm run db:seed` — papel restrito do banco / dados de exemplo

## Architecture

- App Router: `src/app/(app)/` (autenticado) e `src/app/(entrada)/` (login/cadastro)
- Mutações em `acoes.ts` por feature, com `'use server'` — nunca acesso a banco fora daí
- `src/components/` — sem separação ui/feature; um arquivo por componente, kebab-case
- `src/lib/` — regras de negócio puras (`precificacao.ts`, `totais.ts`, `comissao.ts`,
  `descricao.ts`) e infraestrutura (`db.ts`, `sessao.ts`, `email.ts`)
- `src/generated/prisma/` — cliente gerado, nunca editar (fora do lint e do git)
- Sem `types/` central: schemas Zod e tipos ficam junto do módulo que os usa
- Comportamento herdado do SICOV que parece mal resolvido não é bug — perguntar antes de remover
  ou "melhorar"; reproduzir é o padrão, melhoria é decisão separada

## Erros de formulário

O erro aparece **embaixo do campo que o causou**, em português, dizendo o que fazer. Padrão único:

- Ações devolvem `EstadoFormulario` (`src/lib/erro-formulario.ts`). Recusa de campo:
  `throw new ErroDeCampo("name", frase)`; recusa geral: `throw new ErroParaUsuario(frase)`; o
  `catch` é sempre `return falhou(erro, formData)` — nunca `erro.message` direto (vaza texto do
  Prisma/RLS/SMTP); `falhou` também devolve o que foi digitado (senha nunca)
- Número de formulário: `exigirNumero`/`exigirNumeroDe` (`numero-br.ts`), nunca
  `lerNumeroBr(...) ?? 0` — "abc" tem de ser recusado, não gravado como zero
- Tela: `<Formulario estado={estado} action={enviar}>` e `<ErroGeral />` logo acima do botão de
  enviar. `Campo`/`Selecao`/`AreaTexto`/`CampoData`/`SelecaoBuscavel` acham o erro pelo `name`;
  linha de tabela usa `campoDaLinha("email", i)` no servidor e `data-campo` no input
- Botão que pode ser recusado (excluir, inativar, status): ação `(estado, formData) =>
  EstadoFormulario` dentro de `<AcaoComRecusa>` — ação `void` que lança vira página de erro
- Frase: o que houve + como resolver, com exemplo ("como 1.250,00") e o nome real do botão
  citado; na tabela, a linha ("Na faixa 3…")

## Code Style

- Nomes de arquivo: kebab-case sempre, componentes inclusive (sem PascalCase em arquivo)
- Argumento não usado prefixado com `_` (regra do ESLint; comum em server actions cuja assinatura
  é ditada pelo React)
- Módulos sensíveis (`db`, `sessao`, `senha`, `email`) importam `server-only`

## Environment Variables

- Não existe `.env.example`; variáveis em uso: `DIRECT_DATABASE_URL`, `DATABASE_URL`,
  `APP_DB_ROLE`, `SESSAO_SECRET` e `EMAIL_CHAVE` (cifra a senha das caixas de e-mail; ver README)
- Cobrança (Asaas): `ASAAS_URL` (sandbox `https://api-sandbox.asaas.com`), `ASAAS_API_KEY`,
  `ASAAS_WEBHOOK_TOKEN` (o token do webhook no painel do Asaas — nunca a API key) e `APP_URL`
  (base das URLs de volta do checkout)
- Remetente do sistema (só o "Esqueceu sua senha?"): `SISTEMA_SMTP_HOST`, `SISTEMA_SMTP_PORTA`,
  `SISTEMA_SMTP_USUARIO`, `SISTEMA_SMTP_SENHA`, `SISTEMA_EMAIL_REMETENTE`; o link usa `APP_URL`
  (obrigatória em produção — nunca o `Host` da requisição). Ver README, "Esqueceu sua senha?"
- Nenhuma `NEXT_PUBLIC_*` hoje — confirmar que o valor é seguro no client antes de criar uma
- `.env` inteiro é ignorado pelo git, não só `.env.local`

## Workflow

- Rodar `npm run typecheck && npm run lint` após uma série de mudanças
- Um teste por vez, não a suíte inteira: `npx vitest run nome-do-arquivo`
- Teste quebrando em `precificacao.test.ts` é incidente, não teste chato — mexe com dinheiro real
- Commits a partir de agora seguem Conventional Commits em inglês (via commit skill); o histórico
  anterior é em português, narrativo (`Área: o que mudou`) — não precisa reescrever o que já existe

## Common Gotchas

- `revalidatePath`/`revalidateTag` só funcionam dentro de Server Actions/Route Handlers
- Não há `middleware.ts`; a proteção de rota é o layout `src/app/(app)/layout.tsx` — rotas de
  arquivo (PDF, exportação) não passam por layout e se protegem sozinhas, respondendo 401 com
  `respostaDeErro`/`sessaoExpiradaNoArquivo` (`src/lib/resposta-de-erro.ts`)
- Superusuário do Postgres ignora Row Level Security — nunca validar isolamento multi-tenant
  conectado como dono do banco
- Componente de ícone não atravessa de Server para Client Component como prop ("Only plain
  objects..."); passar o nome do ícone e resolver do lado client
- Constante exportada de módulo `'use client'` chega ao Server Component como referência, não
  como valor — por isso as classes de controle moram em `components/controle.ts`, fora de
  `campos.tsx`
- O React 19 limpa o `<form action>` depois de cada envio, inclusive o recusado: campo não
  controlado só volta preenchido pelo `valores` do estado (o `Campo` já faz isso pelo `name`)
- Botão ao lado de campo: linha com `items-start` e `<EspacoDoRotulo />` sobre o botão — com
  `items-end`, a frase de erro embaixo da caixa empurra o botão para baixo

## Git Commits

NEVER run git commit directly. ALWAYS use the commit skill for every git commit in this project,
regardless of how the user requested it.
This applies to:

Explicit requests: "faz o commit", "commita", "commit das mudanças"
Implicit requests: "salva", "finaliza a feature", "pode subir"
Any situation where you would naturally run git commit

The commit skill enforces Conventional Commits specification and ensures consistent commit history
across the project.
