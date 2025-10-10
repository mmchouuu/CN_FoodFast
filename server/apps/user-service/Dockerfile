FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache postgresql-client python3 make g++

COPY package*.json ./

RUN npm install

COPY . .

RUN npm rebuild bcrypt --build-from-source

ENV NODE_ENV=production

EXPOSE 3001

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "src/index.js"]
