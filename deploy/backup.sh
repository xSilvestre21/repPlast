#!/bin/sh
# Cópia do banco para o S3, fora do Lightsail — os snapshots automáticos dele
# guardam só 7 dias, e ficam na mesma conta e região. Rodado pelo cron do host:
#
#   0 6 * * 0  sh /opt/repplast/backup.sh >> $HOME/repplast-backup.log 2>&1
#
# Lê de /opt/repplast/backup.env:
#   BACKUP_DATABASE_URL  a DIRECT_DATABASE_URL (o dono do banco), sslmode=verify-full,
#                        entre aspas simples (o arquivo é lido pelo shell: um $ na senha se perderia)
#   BACKUP_BUCKET        o bucket do S3 (privado, com expiração em 90 dias)
#
# O `app.bypass_rls`: com FORCE ROW LEVEL SECURITY, o dono do banco da AWS
# (que não ignora o RLS) não veria linha nenhuma, e o pg_dump recusa a tabela
# filtrada. Ligado na sessão do dump, as policies deixam tudo passar — é o
# mesmo escape das migrations e do seed. A restauração não precisa: os dados
# entram antes das policies (README, "Produção", "Restaurar o banco").

set -eu
# O cron roda com PATH mínimo, sem /usr/local/bin — onde o AWS CLI se instala.
export PATH="/usr/local/bin:$PATH"
cd "$(dirname "$0")"
. ./backup.env

ARQUIVO="repplast-$(date -u +%Y%m%dT%H%M%SZ).dump"

docker run --rm \
  -e PGOPTIONS="-c app.bypass_rls=on" \
  -e PGSSLROOTCERT=/certificados/rds-global-bundle.pem \
  -v /opt/repplast/rds-global-bundle.pem:/certificados/rds-global-bundle.pem:ro \
  postgres:17 \
  pg_dump --format=custom --no-owner --enable-row-security "$BACKUP_DATABASE_URL" > "/tmp/$ARQUIVO"

aws s3 cp "/tmp/$ARQUIVO" "s3://$BACKUP_BUCKET/$ARQUIVO" --storage-class STANDARD_IA
rm -f "/tmp/$ARQUIVO"
echo "$(date -u +%FT%TZ) backup $ARQUIVO enviado"
