#!/bin/bash

echo "Iniciando migração de dados do Supabase para o banco de dados local da VPS..."

# Extrai os dados do Supabase via pg_dump usando porta 5432 (direta, melhor que a 6543 do pooler)
# e insere diretamente no container 'db' recém-criado
docker run --rm -i postgres:15-alpine pg_dump "postgresql://postgres.cixbuubjeitckpqcifkq:tcziWltV3MBgbt4Q@aws-1-us-east-2.pooler.supabase.com:5432/postgres?sslmode=require" -x -O -c | docker compose exec -T db psql -U postgres -d wrmusic

echo ""
echo "✅ Migração concluída!"
echo "Caso não haja mensagens de erro graves acima, seus dados foram copiados com sucesso."
