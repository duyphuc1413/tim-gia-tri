# Hướng dẫn đóng gói ứng dụng iOS & Android (Tìm Giá Trị)

Ứng dụng di động **Tìm Giá Trị** sử dụng **Capacitor** để đóng gói trực tiếp cùng một mã nguồn web (`index.html`, `daily.html`, `compare.html`, `account.html`, `workshop.html`) thành ứng dụng native cho **Android (Google Play)** và **iOS (App Store / TestFlight)**, đồng thời kích hoạt **Thông báo nhắc hằng ngày native** (`@capacitor/local-notifications`) đã được tích hợp sẵn trong `assets/js/native-reminders.js`.

> **Lưu ý cài ngay hôm nay không cần App Store:** Trang web đã có sẵn **PWA (`manifest.webmanifest` + `sw.js`)**. Người dùng iPhone (Safari → Chia sẻ → *Thêm vào MH chính*) và Android (Chrome → *Cài đặt ứng dụng*) có thể dùng như app ngay lập tức.

---

## 1. Chuẩn bị môi trường trên máy của bạn
- **Node.js 20+**
- **Android:** cài [Android Studio](https://developer.android.com/studio) (JDK 17+ đi kèm).
- **iOS:** máy **macOS** cài **Xcode 15+** và CocoaPods (`sudo gem install cocoapods`).

---

## 2. Khởi tạo dự án native (chạy 1 lần)

```bash
cd mobile
npm install

# Khởi tạo dự án Android
npm run init:android

# Khởi tạo dự án iOS (chỉ chạy trên macOS)
npm run init:ios
```

---

## 3. Đồng bộ code web & mở Android Studio / Xcode

Mỗi khi cập nhật giao diện hoặc tính năng web, chỉ cần chạy:

```bash
cd mobile
npm run sync:android   # Đồng bộ sang Android
npm run open:android   # Mở Android Studio → Build → Generate Signed Bundle (.aab)

npm run sync:ios       # Đồng bộ sang iOS (macOS)
npm run open:ios       # Mở Xcode → Product → Archive → Distribute App (TestFlight / App Store)
```

---

## 4. Lưu ý quan trọng khi duyệt App Store & Google Play
1. **Đăng nhập OAuth:** Trong Supabase Dashboard → *Authentication → URL Configuration*, thêm Redirect URL: `https://localhost/account.html` (để hoạt động mượt với `androidScheme: "https"` / `iosScheme: "https"` của Capacitor).
2. **Thanh toán trên App Store (iOS):** Apple yêu cầu sản phẩm số mua *trong app iOS* phải dùng **In-App Purchase (Apple IAP)** nếu mở trực tiếp trang thanh toán ngoài. Giải pháp an toàn để duyệt nhanh: trên iOS giữ trải nghiệm miễn phí + đăng nhập đồng bộ tài khoản Pro đã mua trên web (Reader/Companion app), hoặc tích hợp RevenueCat sau khi có doanh thu ổn định.
3. **Thông báo nhắc hằng ngày:** Quyền thông báo trên Android 13+ (`POST_NOTIFICATIONS`) và iOS đã được tự động xin quyền khi người dùng bấm nút **“Bật thông báo trực tiếp (App iOS/Android)”** trong trang `daily.html`.
