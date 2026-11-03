# syntax=docker/dockerfile:1
#
# A imagem da produção (AWS Lightsail — ver `deploy/` e o README, "Produção").
#
# Quatro estágios:
#   - deps:     `npm ci`, que também gera o cliente do Prisma (`postinstall`);
#   - build:    `next build` em modo standalone;
#   - runner:   o que vai para o ar — o servidor mínimo do Next, sem o
#               `node_modules` inteiro, sem código-fonte e sem segredo;
#   - migrador: o CLI do Prisma e as migrations, rodado à parte antes de cada
#               deploy (`docker compose run migrar`).
#
# Nenhum segredo entra aqui: o `.dockerignore` deixa o `.env` de fora, e as
# variáveis de produção chegam no `docker run` (`deploy/compose.yaml`). As
# únicas lidas no build são as que o Next grava no pacote do navegador (o DSN
# do Sentry e o nome do ambiente, públicos) e o token do Sentry, que entra como
# segredo do BuildKit e não fica em camada nenhuma.

ARG NODE_VERSION=22

FROM node:${NODE_VERSION}-bookworm-slim AS deps
WORKDIR /app
# O `postinstall` roda `prisma generate`, que lê o schema e a configuração.
COPY package.json package-lock.json prisma7.config.ts ./
COPY prisma ./prisma
RUN npm ci

FROM deps AS build
COPY . .

# Públicos: o Next os grava no JavaScript do navegador.
ARG NEXT_PUBLIC_SENTRY_DSN
ARG NEXT_PUBLIC_SENTRY_ENVIRONMENT=producao
# A versão (o commit), para o Sentry ligar o erro ao deploy e aos source maps;
# e o id do deploy, que faz a aba aberta antes dele recarregar em vez de pedir
# uma server action que não existe mais.
ARG SENTRY_RELEASE
ARG SENTRY_ORG
ARG SENTRY_PROJECT

ENV NEXT_OUTPUT=standalone \
    NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_SENTRY_DSN=${NEXT_PUBLIC_SENTRY_DSN} \
    NEXT_PUBLIC_SENTRY_ENVIRONMENT=${NEXT_PUBLIC_SENTRY_ENVIRONMENT} \
    SENTRY_RELEASE=${SENTRY_RELEASE} \
    NEXT_DEPLOYMENT_ID=${SENTRY_RELEASE} \
    SENTRY_ORG=${SENTRY_ORG} \
    SENTRY_PROJECT=${SENTRY_PROJECT}

# `db.ts` cria o cliente ao ser importado, e o build importa as rotas para ler
# a configuração delas: precisa de uma URL, mas não conecta — nenhuma página é
# gerada no build (o layout raiz é `force-dynamic`). Só para este comando.
RUN --mount=type=secret,id=sentry_auth_token,env=SENTRY_AUTH_TOKEN \
    DATABASE_URL=postgresql://build@127.0.0.1:5432/build npm run build

FROM node:${NODE_VERSION}-bookworm-slim AS runner
WORKDIR /app

# O banco gerenciado da AWS assina o certificado com a CA dela, que o Node não
# conhece: sem `NODE_EXTRA_CA_CERTS`, a primeira consulta cai em "self-signed
# certificate in certificate chain" (a URL usa sslmode=verify-full).
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NODE_EXTRA_CA_CERTS=/app/certificados/rds-global-bundle.pem

ADD --chmod=644 https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /app/certificados/rds-global-bundle.pem

COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public

# O servidor lê a versão em tempo de execução (`instrumentation.ts`).
ARG SENTRY_RELEASE
ENV SENTRY_RELEASE=${SENTRY_RELEASE}

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/saude').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]

# O próprio Node como processo principal (com o `init` do compose na frente):
# o SIGTERM do deploy chega a ele, que termina as requisições em curso e os
# e-mails pendentes (`after()`) antes de sair.
CMD ["node", "server.js"]

FROM deps AS migrador
# Dois clientes do banco aqui, e cada um confia na CA da AWS por um caminho: o
# motor de migração do Prisma, pelo repositório de certificados do sistema
# (OpenSSL); o `db:setup`, que é Node (`pg`), pelo `NODE_EXTRA_CA_CERTS`. O
# `update-ca-certificates` quer um certificado por arquivo, e o pacote da AWS
# traz todos num só.
ADD --chmod=644 https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem /app/certificados/rds-global-bundle.pem
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/* \
 && awk '/BEGIN CERTIFICATE/ { n++ } { print > ("/usr/local/share/ca-certificates/rds-" n ".crt") }' \
      /app/certificados/rds-global-bundle.pem \
 && update-ca-certificates
ENV NODE_EXTRA_CA_CERTS=/app/certificados/rds-global-bundle.pem
COPY scripts/setup-db-role.mjs ./scripts/setup-db-role.mjs
# As migrations e depois o papel restrito — o `db:setup` precisa das tabelas
# para conferir que o papel as lê (README, "Banco de dados").
CMD ["sh", "-c", "npx prisma migrate deploy && npm run db:setup"]
