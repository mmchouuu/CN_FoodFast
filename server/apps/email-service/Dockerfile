FROM node:20-bullseye

WORKDIR /app

# Cài các gói cần thiết để build (nếu có thư viện cần build native)
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        python3 \
        build-essential \
    && rm -rf /var/lib/apt/lists/*

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
