# Tìm Giá Trị — Workbook 7 bước tìm giá trị cốt lõi

Website tiếng Việt dạng workbook tự làm giúp mỗi người tự tìm ra giá trị cốt lõi của bản thân — đi từ bằng chứng sống, qua lọc giá trị thật, đối chiếu điều không chịu nổi, xếp hạng bằng trực giác, kiểm chứng 5 câu hỏi, đến hành động cụ thể ngay trong tuần này.

- **Không cần backend, không cần build, không cần tài khoản.** Toàn bộ dữ liệu người dùng nhập chỉ lưu cục bộ trong trình duyệt (`localStorage`) và không gửi đi bất kỳ đâu.
- **URL GitHub Pages mặc định:** `https://duyphuc1413.github.io/tim-gia-tri/` (nếu đổi tên repo hoặc gắn tên miền riêng, tìm-replace URL này trong `index.html`, `robots.txt` và `sitemap.xml`).

## Chạy thử cục bộ

- **Mở trực tiếp:** mở `index.html` bằng trình duyệt (script được nạp theo chuẩn classic `defer`, không phụ thuộc ES modules nên chạy được cả qua `file://`).
- **Chạy qua server tĩnh (khuyên dùng khi phát triển):**
  ```bash
  python3 -m http.server 8000
  ```
  Sau đó mở `http://localhost:8000`.

## Chạy kiểm thử tự động

Dự án dùng bộ test runner tích hợp sẵn của Node.js (không cần `npm install`):

```bash
node --test tests/*.test.js
```

## Tài khoản, Dùng thử 3 ngày & Gói Pro (tùy chọn)

- **Mô hình Freemium:** hành trình 7 bước cốt lõi luôn miễn phí và chạy hoàn toàn cục bộ khi chưa cấu hình backend (`assets/js/config.js` để trống).
- **Khi kích hoạt backend** (xem hướng dẫn chi tiết từng bước tại [`docs/SETUP-SUBSCRIPTION.md`](docs/SETUP-SUBSCRIPTION.md)):
  - **Đăng nhập:** Email + mật khẩu, Google OAuth, hoặc **Số điện thoại + OTP qua Zalo ZNS** (`supabase/functions/sms-hook`).
  - **Dùng thử 3 ngày miễn phí** tự động cấp cho tài khoản mới qua trigger DB; **Gói Pro 99.000đ/tháng** hoặc **790.000đ/năm (tiết kiệm 33%)** thanh toán VietQR qua **PayOS** (`create-payment` + `payos-webhook`).
  - **Quyền lợi Pro:** lưu đám mây & đồng bộ nhiều thiết bị, lịch sử hành trình qua nhiều năm, Bước 8 tương tác **BE–DO–HAVE** (7 lĩnh vực), email nhắc soi lại hằng tháng (`send-reminders`), và xuất báo cáo **PDF A4** dàn trang sẵn.
  - **Quyền riêng tư (Nghị định 13/2023):** trang `privacy.html` và nút tự xóa vĩnh viễn tài khoản (`delete-account`).

## Cấu trúc mã nguồn

- `index.html`, `account.html`, `privacy.html` — trang workbook chính, trang quản lý tài khoản / gói Pro và trang Chính sách bảo mật & Điều khoản.
- `assets/css/style.css` — hệ thống thiết kế phong cách **workbook in ấn**: giấy ấm, mực than, một màu nhấn đỏ gạch, góc sắc nét, hỗ trợ đầy đủ chế độ Sáng / Tối đạt chuẩn tương phản WCAG AA+, thanh điều hướng dính gọn một dòng, sticky footer trên di động (`overflow: clip`) và stylesheet in ấn (`@media print`) ép nền trắng/mực đen kể cả khi hệ điều hành đang bật Dark Mode.
- `assets/js/data.js` — dữ liệu chuẩn (ngân hàng 48 giá trị, 18 anti-values, 5 câu kiểm chứng, cấu hình giới hạn) và toàn bộ hàm thuần xử lý nghiệp vụ: tìm kiếm tiếng Việt không dấu (`normalizeText`), xáo trộn cặp & đảo vế tránh thiên lệch vị trí (`buildShuffledPairs`), xếp hạng Copeland kết hợp đối đầu trực tiếp khi hòa điểm (`computeRanking`), chuẩn hóa/di trú dữ liệu `localStorage` (`sanitizeSavedState`), tạo bản tổng kết kèm ngày lập (`buildSummaryText`), đọc ngược điều không chịu nổi theo bảng `ANTI_MAP` (`readAntis`), tìm từ người dùng đã tự viết ở Bước 1 (`findMentionedValues`), so sánh với lần làm trước (`compareRankings`, `sanitizeHistory`, `upsertHistory`), tạo file lịch nhắc `.ics` (`buildIcs`) và ba câu soi xung đột theo bảng riêng (`conflictQuestions`).
- `assets/js/app.js` — bộ điều khiển giao diện & trạng thái hành trình: thanh tiến độ bấm nhảy bước trực tiếp, ngăn xem lại Bước 1 ngay trong Bước 2–3, đối chiếu Bước 3 ngay trong Bước 4, nút lùi 1 cặp (`Backspace`/`Z`) và phím tắt chọn nhanh (`←`/`→` hoặc `1`/`2`) ở Bước 5, bảo toàn kết quả khi quay lại từ Bước 6, lọc an toàn DOM (không nội suy dữ liệu người dùng vào `innerHTML`), tự lưu debounce vào `localStorage`, scroll-spy và nút đổi chế độ Sáng / Tối.
- `assets/js/config.js`, `assets/js/billing-core.js`, `assets/js/auth.js`, `assets/js/account-page.js`, `assets/js/pro.js` — cấu hình công khai Supabase, logic tính hạn dùng thử / Pro, xác thực Email / Google / Zalo OTP, đồng bộ đám mây, Bước 8 BE–DO–HAVE và xuất PDF A4.
- `supabase/migrations/0001_init.sql`, `supabase/config.toml`, `supabase/functions/*` — lược đồ PostgreSQL có RLS + 5 Edge Functions (`create-payment`, `payos-webhook`, `sms-hook`, `send-reminders`, `delete-account`).
- `assets/img/og-cover.png` — ảnh xem trước Open Graph / mạng xã hội (1200×630) đồng bộ phong cách workbook.
- `tests/core.test.js`, `tests/subscription.test.js` — unit test cho lõi workbook, chữ ký PayOS, chuẩn hóa SĐT Việt Nam và tính hạn Pro.
- `robots.txt`, `sitemap.xml`, `.nojekyll` — cấu hình SEO và tối ưu xuất bản tĩnh trên GitHub Pages.

## Hành trình 7 bước + Bản đồ kết quả

1. **Bằng chứng sống:** viết 6 khoảnh khắc định hình (tối thiểu 3 ô, mỗi ô từ 10 ký tự; có hiển thị trạng thái từng ô).
2. **Đặt tên giá trị:** chọn 5–15 từ từ ngân hàng 48 giá trị hoặc tự thêm từ riêng; có tìm kiếm tiếng Việt không dấu và ngăn mở xem lại khoảnh khắc Bước 1. Từ nào người dùng đã tự viết ra ở Bước 1 thì được gạch chân làm gợi ý.
3. **Lọc giá trị thật:** phân loại từng từ thành *Đã sống* (3–8 từ vào vòng xếp hạng), *Khát vọng* và *“Nên có”*.
4. **Những điều không chịu nổi (anti-values):** chọn các giá trị đối nghịch kèm dải đối chiếu trực tiếp với nhóm *Đã sống* ở Bước 3 (có thể bỏ qua sau 1 lần xác nhận). Khung **“Đọc ngược”** cập nhật ngay khi chọn: mỗi điều không chịu nổi chỉ về giá trị nào, có ✓ nếu đã nằm trong nhóm *Đã sống*, và gợi ý giá trị có thể đã bỏ sót.
5. **Xếp hạng bằng trực giác:** so sánh từng cặp đã xáo trộn thứ tự và vế trái/phải; hỗ trợ phím tắt `←`/`→` (`1`/`2`), hoàn tác cặp vừa chọn (`Backspace`/`Z`), và giữ nguyên kết quả nếu người dùng quay lại xem.
6. **Kiểm chứng:** 5 câu hỏi tự soi; nếu chọn “Chưa chắc” sẽ hiện nút gợi ý quay thẳng về bước liên quan.
7. **Định nghĩa & bài tập 100%:** viết định nghĩa bằng lời riêng và một hành động cụ thể làm trong tuần này cho Top 5.
8. **Bản đồ giá trị:** hiển thị ngày lập, Top 5, giá trị phụ, anti-values, khát vọng và bằng chứng sống; ba câu **soi xung đột** dùng chính top giá trị của người dùng; khối **“So với lần làm trước”** (giữ / lên / xuống hạng, mới xuất hiện, đã nhường chỗ) nếu trình duyệt có lịch sử; hỗ trợ **Sao chép**, **Tải về `.txt`** (UTF-8 BOM, kèm ngày lập trong tên file), **Đặt lịch soi lại `.ics`** (nhắc sau 24 giờ, hằng tháng 12 lần, sau 1 năm, lúc 20:00) và **In bản tổng kết** sạch đẹp.

## Lưu tiến trình cục bộ (`localStorage`)

- Key lưu trữ: `tim-gia-tri-v1` (hỗ trợ đọc và tự di trú dữ liệu từ cấu trúc v1 lên v2 nên không làm mất tiến trình cũ của người dùng).
- Tự lưu khi chuyển bước, bấm chọn và tự lưu debounce (350ms) khi đang gõ; tự xả bộ đệm khi đóng trang (`beforeunload`).
- Nút **“Lưu và quay lại sau”** lưu ngay lập tức và báo giờ lưu; nút **“Bắt đầu lại”** hỏi xác nhận trước khi xóa sạch key lưu trữ.
- **Sao lưu / mở file:** nút “Sao lưu ra file” tải toàn bộ tiến trình (kèm lịch sử) về dạng `.json`; trên máy khác bấm “Mở file sao lưu” để nạp lại. File được kiểm tra qua `sanitizeSavedState` trước khi dùng và chỉ nằm trên máy người dùng.
- **Lịch sử các lần làm:** key riêng `tim-gia-tri-history-v1`, tối đa 10 lần, mỗi lần giữ top 8 và anti-values, nhận diện theo `journeyId`. “Bắt đầu lại” **không** xóa lịch sử (để lần sau so sánh được); muốn xóa thì bấm nút ở bước kết quả.
- Giao diện Sáng / Tối được lưu riêng tại key `tim-gia-tri-theme` (mặc định theo thiết lập hệ điều hành).

## Font chữ

- Dùng **Be Vietnam Pro** (nội dung, nút, ô nhập) và **Noto Serif** (tiêu đề, trích dẫn) từ Google Fonts — cả hai đều hỗ trợ đầy đủ dấu tiếng Việt. Không dùng lại font viết tay không hỗ trợ tiếng Việt.

## Đẩy lên GitHub Pages

1. Đẩy mã nguồn lên nhánh `main` của repo `duyphuc1413/tim-gia-tri`.
2. Vào **Settings → Pages → Build and deployment**: chọn **Source: Deploy from a branch**, **Branch: `main`**, thư mục **`/ (root)`**, rồi lưu.
3. Sau khi triển khai xong, kiểm tra:
   - `https://duyphuc1413.github.io/tim-gia-tri/`
   - `https://duyphuc1413.github.io/tim-gia-tri/robots.txt`
   - `https://duyphuc1413.github.io/tim-gia-tri/sitemap.xml`
   - `https://duyphuc1413.github.io/tim-gia-tri/assets/img/og-cover.png`
