# 🚀 Douyin to Facebook Auto-Pilot (Chrome Extension)

Tiện ích mở rộng Chrome / Microsoft Edge giúp bóc tách toàn bộ ảnh HD không watermark, caption từ Douyin và tự động dịch, viết lại sang tiếng Anh chuẩn phong cách bài đăng Facebook bằng **DeepSeek AI**.

---

## 📌 Tính năng nổi bật
1. **Bóc tách ảnh gốc Full HD**:
   - Đối với bài đăng Album ảnh / Slideshow (Douyin Note / 图文 như bài cáp treo Phú Quốc): Lấy toàn bộ ảnh gốc độ phân giải cao nhất từ CDN ByteDance, loại bỏ hoàn toàn watermark Douyin.
   - Đối với video: Hỗ trợ lấy link video không watermark.
2. **Dịch & Viết lại bằng DeepSeek AI (`deepseek-chat`)**:
   - Tự động phân tích ngữ cảnh bài tiếng Trung.
   - Viết lại thành bài đăng Facebook hoàn chỉnh: Hook giật tít, mô tả du lịch hấp dẫn, lời kêu gọi hành động (CTA), bộ hashtag tiếng Anh thịnh hành (thay thế hashtag Trung Quốc).
3. **Giao diện Duyệt bài (Review Gallery)**:
   - Hiển thị danh sách ảnh kèm số thứ tự.
   - Cho phép chọn/bỏ chọn từng ảnh theo ý muốn.
   - Cho phép chỉnh sửa trực tiếp nội dung bài dịch trước khi dùng.
4. **Đóng gói 1-Click**:
   - Tải về file `.zip` chứa toàn bộ ảnh đã chọn + file text `caption_facebook.txt`.
   - Nút copy nhanh bài đăng vào clipboard.
5. **Nút bấm nổi ngay trên Douyin (On-page Action)**:
   - Khi bạn lướt `douyin.com`, góc phải dưới màn hình có sẵn nút *"Lấy bài sang FB"*, bấm 1 cái là tự động đọc toàn bộ ảnh và caption của bài đang xem.
6. **Phân loại ảnh và thư mục Offline**:
   - Gắn nhiều tag cho từng ảnh trong Offline Studio và tìm bài/ảnh lại theo tag.
   - Chọn thư mục thật trên máy trong tab **Cài đặt**. Extension tự tạo `Douyin_Offline`, mỗi bài có thư mục ảnh, caption và `metadata.json` chứa tag.
   - Nút **Đồng bộ kho** xuất lại toàn bộ bài đã lưu; nút **Lưu vào thư mục** cập nhật riêng bài đang xem.

---

## 🛠️ Hướng dẫn cài đặt vào trình duyệt (Chỉ mất 30 giây)

1. Mở trình duyệt **Google Chrome** hoặc **Microsoft Edge**.
2. Nhập vào thanh địa chỉ:
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
3. Bật công tắc **Chế độ dành cho nhà phát triển (Developer mode)** ở góc trên bên phải.
4. Bấm nút **Tải tiện ích đã giải nén (Load unpacked)** ở góc trên bên trái.
5. Chọn thư mục:
   ```
   C:\Users\ADMIN\.gemini\antigravity-ide\scratch\douyin-fb-helper
   ```
6. Tiện ích `Douyin to Facebook Auto-Pilot` sẽ xuất hiện ngay trên thanh công cụ của bạn. Bạn nên bấm vào biểu tượng ghim (Pin) để tiện ích luôn hiển thị trên thanh công cụ.

---

## 🔑 Hướng dẫn cấu hình DeepSeek API

1. Bấm vào biểu tượng extension trên thanh công cụ trình duyệt.
2. Chuyển sang tab **"Cài đặt API"**.
3. Dán **DeepSeek API Key** của bạn (dạng `sk-...` lấy tại [platform.deepseek.com](https://platform.deepseek.com)).
4. Bấm **"Lưu Cài đặt"**. Cấu hình sẽ được lưu an toàn trên trình duyệt của bạn.

---

## 🎯 Cách sử dụng với link mẫu Phú Quốc

Bạn có 2 cách cực kỳ tiện lợi:

### Cách 1: Dán trực tiếp vào Extension
1. Sao chép toàn bộ đoạn tin nhắn Douyin:
   ```
   7.69 09/05 :4pm ufb:/ b@a.Nw 富国岛 |世界最长的跨海缆车🚡 谁能想到能美成这样上帝视角俯瞰绝美海景 # 富国岛香岛缆车 # 世界最长的跨海缆车  https://v.douyin.com/VwdKWppOPSU/
   ```
2. Bấm icon extension để mở sidebar, dán vào ô nhập liệu và bấm **"⚡ Phân tích & Lấy dữ liệu"**.
3. Extension sẽ tải toàn bộ ảnh HD của bài cáp treo Phú Quốc và gọi DeepSeek AI viết bài tiếng Anh ngay lập tức.
4. Bấm **"Tải ZIP (Ảnh HD + Caption)"** để lưu về máy.

### Cách 2: Lướt trực tiếp trên Douyin
1. Mở link bài viết trên Chrome: `https://v.douyin.com/VwdKWppOPSU/`
2. Bấm vào nút nổi màu đỏ **"Lấy bài sang FB"** ở góc dưới bên phải màn hình.
3. Sidebar sẽ tự mở để bạn xem toàn bộ ảnh và caption đã được sẵn sàng!

> **Đặt sidebar bên trái:** Chrome/Edge quản lý vị trí Side Panel ở cấp trình duyệt nên extension không thể tự ép vị trí. Mở Side Panel, vào phần tùy chỉnh/cài đặt bảng điều khiển và chọn hiển thị ở **bên trái**. Trình duyệt sẽ ghi nhớ lựa chọn này.
