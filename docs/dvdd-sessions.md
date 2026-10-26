# Khôi phục đăng nhập và đối chiếu DVDD

Kiểm tra ngày 26/10/2026 dựa trên source ứng dụng, biểu mẫu công khai hiện tại của `https://dvdd.casa/login.php` và `/register.php`.

## Khác biệt đã sửa

- Phiên ứng dụng trước đây hết hạn tuyệt đối sau 24 giờ, trong khi token giữ 30 ngày. Cookie PHP của trang đăng nhập DVDD đang cấp thời hạn 30 ngày. Đã đồng bộ hai cookie ứng dụng sang 30 ngày và gia hạn đồng thời sau yêu cầu đọc tài khoản/lịch sử/nạp tiền được DVDD chấp nhận.
- Biểu mẫu đăng nhập hiện có checkbox `remember`, nhãn “Nhớ mật khẩu”, không khai báo value nên trình duyệt gửi `on`. Connector trước đây bỏ sót trường này; nay gửi khi có trên form.
- Khóa mã hóa ngẫu nhiên theo process không ổn định khi serverless khởi động instance mới. Production nay bắt buộc SESSION_SECRET cố định và trả lỗi cấu hình rõ ràng thay vì nhận đăng nhập rồi mất phiên. Không thay khóa đang hoạt động khi triển khai bản sửa.
- Giao diện trước đây hiện form đăng nhập trước khi GET tài khoản hoàn tất. Nay có trạng thái khôi phục riêng, cho phép thử lại khi lỗi kết nối tạm thời và chỉ hiện form khi không có phiên hoặc đã xác nhận phiên hết hạn.

Cookie là HttpOnly, SameSite Strict, Secure trên HTTPS, phạm vi /api, có Max-Age và Expires. Mật khẩu không được ghi vào cookie, localStorage hoặc file. Đổi token/đăng xuất vẫn chủ động xóa phiên như trước. Phiên cũ còn hiệu lực được nâng thời hạn sau một lần đọc thành công; phiên đã hết hạn cần đăng nhập lại một lần.

## Phạm vi xác minh

- Biểu mẫu đăng ký hiện có đúng name/emailAddress/phone/pass/repass, hidden register=1 và initData trống với trình duyệt thường. Kiểm tra tự động giả lập POST một lần, đối chiếu danh tính sau đăng ký, lỗi trùng thông tin, phản hồi mất và tài khoản chưa có API token.
- Chưa tạo tài khoản thật để kiểm tra toàn bộ vòng đời đăng ký tại nhà cung cấp; chưa chuyển tiền thật hoặc mua số có tính phí trong đợt kiểm tra này. Không thể khẳng định toàn bộ chức năng giống DVDD 100% từ kiểm thử giả lập.
- Tài khoản chưa có token vẫn cần tạo token tại mục API của DVDD theo hướng dẫn trên giao diện. Không tự đổi token hiện có.
- Kiểm thử cookie bao gồm đóng rồi khởi động lại Chromium bằng cùng hồ sơ trình duyệt; kiểm thử máy chủ dùng các Node process tách biệt để xác nhận khóa cố định giải mã được cookie sau cold start.
- Kiểm tra trực tiếp bản production tại máy ngày 26/10/2026 bằng tài khoản đã được người dùng cho phép: đăng nhập thành công, DVDD nhận `remember=on` và chỉ cấp cookie PHPSESSID với thời hạn 30 ngày. Đóng Chromium, dừng rồi chạy lại máy chủ và mở lại cùng hồ sơ trình duyệt khôi phục đúng danh tính mà không gửi lại mật khẩu. Các GET tài khoản, một trang giao dịch và thông tin nạp tiền đều thành công sau khởi động lại. Đã đăng xuất và xóa hồ sơ trình duyệt tạm sau kiểm tra; không lưu thông tin xác thực hoặc dữ liệu tài khoản thật trong tài liệu.
- Xóa cookie, dùng cửa sổ riêng tư, chuyển domain hoặc DVDD thu hồi phiên vẫn yêu cầu đăng nhập lại. Không lưu mật khẩu để tự đăng nhập sau khi DVDD đã hủy phiên.

Bản production cần triển khai lại source mới. SESSION_SECRET phải hiện diện khi Functions chạy, có cùng giá trị giữa các instance và các lần deploy. Thay đổi riêng code không sửa được một deployment còn chạy bản cũ hoặc thiếu biến môi trường ở runtime.
