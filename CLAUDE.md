@AGENTS.md

# Project: RepPlast

SaaS para representantes comerciais de embalagens plásticas — pedidos, PDF para a indústria e
comissões. Porta o sistema legado SICOV (dados reais em `referencia/`, nunca versionado).

## Tech Stack

- Next.js 16 (App Router), React 19, TypeScript
- Tailwind CSS 4 — paleta em variáveis CSS puras (`src/app/globals.css`), sem shadcn/ui
- Zod para validação; `Decimal` (decimal.js) para todo valor monetário — nunca `float`
- Prisma 7 + `@prisma/adapter-pg` sobre PostgreSQL
- Server Component First — hoje **não há nenhum `'use client'` no projeto**; formulários usam
  `<form action={...}>` direto com Server Actions

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

## Code Style

- Nomes de arquivo: kebab-case sempre, componentes inclusive (sem PascalCase em arquivo)
- Argumento não usado prefixado com `_` (regra do ESLint; comum em server actions cuja assinatura
  é ditada pelo React)
- Módulos sensíveis (`db`, `sessao`, `senha`, `email`) importam `server-only`

## Environment Variables

- Não existe `.env.example`; variáveis em uso: `DIRECT_DATABASE_URL`, `DATABASE_URL`,
  `APP_DB_ROLE`, `SESSAO_SECRET` e, opcionais, `RESEND_API_KEY`/`EMAIL_REMETENTE` (ver README)
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
  arquivo (PDF, logo) não passam por layout e se protegem sozinhas, respondendo 401
- Superusuário do Postgres ignora Row Level Security — nunca validar isolamento multi-tenant
  conectado como dono do banco
- Componente de ícone não atravessa de Server para Client Component como prop ("Only plain
  objects..."); passar o nome do ícone e resolver do lado client

## Git Commits

NEVER run git commit directly. ALWAYS use the commit skill for every git commit in this project,
regardless of how the user requested it.
This applies to:

Explicit requests: "faz o commit", "commita", "commit das mudanças"
Implicit requests: "salva", "finaliza a feature", "pode subir"
Any situation where you would naturally run git commit

The commit skill enforces Conventional Commits specification and ensures consistent commit history
across the project.
