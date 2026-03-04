FROM node:22-alpine
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

EXPOSE 3000
ENV NODE_ENV=production

CMD ["npx", "tsx", "src/index.ts"]
