# CN_FoodFast

**Tasty – experience colorful and flavorful fast food. From savory dishes to sweet treats, from noodles to desserts, we bring joy to your belly and smiles to your face. Order now, eat deliciously!**  
— Mô tả từ kho lưu trữ. :contentReference[oaicite:1]{index=1}

## Mục lục  
- [Giới thiệu](#giới-thiệu)  
- [Tính năng](#tính-năng)  
- [Kiến trúc & Công nghệ](#kiến-trúc--công-nghệ)  
- [Cài đặt & Chạy thử](#cài-đặt--chạy-thử)  
- [Hướng dẫn sử dụng](#hướng-dẫn-sử-dụng)  

## Giới thiệu  
CN_FoodFast là một ứng dụng đặt/giao/quản lý món ăn nhanh, cho phép người dùng duyệt menu đa dạng (từ món mặn tới món ngọt, từ mì tới tráng miệng) và đặt món dễ dàng. Dự án được xây dựng với mục đích tạo ra trải nghiệm ăn nhanh (fast food) đa màu sắc và đầy hương vị.

## Tính năng  
- Người dùng có thể đăng ký / đăng nhập
- Duyệt menu theo danh mục món ăn
- Thêm món vào giỏ hàng và thực hiện đặt hàng  
- Quản lý đơn hàng cho người dùng (xem trạng thái)
- Nhà hàng có thể thêm/sửa/xoá món ăn, quản lý đơn hàng  
- Hệ thống quản trị (Admin) xác nhận cấp tài khoản cho nhà hàng, xem đơn hàng, người dùng
- Responsive và thích hợp cho web (desktop & mobile)

## Kiến trúc & Công nghệ  
- Frontend: thư mục `client` — sử dụng React.Js 
- Backend: thư mục `server` — sử dụng Node.js (Express) 
- Cơ sở dữ liệu: PostgreSQL
- RESTful API: Backend cung cấp các endpoint để frontend gọi  

## Cài đặt & Chạy thử  
1. Clone repository  
   ```bash
   git clone https://github.com/mmchouuu/CN_FoodFast.git
   cd CN_FoodFast

## Cài đặt dependencies cho backend
  ```bash
  cd server
  npm install

## Cài đặt dependencies cho frontend
 ```bash
cd ../client
npm install


## Thiết lập biến môi trường (ví dụ .env) cho backend:
 ```bash
PORT=5000  
DB_URI=your_database_uri  
JWT_SECRET=your_jwt_secret  


## Chạy backend
 ```bash
cd ../server
npm run dev


## Chạy frontend
 ```bash
cd ../client
npm run dev


### Mở trình duyệt tại http://localhost:5173 để sử dụng ứng dụng.

## Hướng dẫn sử dụng

Sau khi đăng nhập, bạn sẽ thấy giao diện menu.

Chọn món ăn muốn đặt → thêm vào giỏ hàng → đi tới thanh toán.

Xem lịch sử đơn hàng tại phần “Đơn hàng của tôi”.

Admin (nếu có quyền) truy cập vào /admin để quản lý món & đơn hàng.

### Lưu ý: README này là bản mẫu và bạn nên cập nhật chi tiết thực tế về công nghệ, cài đặt, môi trường, các API endpoint, cách triển khai… phù hợp với dự án thực của bạn.

