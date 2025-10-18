FROM node:20-alpine
WORKDIR /app
RUN apk add --no-cache postgresql-client
COPY package*.json ./
# Use npm install to avoid lock mismatch errors when package.json changes
RUN npm install --only=production --no-audit --no-fund
COPY . .
ENV NODE_ENV=production
EXPOSE 3002
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "src/index.js"]
