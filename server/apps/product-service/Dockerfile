# FROM node:20-alpine
# WORKDIR /app
# RUN apk add --no-cache postgresql-client
# COPY package*.json ./
# RUN npm install --omit=dev
# COPY . .
# COPY ./src ./src
# ENV NODE_ENV=production
# EXPOSE 3002
# COPY entrypoint.sh /entrypoint.sh
# RUN chmod +x /entrypoint.sh
# ENTRYPOINT ["/entrypoint.sh"]
# CMD ["node", "server.js"]

# Stage 1: Base image
FROM node:20-alpine

# Set working directory
WORKDIR /app

# Install PostgreSQL client
RUN apk add --no-cache postgresql-client

# Copy package files
COPY package*.json ./

# Use npm install to avoid lock mismatch errors when package.json changes
RUN npm install --only=production --no-audit --no-fund
COPY . .
COPY ./src ./src

# Set environment
ENV NODE_ENV=production

# Expose port
EXPOSE 3002

# Entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh
ENTRYPOINT ["/entrypoint.sh"]

# Default command
CMD ["node", "server.js"]
