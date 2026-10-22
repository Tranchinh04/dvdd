# DVDD Workspace

Ứng dụng Next.js bằng tiếng Việt để đăng nhập DVDD, xem số dư và lịch sử tài khoản, mua số điện thoại thường hoặc Vietnamobile và nhận OTP.

## Chạy ứng dụng

Yêu cầu Node.js 20.18.1 trở lên và npm.

```bash
npm install
npm run dev
```

Mở **http://localhost:3000**. Vào **Tài khoản DVDD**, nhập email/mật khẩu của tài khoản DVDD và bấm **Đăng nhập & kết nối**. Ứng dụng tự đọc API token hiện có, số dư, thông tin cá nhân, lịch sử thuê số và giao dịch của tài khoản đó. Đăng nhập không mua số và không trừ tiền.

Nếu chỉ có API token, vào **Cấu hình API → Kết nối bằng API token → Lưu kết nối**. Cách này vẫn mua số/lấy OTP được, nhưng ba API DVDD được cung cấp chưa có số dư và lịch sử tài khoản. Lưu token riêng lẻ không xác thực bằng một yêu cầu mua số.

Bạn có thể chọn **Xem bản demo** để trải nghiệm mà không cần token. Dữ liệu demo được đánh dấu rõ ràng, lưu riêng với dữ liệu thật và không gọi DVDD.

## Người dùng mới lấy token ở đâu?

Token được lấy trong mini app của [@dvddBot trên Telegram](https://t.me/dvddBot):

1. Mở bot, vào mini app dịch vụ DVDD.
2. Chọn **Đăng nhập** bằng tài khoản DVDD. Nếu chưa có tài khoản, chọn **Đăng ký** và điền họ tên, email, số điện thoại, mật khẩu, nhập lại mật khẩu; hoàn tất các bước theo hướng dẫn của DVDD.
3. Trong menu của mini app, chọn **API**. Ở khối **Thông tin kết nối API**, tìm ô **Api token** và bấm **Sao chép**. Nếu ô chưa có mã, dùng nút **Tạo mới** trước. Khi đã có token đang sử dụng, sao chép mã hiện tại.
4. Quay lại ứng dụng này → **Tài khoản DVDD → Đăng nhập & kết nối** để tự đọc token và đồng bộ tài khoản. Bạn cũng có thể dán token tại **Cấu hình API** nếu chỉ cần mua số/lấy OTP.
5. Trước khi mua số, nạp số dư tại mini app DVDD: **Tài chính → Nạp tiền**. Ứng dụng này dùng số dư của tài khoản DVDD ứng với token đã nhập.

Email/mật khẩu dùng trong phần **Tài khoản DVDD** chính là tài khoản đăng nhập mini app, không phải tài khoản Telegram. Mật khẩu chỉ được chuyển đến `https://dvdd.casa/login.php` trong lần đăng nhập và không được lưu vào cookie, localStorage hay file. Sau đó ứng dụng giữ phiên DVDD đã mã hóa, tối đa 24 giờ; nếu DVDD hết phiên sớm hơn thì cần đăng nhập lại. `SESSION_SECRET` chỉ cấu hình bởi người vận hành máy chủ.

Nếu tài khoản chưa có API token, ứng dụng hướng dẫn tạo token trong mục API của DVDD rồi đăng nhập lại; không tự tạo hoặc xoay token đang sử dụng.

## Cấu hình môi trường

File `.env.local` trong thư mục làm việc này đã được tạo với khóa mã hóa ngẫu nhiên, chưa chứa token DVDD. Khi chuyển mã nguồn sang máy khác, tạo lại từ mẫu:

```bash
cp .env.example .env.local
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Dán chuỗi ngẫu nhiên vào `SESSION_SECRET` trong `.env.local`:

```dotenv
SESSION_SECRET=chuoi_ngau_nhien_cua_ban
DVDD_API_KEY=
```

- `SESSION_SECRET`: giữ nguyên giữa các lần khởi động và dùng chung giữa các instance để giải mã cookie token. Cookie hết hạn sau 30 ngày. Nếu không đặt, ứng dụng dùng khóa tạm và bạn phải nhập lại token sau khi máy chủ khởi động lại.
- `DVDD_API_KEY`: tùy chọn cấu hình token trên máy chủ thay vì nhập qua giao diện. Token nhập trong trình duyệt được ưu tiên. Xóa token phiên sẽ quay về token môi trường nếu có.
- Không đưa token vào biến `NEXT_PUBLIC_*`, URL của ứng dụng, Git hoặc mã phía trình duyệt.
- Khởi động lại ứng dụng sau khi thay đổi biến môi trường.

Đây là công cụ dành cho dùng cá nhân. Nếu đặt `DVDD_API_KEY` trên một máy chủ công khai, những người truy cập máy chủ có thể sử dụng token đó; cần giới hạn truy cập bằng cơ chế đăng nhập hoặc cổng truy cập riêng trước khi triển khai công khai.

## Tính năng

- Giao diện sáng, tiếng Việt, thích ứng với máy tính và điện thoại; menu hỗ trợ bàn phím.
- Đăng nhập DVDD một lần để tự lấy token hiện có, đọc họ tên/email/điện thoại và số dư thật. Số dư thiếu dữ liệu được hiển thị là chưa xác định, không thay bằng 0.
- Đọc lịch sử thuê số từ tài khoản DVDD, gồm đơn mua ngoài ứng dụng này; xem mã đơn, số điện thoại, OTP, trạng thái, phí và thời gian nhà cung cấp trả về.
- Xem lịch sử giao dịch DVDD có phân trang. Số tiền/mô tả được giữ theo dữ liệu nhà cung cấp, không suy diễn tiền nạp hoặc tiền trừ từ một số tiền không có dấu.
- Làm mới tài khoản thủ công, sau khi mua thành công, và mỗi 60 giây khi tab hiển thị. Lỗi tạm thời giữ dữ liệu lần cập nhật trước kèm thông báo; phiên hết hạn yêu cầu đăng nhập lại.
- Mua một số mỗi lần, chọn số thường hoặc Vietnamobile và xác nhận trước khi gọi API có tính phí.
- Hiển thị giá tham khảo **4.500đ / 5.500đ**, lưu phí thực tế từ trường `fee`. Các ví dụ API bạn cung cấp có phí khác tiêu đề, nên không dùng giá tham khảo để tính tổng chi phí thật.
- Chuẩn hóa số Việt Nam để hiển thị và sao chép, giữ nguyên số gốc trong dữ liệu đơn.
- Tự kiểm tra OTP mỗi 5, 10, 15 hoặc 30 giây khi tab đang hiển thị, cho cả đơn trên máy và đơn DVDD xác nhận đang chờ. Trạng thái “Đang đặt” được gộp thành “Đang chờ OTP”; tiêu đề và bộ lọc hiển thị số đơn chờ. Báo trong ứng dụng khi có đơn chờ mới, nhận OTP hoặc hết hạn; có thể tạm dừng hoặc kiểm tra thủ công.
- Mỗi nhịp tự động kiểm tra tối đa ba đơn. Lỗi tạm thời được giãn chu kỳ tối thiểu 30 giây; dừng theo dõi khi đã có OTP hoặc DVDD xác nhận hết hạn.
- Lịch sử riêng theo token, tìm số/mã đơn/OTP, lọc trạng thái/nhà mạng/thời gian, phân trang và xuất CSV tương thích Excel.
- Thêm đơn đã có bằng `orderCode` để tiếp tục theo dõi OTP. API không cung cấp phí và thời điểm mua gốc của đơn được thêm lại.
- Lịch sử và thống kê tự tải các trang giao dịch DVDD, gộp với đơn trên máy theo mã đơn. Mặc định xem toàn bộ thời gian; có bộ lọc 7/30 ngày, biểu đồ theo thời điểm mua và xuất CSV.
- Khôi phục đơn thuê cũ từ mô tả giao dịch thuê số, đối chiếu khoản hoàn do không nhận OTP. Đơn không còn chi tiết số/OTP được đánh dấu; không suy đoán đơn thành công hoặc năm mua.
- Mã hóa token bằng AES-256-GCM trong cookie HttpOnly, SameSite Strict; bật Secure khi dùng HTTPS. Cookie chỉ gửi đến `/api`.
- Phiên đăng nhập DVDD nằm trong cookie mã hóa riêng, ràng buộc với API token hiện tại. Đổi/xóa token sẽ xóa phiên đăng nhập; đăng xuất xóa cả hai cookie của trình duyệt này. Dữ liệu tài khoản thật được tách khỏi chế độ demo.
- Kiểm tra nguồn và dữ liệu yêu cầu, không cache phản hồi chứa OTP, không đưa token vào thông báo lỗi.

## Cách tích hợp API

Trình duyệt chỉ gọi các Route Handler cùng nguồn. Máy chủ gọi endpoint DVDD cố định bằng phương thức GET theo tài liệu bạn cung cấp:

| Route nội bộ             | Hàm DVDD             | Nội dung JSON gửi lên                    |
| ------------------------ | -------------------- | ---------------------------------------- |
| `GET /api/connection`    | Không gọi DVDD       | Trả trạng thái cấu hình, không trả token |
| `POST /api/connection`   | Không gọi DVDD       | `{ "apiKey": "..." }`                    |
| `DELETE /api/connection` | Không gọi DVDD       | Xóa token của phiên                      |
| `POST /api/account`     | Đăng nhập web DVDD   | `{ "email": "...", "password": "..." }`; không trả token/mật khẩu |
| `GET /api/account?page=1` | Đọc tài khoản web DVDD | Số dư, hồ sơ, lịch sử thuê số và trang giao dịch |
| `GET /api/history?kind=transactions&page=1` | Đọc lịch sử web DVDD | Một trang giao dịch; `kind=phones` đọc bảng thuê số. Cần phiên đăng nhập cùng API token |
| `DELETE /api/account`   | Không gọi DVDD       | Đăng xuất phiên trong ứng dụng này, xóa cookie token |
| `POST /api/phone`        | `getPhoneNumber`     | `{ "service": "standard" }`              |
| `POST /api/phone`        | `getPhoneNumberVNMB` | `{ "service": "vnmb" }`                  |
| `POST /api/otp`          | `getOtp`             | `{ "orderCode": "RTFG21711264013" }`     |

Các yêu cầu ghi cần header `Origin` trùng host ứng dụng và nội dung JSON. Trình duyệt tự gửi header này. Thời gian chờ DVDD là 20 giây. Nút xác nhận bị khóa khi đang mua; ứng dụng không tự gửi lại yêu cầu mua bị lỗi mạng. Nếu phản hồi mua bị mất, hãy kiểm tra tài khoản DVDD trước khi mua lại; nếu có mã đơn, dùng **Thêm mã đơn** để tiếp tục theo dõi. API DVDD chưa cung cấp khóa chống trùng giao dịch hoặc cách truy vấn giao dịch mua bị mất phản hồi.

Ba API được cung cấp chưa có số dư/danh sách đơn. Phần tài khoản dùng phiên đăng nhập để đọc các trang có sẵn của `dvdd.casa`, không phải API tài khoản chính thức. Nếu nhà cung cấp thay đổi đăng nhập/cấu trúc trang, phần đồng bộ có thể cần cập nhật. Connector chỉ đọc hồ sơ, API token hiện có, bảng thuê số của chủ tài khoản và giao dịch; không lấy bảng hoạt động công khai của người khác, không chạy script biểu mẫu mua/hủy/hoàn tiền.

Lịch sử DVDD hiển thị đúng phạm vi nhà cung cấp còn cung cấp. Ứng dụng tải các trang được quảng bá trong phân trang, tối đa hai yêu cầu cùng lúc, hiện tiến độ và giữ dữ liệu đã tải nếu có trang lỗi. Bảng thuê số có thể chỉ còn các đơn gần đây; các mô tả `Trừ ví đơn hàng … phí thuê số [VNMB]` giúp khôi phục thêm đơn cũ. Chỉ mô tả thuê số đã xác minh mới được tính là đơn; không tính nạp tiền hay mua tài khoản. Khoản `Hoàn ví không nhận được OTP …` được ghép theo mã đơn và trừ khỏi phí đã ghi nhận. Không tự gán trạng thái thành công cho đơn chỉ còn giao dịch. Tổng phí là của các đơn đã tải, không phải toàn bộ biến động ví.

Thời điểm mua được ghép với giao dịch có mã đơn và năm đầy đủ, theo múi giờ Việt Nam. Nếu không xác định được năm, ứng dụng giữ nguyên văn bản thời gian và loại đơn đó khỏi biểu đồ/bộ lọc ngày. Đơn vẫn được tính trong tổng toàn bộ thời gian. Tỷ lệ nhận OTP chỉ tính các đơn có kết quả xác định.

Đơn mua/theo dõi qua ứng dụng vẫn lưu riêng theo token tại `localStorage`. Dữ liệu đọc từ DVDD được dùng chung cho đơn gần đây, **Lịch sử đơn hàng** và **Thống kê sử dụng**, chỉ giữ trong bộ nhớ của phiên. Chỉ tự kiểm tra đơn có trạng thái đang chờ; đơn cũ đã kết thúc hoặc chỉ còn giao dịch không bị kiểm tra. Kết quả kiểm tra đơn DVDD được giữ riêng theo tài khoản trong phiên để trạng thái trang web chưa cập nhật không làm mất OTP vừa nhận hoặc tiếp tục kiểm tra đơn đã hết hạn. Có thể đăng nhập lại từ máy khác để đọc phần lịch sử DVDD còn cung cấp; xuất CSV để giữ bản sao. Xóa lịch sử trên máy không xóa đơn ở DVDD. Chế độ dùng thử tắt khi tải lại trang, dữ liệu demo vẫn được giữ riêng.

## Kiểm tra và build

```bash
npm run typecheck
npm run build
npx playwright install chromium
npm test
```

Kiểm thử bao gồm luồng mua demo, lưu token được mã hóa, chống bấm mua lặp, kiểm tra phí trả về, OTP tự động, đơn hết hạn, lỗi số dư, kiểm tra nguồn yêu cầu, lưu lịch sử, CSV và giao diện điện thoại. Phần tài khoản kiểm tra đăng nhập, phiên hết hạn, đổi tài khoản, phân tích số dư/lịch sử, phân trang, lỗi đồng bộ, đăng xuất và tách demo. Toàn bộ đăng nhập nhà cung cấp, mua số/OTP trong bộ kiểm thử tự động đều được giả lập; không trừ tiền tài khoản DVDD. Kiểm tra thiếu token dừng trước khi gọi mua số nếu máy chủ đang chạy có cấu hình token thật.

Nếu đã có Chromium, có thể đặt `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` tới file thực thi thay cho bước cài trình duyệt.

Chạy production:

```bash
npm run build
npm start
```

## Cấu trúc chính

```text
src/app/                 Trang Next.js, metadata, CSS và Route Handler
src/components/          Dashboard, lịch sử, biểu đồ, cài đặt, hộp thoại
src/hooks/use-workspace  Kết nối, lưu lịch sử và theo dõi OTP
src/lib/server/          Mã hóa token, kiểm tra yêu cầu và client DVDD
src/lib/                 Kiểu dữ liệu, dữ liệu demo và xuất CSV
tests/                   Kiểm thử tích hợp và trình duyệt
```

Công nghệ: Next.js 16 App Router, React 19, TypeScript, Lucide, Be Vietnam Pro tự lưu trữ và Playwright. Cách dùng Route Handler và cookie dựa trên tài liệu [Next.js Route Handlers](https://nextjs.org/docs/app/api-reference/file-conventions/route) và [cookies](https://nextjs.org/docs/app/api-reference/functions/cookies).
