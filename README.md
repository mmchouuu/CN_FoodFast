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
  - [Chạy ứng dụng](#chạy-ứng-dụng)
- [Sử dụng nhanh](#sử-dụng-nhanh)
- [Scripts tiện ích](#scripts-tiện-ích)
- [Ghi chú triển khai](#ghi-chú-triển-khai)
- [Giấy phép](#giấy-phép)

---

## Giới thiệu
**CN_FoodFast** là ứng dụng đặt/giao/quản lý món ăn nhanh. Người dùng có thể duyệt thực đơn, thêm món vào giỏ và đặt hàng; nhà hàng quản lý món & đơn; admin duyệt và giám sát hệ thống.

## Tính năng
- Đăng ký / đăng nhập người dùng.
- Duyệt menu theo danh mục, xem chi tiết món.
- Giỏ hàng, đặt hàng, theo dõi trạng thái đơn.
- Nhà hàng quản lý món ăn (thêm/sửa/xoá), quản lý đơn.
- Admin phê duyệt tài khoản nhà hàng, xem thống kê cơ bản.
- Giao diện thân thiện, hỗ trợ desktop & mobile.

## Kiến trúc & Công nghệ
- **Frontend**: `client/` – React (Vite).
- **Backend**: `server/` – Node.js (Express).
- **Database**: PostgreSQL.
- **API**: RESTful endpoints giữa frontend ↔ backend.

> Lưu ý: repo này cung cấp môi trường **dev** tách 2 app *client* và *server*. Các dịch vụ khác (email, socket, v.v.) có thể bổ sung sau.

## Cấu trúc thư mục
