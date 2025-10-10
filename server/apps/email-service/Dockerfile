FROM node:20-alpine

WORKDIR /app

# Cài các gói cần thiết để build (nếu có thư viện cần build native)
RUN apk add --no-cache python3 make g++

# Copy file package.json
COPY package*.json ./

# Cài đặt dependencies
RUN npm install

# Copy toàn bộ code
COPY . .

# Biến môi trường production
ENV NODE_ENV=production

# Mở cổng service email (tuỳ chỉnh)
EXPOSE 3005

# Cho phép script entrypoint chạy
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["node", "src/index.js"]
