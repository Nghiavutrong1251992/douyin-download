# Cloudflare Worker — Multi-Fanpage backend

Backend này thực hiện Facebook OAuth, lưu nhiều Page Access Token đã mã hóa trong D1, chọn Page mặc định và kiểm tra token mỗi ngày.

## 1. Tạo cấu hình

```powershell
Copy-Item wrangler.toml.example wrangler.toml
npx wrangler d1 create douyin-facebook
```

Điền `database_id`, `FB_APP_ID` và `CHROME_EXTENSION_ID` vào `wrangler.toml`. ID extension xem tại `chrome://extensions`.

## 2. Khởi tạo D1

```powershell
npx wrangler d1 execute douyin-facebook --remote --file schema.sql
```

## 3. Cài secrets

```powershell
npx wrangler secret put FB_APP_SECRET
npx wrangler secret put TOKEN_ENCRYPTION_KEY
```

`TOKEN_ENCRYPTION_KEY` phải là 32 byte dạng Base64. Có thể tạo bằng:

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

## 4. Facebook App

Trong Meta for Developers, thêm Facebook Login và khai báo Valid OAuth Redirect URI:

```text
https://<worker-domain>/v1/facebook/callback
```

App cần các quyền `pages_show_list`, `pages_read_engagement` và `pages_manage_posts`. Người ngoài vai trò app chỉ sử dụng được sau khi quyền tương ứng được Meta duyệt.

## 5. Deploy

```powershell
npx wrangler deploy
```

Copy URL Worker vào tab **Cài đặt** của extension, bấm **Lưu cấu hình**, sau đó sang tab **Fanpages** để kết nối.

Không commit `wrangler.toml`, `.dev.vars`, Facebook App Secret hoặc khóa mã hóa token.
