FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN apk add --no-cache curl && npm install

COPY . .

EXPOSE 4000

CMD ["node", "src/index.js"]
