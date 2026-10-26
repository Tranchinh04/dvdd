# Triển khai OtpFlash trên Render Free

Render có thể chạy toàn bộ Next.js hiện tại, gồm giao diện và các `/api/*`. Không cần thuê VPS hoặc tạo database để chạy luồng hiện có. Cấu hình ở `render.yaml` chỉ tạo **một Web Service, plan Free**, tại Singapore. Chưa có dịch vụ Render nào được triển khai từ bộ cấu hình này.

## Tạo dịch vụ

1. Đưa thay đổi mới nhất (gồm `render.yaml`, `package.json`, `scripts/check-dvdd.mjs`) lên repository của bạn.
2. Đăng nhập [Render Dashboard](https://dashboard.render.com), chọn **New → Blueprint**, cấp quyền truy cập repository `Tranchinh04/dvdd` và chọn nhánh chứa cấu hình.
3. Kiểm tra phần xem trước chỉ có **otpflash / Web Service / Free**, rồi tạo Blueprint. Không nâng cấp compute hoặc thêm dịch vụ trả phí.
4. Blueprint sinh `SESSION_SECRET` riêng cho dịch vụ. Giữ nguyên khóa qua các lần deploy, không đưa giá trị vào Git hoặc biến `NEXT_PUBLIC_*`. Không đặt `DVDD_API_KEY` dùng chung trên website công khai.
5. Chờ build/start hoàn tất, mở URL `https://<tên-dịch-vụ>.onrender.com` do Render thực tế cấp. Tên dịch vụ không bảo đảm subdomain `otpflash.onrender.com` còn trống.

Nếu tạo **New → Web Service** bằng tay, dùng các thiết lập sau:

| Thiết lập | Giá trị |
| --- | --- |
| Language | Node |
| Region | Singapore |
| Instance type | Free |
| Build Command | `npm ci --include=dev && npm run build` |
| Start Command | `npm run start:render` |
| Health Check Path | `/api/connection` |
| Node.js | `24` (đã có `.nvmrc`) |
| SESSION_SECRET | Một giá trị ngẫu nhiên cố định; lưu bằng Environment của Render |

Chỉ cấu hình không nhạy cảm nằm trong YAML. Khóa sinh tự động thuộc Environment của Render, không nằm trong repository. Dịch vụ giữ lịch sử/phiên theo thiết kế hiện tại: cookie mã hóa và lịch sử DVDD, đơn mua tại trình duyệt lưu trong localStorage. Không có database lịch sử mới được tạo.

## Xác minh kết nối từ Render

`npm run start:render` chạy `check:dvdd` ở chế độ báo cáo rồi khởi động Next.js. Kiểm tra chạy trong **môi trường runtime** của dịch vụ, không chỉ môi trường build. Ba yêu cầu GET cố định, không cookie/mật khẩu/token thật, không mua số hoặc tạo tài khoản:

- Đọc form đăng nhập và đăng ký của DVDD, kiểm tra các trường mà connector hiện tại cần.
- Gọi `getOtp` với **key thử cố ý không hợp lệ** để kiểm tra API worker có phản hồi JSON lỗi không.
- Log chỉ ghi tên bước, HTTP status và mã kết quả. Không ghi HTML, cookie, nội dung phản hồi hoặc URL có token.

Nếu `login-form` hoặc `register-form` báo `ACCESS_DENIED`/HTTP 403, DVDD vẫn từ chối kết nối từ Render. Đổi nơi deploy chưa bảo đảm giải quyết được việc này. Ứng dụng vẫn khởi động để có thể kiểm tra giao diện/chế độ API token; chưa chuyển lưu lượng người dùng sang dịch vụ khi đăng nhập chưa được xác minh.

Form trả HTTP 200 và `FORM_AVAILABLE` chỉ xác nhận truy cập form được. Tiếp tục dùng tài khoản được phép để kiểm tra đăng nhập thật, số dư, lịch sử, nạp tiền, tải lại trang và đăng xuất. Không tạo tài khoản mới, mua số hoặc chuyển tiền chỉ để kiểm tra deployment.

Health check `/api/connection` kiểm tra ứng dụng và cấu hình khóa phiên; không gọi DVDD ở mỗi lần health check, không xác nhận đăng nhập thật và không trả khóa phiên/token.

## Vercel và Render

Bản Render này chạy cả giao diện và backend để kiểm tra trực tiếp trước. Vercel hiện tại chưa được cấu hình chuyển tiếp API. Chỉ sau khi xác nhận đăng nhập thực trên Render mới nối các `/api/*` từ Vercel tới Render, với xử lý Origin/Host, cookie và timeout phù hợp. Trỏ URL frontend đơn thuần không tự chuyển các Route Handler đang chạy ở Vercel sang Render.

Mặc định `autoDeployTrigger: off` để kiểm tra chủ động. Sau các lần cập nhật Git, chọn **Manual Deploy → Deploy latest commit**; có thể bật tự động deploy sau khi kiểm tra ổn định.

## Giới hạn Free cần tính đến

Theo [Render Free](https://render.com/docs/free), dịch vụ ngủ sau 15 phút không có truy cập; lần đánh thức tiếp theo mất khoảng một phút. Workspace có 750 giờ Free mỗi tháng và giới hạn bandwidth/build. Free không có persistent disk hoặc SSH, có thể bị khởi động lại. Không dùng tác vụ ping để giữ dịch vụ thức; luồng hiện tại chỉ kiểm tra OTP khi người dùng đang mở web.

Vì vậy chưa thể hứa bản Free luôn phản hồi ngay. Không tự động nâng cấp trả phí. Nếu workspace có phương thức thanh toán, kiểm tra thêm các giới hạn chi tiêu/usage vì bandwidth và build vượt mức có quy tắc tính phí riêng.

Tài liệu tham khảo: [Next.js trên Render](https://render.com/docs/deploy-nextjs-app), [Blueprint](https://render.com/docs/blueprint-spec), [Node.js](https://render.com/docs/node-version), [Health checks](https://render.com/docs/health-checks).
