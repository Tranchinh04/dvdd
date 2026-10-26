# OtpFlash trên Vercel

Production: https://otpflash.vercel.app/

Triển khai ngày 26/10/2026 vào project `otpflash`, framework Next.js được khai báo trong `vercel.json`, runtime Functions tại Singapore (`sin1`). SESSION_SECRET được lưu dạng Secret cho Production, không cấu hình API token dùng chung. `.vercelignore` loại các file môi trường, node_modules, build cục bộ và thư mục Netlify khỏi source upload. CLI xác nhận deployment READY; truy cập không có đăng nhập Vercel trả HTTP 200 và đúng tiêu đề OtpFlash.

## Kết quả và phần bị chặn

- Bộ 77 kiểm thử đã chạy qua, bao gồm giữ phiên, đăng ký giả lập, lịch sử nhiều trang, số dư, QR, mobile và đồng bộ khi đổi màn/quay lại tab/có mạng. Sau đó bổ sung kiểm thử HTTP 403 và success=0 của API DVDD; chín kiểm thử liên quan provider/workspace đều đạt.
- Kiểm tra thật trên production: API cấu hình/tài khoản không đăng nhập trả JSON đúng và không có token dùng chung. Giao diện đăng ký/đăng nhập hiển thị được.
- Đăng nhập thật bị DVDD từ chối HTTP 403 ngay bước `GET /login.php` (`login-form`), trước khi gửi mật khẩu tới DVDD. Đã quan sát cùng lỗi khi Functions ở `iad1` và `sin1`; truy cập cùng form từ máy phát triển trả HTTP 200. Điều này xác nhận có khác biệt truy cập giữa môi trường, chưa xác định chính xác quy tắc phía DVDD.
- Vì bị chặn ở form đăng nhập, chưa thể xác minh số dư, lịch sử, QR hoặc khôi phục phiên đăng nhập thật trên Vercel. Không báo các luồng này hoạt động 100% trên production.
- Không tạo tài khoản thật, mua số hoặc chuyển tiền trong kiểm tra. Không đưa mật khẩu, API token, cookie hoặc dữ liệu ngân hàng thật vào báo cáo.

Để hoàn tất, cần DVDD cho phép backend được dùng hoặc cung cấp API tài khoản chính thức; phương án khác là chạy phần API trên máy chủ mà DVDD chấp nhận và giữ frontend tại Vercel. Không khắc phục bằng cách đổi SESSION_SECRET hay dùng chung API key cá nhân cho mọi khách truy cập.

## Đối chiếu trực tiếp cùng yêu cầu

Probe chỉ đọc được chạy tại local và một preview có Vercel Authentication; không gửi mật khẩu hoặc token thật. Cùng URL, cùng header Accept/User-Agent, không tự theo redirect:

| Yêu cầu | Local (Cloudflare trace: VN) | Vercel sin1 (Cloudflare trace: SG) |
| --- | --- | --- |
| dvdd.casa/login.php | 200, tiêu đề Đăng nhập, có form | 403, Attention Required! &#124; Cloudflare, không có form |
| dvdd.casa/login.php với User-Agent mặc định | 200 | 403, cùng trang chặn |
| dvdd.casa/register.php | 200, tiêu đề Đăng ký | 403, cùng trang chặn |
| API worker, getOtp với key thử không hợp lệ | 200, JSON | 200, JSON |
| example.com | 200 | 200 |

Phản hồi 403 có server=cloudflare và nội dung khớp trang chặn, không có cf-mitigated=challenge. CF-Ray của một yêu cầu login bị chặn: `a506c97cfda5b929-HKG`; register: `a506c97cf9dde8bd-HKG`. Những mã này có thể giúp quản trị DVDD tra sự kiện firewall. Chưa xác định chính xác quy tắc IP/quốc gia/bot nào được áp dụng; không suy ra chỉ từ mã HTTP.

Worker trả success=0 cho key thử không hợp lệ. Đã sửa để nhận đây là lỗi nhà cung cấp, ẩn token khỏi thông báo; chỉ boolean true mới xác nhận thành công, không chấp nhận số 1 cho giao dịch mua. API worker truy cập được qua Vercel, nhưng chưa thử mua số thật. Các file probe tạm đã được xóa khỏi source sau đối chiếu.
