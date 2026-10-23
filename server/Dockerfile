FROM node:20-alpine

WORKDIR /app

# Copiar manifiesto de dependencias e instalar
COPY server/package*.json ./
RUN npm install --omit=dev

# Copiar código fuente del servidor
COPY server/ ./

EXPOSE 4000

CMD ["node", "src/index.js"]
