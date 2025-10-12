FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache postgresql-client
COPY package*.json ./
COPY shared-1.0.0.tgz ./
RUN npm install ./shared-1.0.0.tgz
COPY . .
COPY ./src ./src
ENV NODE_ENV=production
EXPOSE 3003
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "server.js"]

