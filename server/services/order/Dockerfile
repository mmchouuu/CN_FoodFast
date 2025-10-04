# FROM node:20
# WORKDIR /app
# COPY package*.json ./
# RUN npm install
# COPY . .
# CMD ["npm", "run", "start"]
# EXPOSE 4003

FROM node:20
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
COPY wait-for-it.sh ./wait-for-it.sh
RUN chmod +x ./wait-for-it.sh
RUN apt-get update && apt-get install -y netcat-openbsd && rm -rf /var/lib/apt/lists/*
EXPOSE 4003
# CMD ["db-host:5432", "--timeout=30", "--", "node", "src/index.js"]
CMD ["npm", "start"]
