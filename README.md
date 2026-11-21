# Tìm Giá Trị — bản code để phát triển

Website tiếng Việt giúp người khác tự tìm ra giá trị cốt lõi của bản thân.
Bản này được tách ra từ file HTML duy nhất đã xuất từ Muse (artifact `website-t-m-gi-tr`, bản v3 — bản đã sửa lỗi font: chỉ dùng Be Vietnam Pro + Noto Serif, đều hỗ trợ tiếng Việt).

> **URL placeholder — chưa phải URL thật.** Toàn bộ link trong code (`index.html`, `robots.txt`, `sitemap.xml`) đang dùng `https://duyphuc1413.github.io/tim-gia-tri/` làm placeholder, vì tên repo GitHub thật chưa được chốt. Khi chốt tên repo, tìm-replace toàn bộ `duyphuc1413.github.io/tim-gia-tri` bằng URL Pages thật (xem mục “Đẩy lên GitHub Pages” bên dưới). Không đổi tên repo mà quên đổi URL thì OG/canonical/sitemap sẽ trỏ sai.

## Chạy thử
Không cần build, không cần backend, không cần cài gì.
- Cách nhanh nhất: mở `index.html` bằng trình duyệt.
- Cách đúng hơn (tránh lỗi font/cache khi mở file trực tiếp): chạy server tĩnh trong thư mục này, ví dụ `python3 -m http.server 8000` rồi mở `http://localhost:8000`.

## Cấu trúc
- `index.html` — toàn bộ nội dung và cấu trúc trang (nền tảng, lộ trình, hành trình 7 bước, bản đồ giá trị, FAQ). Đã có meta description, Open Graph, Twitter card, canonical và favicon SVG inline (chữ G trắng trên nền đỏ gạch).
- `assets/css/style.css` — toàn bộ CSS. Phong cách workbook in: giấy trắng, mực đen, một màu nhấn đỏ gạch, góc vuông, không bo tròn / không nút pill. Cuối file có stylesheet in (`@media print`) — chỉ in phần bản đồ giá trị.
- `assets/js/app.js` — toàn bộ logic hành trình 7 bước, không framework, vanilla JS. Gồm cả lưu tiến trình vào localStorage (xem bên dưới).
- `robots.txt` — cho phép mọi bot, trỏ tới sitemap (URL placeholder, xem lưu ý ở đầu file này).
- `sitemap.xml` — chỉ có 1 URL là trang chính (URL placeholder, xem lưu ý ở đầu file này).

## Hành trình 7 bước (trong `app.js`)
1. Viết 6 khoảnh khắc định hình (cần tối thiểu 3 ô mới qua được).
2. Chọn giá trị từ ngân hàng 48 giá trị (có thêm từ riêng, tối đa 15).
3. Lọc giá trị thật / khát vọng / "nên có" (chỉ nhóm "đã sống" vào vòng xếp hạng).
4. Chọn anti-values (điều không chịu nổi).
5. Xếp hạng bằng so sánh từng cặp theo trực giác (giá trị khát vọng bị loại khỏi vòng so cặp).
6. Kiểm chứng bằng 5 câu hỏi.
7. Viết định nghĩa + hành động trong tuần này.
Kết thúc: Bản đồ giá trị, nút sao chép, tải về (.txt) và in bản tổng kết.

## Lưu tiến trình hoạt động như thế nào
- Sau mỗi bước (và mỗi lần gõ/chọn), toàn bộ trạng thái được lưu vào `localStorage` của trình duyệt, key `tim-gia-tri-v1`: bước hiện tại, 6 ô trải nghiệm, giá trị đã chọn (kể cả từ tự thêm), phân loại, anti-values, các cặp đã so, điểm số, bảng xếp hạng, câu kiểm chứng, định nghĩa và hành động.
- Mở lại trang trên **cùng trình duyệt, cùng thiết bị** là tự khôi phục đúng bước đang làm dở, kèm dòng trạng thái "Đã khôi phục tiến trình lưu lúc …". Không cần tài khoản, không gửi dữ liệu đi đâu — mọi thứ chỉ nằm trên máy người dùng.
- Nút **“Lưu và quay lại sau”** (đầu hành trình): lưu ngay và hiện giờ đã lưu. Thực ra trang đã tự lưu sau mỗi bước, nút này chủ yếu để người dùng yên tâm đóng trang.
- Nút **“Bắt đầu lại”** (đầu hành trình, và nút "Làm lại từ đầu" ở bước kết quả): hỏi xác nhận, rồi xóa key `tim-gia-tri-v1` và tải lại trang trắng.
- Muốn giữ lại lâu dài hoặc mang sang máy khác: dùng nút sao chép / tải về (.txt) / in ở bước kết quả. localStorage không đồng bộ sang máy khác.
- Lưu ý kỹ thuật: nếu trình duyệt ở chế độ ẩn danh chặn localStorage hoặc bộ nhớ đầy, hành trình vẫn chạy bình thường, chỉ không lưu được — code đã bọc `try/catch` cho mọi lần đọc/ghi.

## Font
- Be Vietnam Pro (nội dung, nút, ô nhập) và Noto Serif (tiêu đề), tải từ Google Fonts trong `index.html`.
- Đừng dùng lại font viết tay Caveat: nó không hỗ trợ tiếng Việt nên chữ có dấu bị vỡ font — đó chính là lỗi đã sửa ở bản v3.

## UX / Accessibility
- Nút Tiếp tục/Quay lại dính ở cuối màn hình trên điện thoại (sticky footer); phần nội dung wizard có thêm khoảng đệm cuối trên mobile để không bị thanh nút che mất ô nhập cuối cùng.
- Focus bàn phím rõ ràng (viền đỏ 3px) trên mọi nút, chip, ô nhập; chip giá trị và nút so cặp có `aria-label` đầy đủ, nút so cặp ghi rõ "Chọn X thay vì Y"; vùng so cặp có `aria-live="polite"` để trình đọc màn hình nghe được cặp mới.
- Chọn bằng bàn phím: chip, nút phân loại, nút so cặp đều là `<button>` nên dùng Tab để di chuyển, Enter/Space để chọn; ô thêm từ riêng bấm Enter là thêm.
- Có skip link "Bỏ qua tới hành trình" (chỉ hiện khi tab tới) ở đầu trang.
- Chữ dài do người dùng nhập được ngắt dòng (`overflow-wrap: break-word`) để không tràn ngang trên điện thoại.

## In bản tổng kết
- Nút **“In bản tổng kết”** ở bước kết quả gọi `window.print()`. Stylesheet in chỉ giữ lại phần bản đồ giá trị (ẩn hero, menu, các phần giải thích, footer và cả các nút), ép nền trắng/chữ đen để in sạch.

## Sửa gì, ở đâu
- Đổi câu chữ / thêm bước: sửa `index.html` và logic tương ứng trong `app.js`.
- Đổi màu / bố cục / responsive: sửa `assets/css/style.css` (biến màu ở đầu file).
- Thêm / bớt giá trị trong ngân hàng 48 giá trị: sửa mảng `VALUES` trong `app.js`.
- Đổi key lưu tiến trình hoặc thêm trường lưu mới: sửa `STORAGE_KEY` và hàm `saveProgress`/`restoreSaved` trong `app.js` (nhớ tăng `version` nếu đổi cấu trúc dữ liệu đã lưu, để bản cũ không khôi phục sai).
- Sau khi sửa, mở lại trang và đi hết 7 bước một lượt để kiểm tra, đặc biệt trên điện thoại (nút Tiếp tục/Quay lại dính cuối màn hình).

## Đẩy lên GitHub Pages
1. Chốt tên repo thật (ví dụ `tim-gia-tri` — hiện chưa chốt, xem lưu ý placeholder ở đầu file này).
2. Tạo repo trên GitHub, đẩy toàn bộ thư mục này lên nhánh `main`, thư mục gốc.
3. Bật Pages: Settings → Pages → Source: Deploy from a branch → Branch: `main`, thư mục `/ (root)`.
4. Tìm-replace toàn bộ `duyphuc1413.github.io/tim-gia-tri` trong `index.html`, `robots.txt`, `sitemap.xml` bằng URL Pages thật, commit lại.
5. Kiểm tra sau khi deploy: mở URL Pages, đi hết 7 bước, đóng trang mở lại xem tiến trình có khôi phục không, kiểm tra `https://<URL-thật>/robots.txt` và `/sitemap.xml` trả 200.

## Lưu ý
- Đây là trang tĩnh (static), không có tài khoản, không có server.
- Muốn đưa lên mạng cho người khác dùng: deploy thư mục này lên GitHub Pages / Netlify / Vercel dưới dạng static site, hoặc đẩy lên repo GitHub rồi bật Pages.
