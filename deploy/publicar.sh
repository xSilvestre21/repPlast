#!/bin/sh
# Põe no ar a versão <commit> (as imagens que o GitHub Actions mandou ao ECR).
#
#   sh /opt/repplast/publicar.sh <commit>
#
# Também serve para VOLTAR uma versão: passe o commit anterior. As imagens
# ficam no ECR (as 20 últimas — ver o README, "Produção").
#
# Ordem: migrations (no banco, antes do código que precisa delas), o sistema
# novo, e a espera pelo /api/saude. Se a versão nova não ficar saudável em
# 2 minutos, o sistema volta para a imagem anterior — as migrations não, por
# isso toda migration tem de ser compatível com o código de antes (só
# acrescentar; apagar coluna, só numa versão seguinte).

set -eu
cd "$(dirname "$0")"

COMMIT="${1:?uso: publicar.sh <commit>}"
REPOSITORIO="$(sed -n 's/^REPOSITORIO=//p' .env)"
[ -n "$REPOSITORIO" ] || { echo "Defina REPOSITORIO no .env (o endereço do ECR)."; exit 1; }
ANTERIOR="$(sed -n 's/^IMAGEM=//p' .env)"

definir() {
  if grep -q "^$1=" .env; then
    sed -i "s|^$1=.*|$1=$2|" .env
  else
    echo "$1=$2" >> .env
  fi
}

aws ecr get-login-password --region sa-east-1 \
  | docker login --username AWS --password-stdin "${REPOSITORIO%%/*}"

# As migrations primeiro: se falharem, o .env ainda aponta para a versão que
# está no ar, e nada muda.
definir IMAGEM_MIGRADOR "$REPOSITORIO:$COMMIT-migrador"
docker compose pull migrar
docker compose run --rm migrar

definir IMAGEM "$REPOSITORIO:$COMMIT"
docker compose pull app
docker compose up -d app caddy
# O Caddyfile pode ter mudado com a versão; o reload não derruba conexão.
docker compose exec -T caddy caddy reload --config /etc/caddy/Caddyfile

i=0
while [ "$i" -lt 24 ]; do
  id="$(docker compose ps -q app || true)"
  estado="$([ -n "$id" ] && docker inspect --format '{{.State.Health.Status}}' "$id" 2>/dev/null || echo ausente)"
  if [ "$estado" = "healthy" ]; then
    echo "No ar: $COMMIT"
    docker image prune -f > /dev/null
    exit 0
  fi
  i=$((i + 1))
  sleep 5
done

echo "A versão $COMMIT não respondeu no /api/saude. Voltando para ${ANTERIOR:-nada}."
docker compose logs --tail 80 app
if [ -n "$ANTERIOR" ]; then
  definir IMAGEM "$ANTERIOR"
  docker compose up -d app
fi
exit 1
