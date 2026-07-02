#!/bin/bash
set -e
cd /root/evolution-api

echo '=== Detectando rede do evolution-db ==='
EVO_NETWORK=$(docker inspect evolution-db --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}}{{end}}' 2>/dev/null)
echo "Rede encontrada: $EVO_NETWORK"

echo '=== Parando container antigo ==='
docker stop evolution-api 2>/dev/null || true
docker rm evolution-api 2>/dev/null || true

echo '=== Iniciando evolution-api v2 ==='
docker run -d \
  --name evolution-api \
  --restart always \
  -p 8080:8080 \
  --network "$EVO_NETWORK" \
  -e SERVER_URL=http://76.13.228.159:8080 \
  -e DOCKER_ENV=true \
  -e LOG_LEVEL=ERROR,WARN,DEBUG,INFO,LOG,VERBOSE,DARK,FATAL \
  -e LOG_BAILEYS=error \
  -e DEL_INSTANCE=false \
  -e AUTHENTICATION_TYPE=apikey \
  -e AUTHENTICATION_API_KEY=minha_chave_secreta_123 \
  -e AUTHENTICATION_EXPOSE_IN_SERVER=true \
  -e WEBSOCKET_ENABLED=false \
  -e QRCODE_LIMIT=10 \
  -e LANGUAGE=pt-BR \
  -e DATABASE_PROVIDER=postgresql \
  -e DATABASE_CONNECTION_URI=postgresql://postgres:postgres@evolution-db:5432/evolution \
  -e DATABASE_CONNECTION_CLIENT_NAME=evolution_api \
  -e DATABASE_SAVE_DATA_INSTANCE=true \
  -e DATABASE_SAVE_DATA_NEW_MESSAGE=true \
  -e DATABASE_SAVE_MESSAGE_UPDATE=true \
  -e DATABASE_SAVE_DATA_CONTACTS=true \
  -e DATABASE_SAVE_DATA_CHATS=true \
  -v evolution-api_evolution_instances:/evolution/instances \
  -v evolution-api_evolution_store:/evolution/store \
  evoapicloud/evolution-api:latest

echo 'Container iniciado. Aguardando 15s...'
sleep 15

echo '=== LOGS ==='
docker logs evolution-api 2>&1 | tail -25

echo ''
echo '=== STATUS ==='
curl -s http://localhost:8080/ || echo 'API ainda inicializando'

echo ''
echo '=== CONTAINERS ATIVOS ==='
docker ps --format 'TABLE {{.Names}}\t{{.Image}}\t{{.Status}}'
