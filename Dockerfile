FROM node:20-alpine

WORKDIR /app

# Instalar dependências necessárias para o build
RUN apk add --no-cache python3 make g++ 

# Copiar arquivos de dependência
COPY package.json pnpm-lock.yaml ./

# Instalar pnpm
RUN npm install -g pnpm

# Instalar dependências do projeto
RUN pnpm install

# Copiar o resto do código
COPY . .

# Construir a aplicação
RUN pnpm run build

# Expor a porta que a aplicação usa (geralmente 5000)
EXPOSE 5000

# Script de inicialização (Roda migrações do banco e inicia a API)
CMD ["sh", "-c", "pnpm run db:push && pnpm start"]
