# FROM node:20-alpine
# WORKDIR /app
# COPY package*.json ./
# RUN npm install
# COPY . .
# EXPOSE 4002
# CMD ["node", "src/index.js"]

FROM node:20
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
COPY wait-for-it.sh ./wait-for-it.sh
RUN chmod +x ./wait-for-it.sh
RUN apt-get update && apt-get install -y netcat-openbsd && rm -rf /var/lib/apt/lists/*
EXPOSE 4002
# CMD ["db-host:5432", "--timeout=30", "--", "node", "src/index.js"]
CMD ["npm", "start"]


