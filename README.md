# RepPlast

SaaS para representantes comerciais de indústrias de embalagens plásticas: cadastro de clientes,
fornecedores e produtos, montagem de pedidos com preço calculado a partir das medidas, geração do
PDF para a indústria e controle de comissões.

## O que é o coração deste sistema

**O preço não é digitado — é calculado.** A fórmula do saco plástico foi extraída por engenharia
reversa de pedidos reais e é a peça mais crítica do código:

```
preço do milheiro = largura(cm) × comprimento(cm) × espessura(mm) × fator kg ÷ 10
```

Ela vive isolada em [`src/lib/precificacao.ts`](src/lib/precificacao.ts), sem I/O e sem
dependência de framework, e é testada contra os valores exatos de dois pedidos que a indústria
recebeu na vida real (ver `referencia/`). Se esses testes quebrarem, o sistema passou a calcular
diferente do mundo real — trate como incidente, não como teste chato.

Detalhe que custa dinheiro: **o total do item é calculado com o preço unitário sem arredondar.**

```
1.774,872 × 6 = 10.649,23   ← o que o pedido real traz
1.774,87  × 6 = 10.649,22   ← erraria por um centavo
```

Por isso todo valor monetário usa `Decimal`, nunca `float`.

## Rodando o projeto

```bash
npm install
npm run dev
```

### Banco de dados

O projeto usa PostgreSQL com Prisma 7 e driver adapter (`@prisma/adapter-pg`).

```bash
npx create-db create --region us-east-1 --json   # banco temporário, sem cadastro
npx prisma migrate deploy                        # aplica as migrations
npm run db:setup                                 # prepara e verifica o papel restrito
```

O `.env` guarda **duas conexões de propósito**:

| Variável | Papel | Para quê |
| --- | --- | --- |
| `DIRECT_DATABASE_URL` | dono do banco | migrations — precisam criar tabelas e policies |
| `DATABASE_URL` + `APP_DB_ROLE` | papel restrito | a aplicação |

Isso não é preciosismo: **no PostgreSQL, superusuário ignora Row Level Security**, inclusive com
`FORCE ROW LEVEL SECURITY` ligado. Se a aplicação conectasse como dono do banco, todo o isolamento
entre escritórios viraria decoração. `dbParaOrganizacao()` assume o papel de `APP_DB_ROLE` a cada
transação justamente para que as policies valham.

## O PDF do pedido

O layout **não é uma escolha de design**: foi copiado dos pedidos reais em `referencia/`. Quem
recebe já sabe onde procurar cada informação — mudar a ordem das colunas ou o nome dos rótulos só
geraria dúvida do outro lado do e-mail. Ao mexer em
[`src/lib/pdf/documento-pedido.tsx`](src/lib/pdf/documento-pedido.tsx), os quatro PDFs de
referência são o gabarito.

Dois detalhes que vieram de lá:

- **O rótulo da coluna de preço muda por família**: `MILHEIRO` no saco, `PREÇO/CX` na fita,
  `PREÇO/KG` no stretch.
- **O nome do arquivo** segue `{número}-{cliente}[-PC-{pedido do cliente}]-{data de ENTREGA}`, e
  não a data de emissão. Há teste para os quatro nomes reais.

O PDF é gerado sob demanda, nunca guardado. Como o item congela descrição, códigos e preço ao ser
criado, reimprimir um pedido antigo devolve exatamente o papel que a indústria recebeu na época.

### Envio por e-mail

Opcional. Sem configuração o sistema diz isso com todas as letras e sugere baixar o PDF — em vez
de falhar com um erro do provedor. Para ligar, no `.env`:

```
RESEND_API_KEY="re_..."
EMAIL_REMETENTE="pedidos@seudominio.com.br"
```

Enviar o e-mail **também marca o pedido como enviado**, porque é o mesmo fato: um pedido que
chegou à indústria mas ficou "aberto" no sistema seria uma mentira no controle de comissão. O
e-mail vai primeiro; se falhar, nada é marcado.

## Isolamento entre escritórios (multi-tenant)

São **duas camadas, ambas obrigatórias**:

1. O código da aplicação filtra explicitamente por `organizacaoId`.
2. O Row Level Security barra o que escapar da camada 1.

Nunca escreva uma query contando só com o RLS: se o ambiente de desenvolvimento conectar como
superusuário, um vazamento entre escritórios passaria despercebido e só apareceria em produção.

Use sempre [`dbParaOrganizacao(id)`](src/lib/db.ts) — nunca o cliente Prisma cru.
`dbAdministrativo()` existe só para seed e criação de organização nova.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Sobe a aplicação |
| `npm test` | Testes do motor de preço — puros, rápidos, sem banco |
| `npm run test:db` | Testes de integração, inclusive o isolamento multi-tenant |
| `npm run typecheck` | TypeScript sem emitir |
| `npm run db:setup` | Prepara e verifica o papel restrito do banco |
| `npx prisma studio` | Navegador visual dos dados |

Os testes de isolamento **se pulam com aviso** quando o papel efetivo do banco ignora RLS — assim
um ambiente limitado não vira falha enganosa.

## Estrutura

```
src/lib/precificacao.ts   fórmula do saco, aditivos, arredondamento
src/lib/totais.ts         totalização do pedido: subtotal, IPI, total geral
src/lib/descricao.ts      descrição impressa gerada a partir das medidas
src/lib/db.ts             acesso ao banco com escopo de escritório
prisma/schema.prisma      modelo de dados
referencia/               pedidos reais que servem de fixture e de referência de layout
```
