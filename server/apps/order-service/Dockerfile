FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache postgresql-client
COPY package*.json ./
# Use npm install to avoid lockfile mismatch when dependencies change
RUN npm install --omit=dev
COPY . .
ENV NODE_ENV=production
EXPOSE 3003
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "src/index.js"]
