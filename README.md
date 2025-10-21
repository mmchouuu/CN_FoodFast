# CN_FoodFast

> **Tasty** – experience colorful and flavorful fast food.  
> From savory dishes to sweet treats, from noodles to desserts, we bring joy to your belly and smiles to your face. **Order now, eat deliciously!**

---

## Mục lục
- [Giới thiệu](#giới-thiệu)
- [Tính năng](#tính-năng)
- [Kiến trúc & Công nghệ](#kiến-trúc--công-nghệ)
- [Cấu trúc thư mục](#cấu-trúc-thư-mục)
- [Bắt đầu nhanh](#bắt-đầu-nhanh)
  - [Yêu cầu môi trường](#yêu-cầu-môi-trường)
  - [Clone & cài đặt](#clone--cài-đặt)
  - [Thiết lập biến môi trường](#thiết-lập-biến-môi-trường)
  - [Chạy ứng dụng (Dev)](#chạy-ứng-dụng-dev)
  - [Chạy bằng Docker Compose (Tuỳ chọn)](#chạy-bằng-docker-compose-tuỳ-chọn)
- [Sử dụng nhanh](#sử-dụng-nhanh)
- [Scripts tiện ích](#scripts-tiện-ích)
- [Sơ đồ kiến trúc](#sơ-đồ-kiến-trúc)
  - [Toàn hệ thống](#toàn-hệ-thống)
  - [Email Service](#email-service-component-level)
  - [Socket Gateway](#socket-gateway-component-level)
  - [Integrations-3rd](#integrations-3rd-component-level)
- [Ghi chú triển khai](#ghi-chú-triển-khai)

---

## Giới thiệu
**CN_FoodFast** là ứng dụng đặt/giao/quản lý món ăn nhanh.  
Người dùng duyệt thực đơn, thêm món vào giỏ và đặt hàng; nhà hàng quản lý món & đơn; admin duyệt và giám sát hệ thống.

## Tính năng
- Đăng ký / đăng nhập người dùng (JWT).
- Duyệt menu theo danh mục, xem chi tiết món.
- Giỏ hàng, đặt hàng, theo dõi trạng thái đơn.
- Nhà hàng quản lý món ăn (thêm/sửa/xoá), quản lý đơn.
- Admin phê duyệt tài khoản nhà hàng, xem thống kê cơ bản.
- Giao diện thân thiện, hỗ trợ desktop & mobile.

## Kiến trúc & Công nghệ
- **Frontend**: `client/` – React (Vite).
- **Backend**: `server/` – Node.js (Express).
- **Database**: PostgreSQL.
- **Event Bus**: RabbitMQ (dự kiến/đang dùng cho các service realtime & email).
- **API**: REST (HTTP), WebSocket (realtime qua Socket Gateway).

> Repo hiện tách 2 app *client* và *server*. Các dịch vụ như email, socket, 3rd-party đã có scaffold để mở rộng.

---

## Cấu trúc thư mục

> Cấu trúc theo **server/** bạn cung cấp (đã format lại cho dễ đọc). Thư mục `client/` là React app (Vite).

```
server/
├── apps/                          
│   ├── Dockerfile
│   ├── .env
│   ├── entrypoint.sh
│   ├── package.json
│   └── src/
│       ├── index.js              
│       ├── health.js              
│       ├── config/
│       │   └── index.js
│       ├── controllers/
│       │   ├── users.controller.js
│       │   ├── products.controller.js
│       │   ├── orders.controller.js
│       │   └── payments.controller.js
│       ├── middlewares/
│       │   ├── errorHandler.js
│       │   └── requestId.js
│       ├── routes/
│       │   ├── users.js
│       │   ├── products.js
│       │   ├── orders.js
│       │   └── payments.js
│       └── services/              
│           ├── users.client.js
│           ├── products.client.js
│           ├── orders.client.js
│           └── payments.client.js
│
├── user-service/
│   ├── Dockerfile
│   ├── package.json
│   ├── .env
│   └── src/
│       ├── index.js
│       ├── controllers/
│       │   └── user.controller.js
│       ├── routes/
│       │   └── user.routes.js
│       ├── services/
│       │   └── user.service.js
│       └── utils/
│           ├── jwt.js
│           └── bcrypt.js
│
├── product-service/
│   ├── Dockerfile
│   ├── package.json
│   ├── .env
│   └── src/
│       ├── index.js
│       ├── controllers/
│       ├── routes/
│       └── services/
│
├── order-service/
│   ├── Dockerfile
│   ├── package.json
│   ├── .env
│   └── src/
│       ├── index.js
│       ├── controllers/
│       │   └── order.controller.js
│       ├── routes/
│       │   └── order.routes.js
│       ├── services/
│       │   └── order.service.js
│       └── models/
│           └── order.model.js
│
├── payment-service/
│   ├── Dockerfile
│   ├── package.json
│   ├── .env
│   └── src/
│       ├── index.js
│       ├── controllers/
│       ├── routes/
│       └── services/
│
├── email-service/
│   ├── Dockerfile
│   ├── package.json
│   ├── .env
│   └── src/
│       ├── index.js
│       ├── mailer.js
│       ├── rabbitmq.js
│       └── config.js
│
├── socket-gateway/
│   ├── Dockerfile
│   ├── package.json
│   ├── .env
│   └── src/
│       └── index.js
│
├── libs/
│   ├── events/
│   │   ├── rabbit.js
│   │   └── routing-keys.js
│   └── common/
│       ├── logger.js
│       └── errors.js
│
├── db/
│   ├── userdb/
│   │   └── users_init.sql
│   ├── productdb/
│   │   └── products_init.sql
│   ├── orderdb/
│   │   └── orders_init.sql
│   └── paymentdb/
│       └── payments_init.sql
│
├── .env
├── README.md
└── docker-compose.yml
```

---

## Bắt đầu nhanh

### Yêu cầu môi trường
- **Node.js** ≥ 18.x, **npm** ≥ 9.x
- **PostgreSQL** ≥ 13
- (Tuỳ chọn) **Docker** & **Docker Compose**
- Hệ điều hành: Windows / macOS / Linux

### Clone & cài đặt
```bash
git clone https://github.com/mmchouuu/CN_FoodFast.git
cd CN_FoodFast

# Cài backend
cd server/apps && npm install
cd ../user-service && npm install
cd ../product-service && npm install
cd ../order-service && npm install
cd ../payment-service && npm install
cd ../email-service && npm install
cd ../socket-gateway && npm install

# Cài frontend
cd ../../client && npm install
```

### Thiết lập biến môi trường

> Tạo các file `.env` như sau (đổi giá trị thực tế của bạn):

**1) `server/.env` (dùng chung nếu libs/compose cần)**
```env
RABBITMQ_URL=amqp://guest:guest@localhost:5672
JWT_SECRET=change_me_super_secret
```

**2) `server/apps/.env` (API Gateway / BFF)**
```env
PORT=8080
USER_SVC_URL=http://localhost:3001
PRODUCT_SVC_URL=http://localhost:3002
ORDER_SVC_URL=http://localhost:3003
PAYMENT_SVC_URL=http://localhost:3004

JWT_SECRET=change_me_super_secret
RABBITMQ_URL=amqp://guest:guest@localhost:5672
```

**3) `server/user-service/.env`**
```env
PORT=3001
USER_DB_URL=postgresql://postgres:postgres@localhost:5432/userdb
JWT_SECRET=change_me_super_secret
```

**4) `server/product-service/.env`**
```env
PORT=3002
PRODUCT_DB_URL=postgresql://postgres:postgres@localhost:5432/productdb
RABBITMQ_URL=amqp://guest:guest@localhost:5672
```

**5) `server/order-service/.env`**
```env
PORT=3003
ORDER_DB_URL=postgresql://postgres:postgres@localhost:5432/orderdb
RABBITMQ_URL=amqp://guest:guest@localhost:5672
```

**6) `server/payment-service/.env`**
```env
PORT=3004
PAYMENT_DB_URL=postgresql://postgres:postgres@localhost:5432/paymentdb
RABBITMQ_URL=amqp://guest:guest@localhost:5672
INTEGRATIONS_BASE_URL=http://localhost:5010  # nếu có service tích hợp 3rd party
```

**7) `server/email-service/.env`**
```env
PORT=3005
RABBITMQ_URL=amqp://guest:guest@localhost:5672

SMTP_HOST=email-smtp.us-east-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=your_smtp_user
SMTP_PASS=your_smtp_pass
MAIL_FROM="CN FoodFast <no-reply@your-domain.com>"
```

**8) `server/socket-gateway/.env`**
```env
PORT=5006
RABBITMQ_URL=amqp://guest:guest@localhost:5672
# Nếu dùng RS256:
# JWT_PUBLIC=-----BEGIN PUBLIC KEY-----...-----END PUBLIC KEY-----
# Hoặc HS256:
JWT_SECRET=change_me_super_secret
```

**9) `client/.env`**
```env
VITE_API_BASE_URL=http://localhost:8080
```

> **Database:** tạo 4 DB local: `userdb`, `productdb`, `orderdb`, `paymentdb` và chạy các script `db/*/*_init.sql` (nếu có migration riêng thì dùng migration tool của bạn).

### Chạy ứng dụng (Dev)

Mở **nhiều terminal** (mỗi service một cửa sổ) hoặc dùng PM2/tmux:

```bash
# Terminal 1: API Gateway
cd server/apps
npm run dev

# Terminal 2: User Service
cd server/user-service
npm run dev

# Terminal 3: Product Service
cd server/product-service
npm run dev

# Terminal 4: Order Service
cd server/order-service
npm run dev

# Terminal 5: Payment Service
cd server/payment-service
npm run dev

# Terminal 6: Email Service
cd server/email-service
npm run dev

# Terminal 7: Socket Gateway (realtime)
cd server/socket-gateway
npm run dev

# Terminal 8: Frontend
cd client
npm run dev
```

**Truy cập**
- Frontend: http://localhost:5173  
- API Gateway: http://localhost:8080  
- Các service khác theo PORT trong `.env`.

### Chạy bằng Docker Compose (Tuỳ chọn)
Nếu đã có `docker-compose.yml`:

```bash
docker compose up -d --build
# hoặc: docker-compose up -d --build
```

- Xem logs: `docker compose logs -f <service_name>`
- Dừng: `docker compose down`

---

## Sử dụng nhanh
1. Mở **http://localhost:5173**.
2. Đăng ký/Đăng nhập.
3. Duyệt menu → Thêm món → Thanh toán.
4. Xem lịch sử & trạng thái đơn tại “Đơn hàng của tôi”.
5. Admin (nếu có quyền) truy cập trang quản trị để duyệt nhà hàng / quản lý đơn.

---

## Scripts tiện ích

> Tuỳ `package.json` mỗi service; các lệnh phổ biến:

**Apps / Services**
```bash
npm run dev        # chế độ dev (nodemon / ts-node-dev)
npm run start      # chạy production
npm run lint       # lint code
```

**Client**
```bash
npm run dev        # Vite dev server
npm run build      # build production
npm run preview    # xem trước bản build
```

---

## Sơ đồ kiến trúc

### Toàn hệ thống

![Sơ đồ kiến trúc hệ thống](./assets/images/component.jpg)

---

## Ghi chú triển khai
- Không commit file `.env` vào repo công khai.
- Thiết lập **SPF/DKIM/DMARC** cho domain gửi mail nếu dùng SMTP provider (SendGrid, SES, Mailgun…).
- Bật **CORS** phù hợp ở API Gateway khi chạy dev/prod.
- Đảm bảo dịch vụ DB/RabbitMQ đã chạy trước khi start các service phụ thuộc.
- Gợi ý: thêm **rate limit** ở Gateway, **idempotency-key** cho API tạo đơn, **retry + DLQ** cho consumer.

---
