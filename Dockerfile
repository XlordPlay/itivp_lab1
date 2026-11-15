FROM node:22-slim

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

EXPOSE 3000

# Миграции PostgreSQL, демо-данные MongoDB (только в пустую базу), затем сервер
CMD ["sh", "-c", "npx sequelize-cli db:migrate && node scripts/seed-mongo.js --if-empty && node server.js"]
