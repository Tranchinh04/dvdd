# Đăng ký tài khoản DVDD

Đã đọc trang công khai `https://dvdd.casa/register.php` ngày 26/10/2026. Việc xác minh trực tiếp chỉ dùng GET; không tạo tài khoản thật trong quá trình phát triển.

## Hợp đồng biểu mẫu đã quan sát

- Form `registerForm` dùng POST về cùng trang `/register.php`.
- Trường gửi: `register=1`, `initData` trống khi dùng trình duyệt thông thường, `name`, `emailAddress`, `phone`, `pass`, `repass`. Script trang lấy Telegram initData nếu có và khóa nút gửi sau submit.
- Trang hiện tại không hiển thị CAPTCHA hoặc xác minh email/OTP. Điều này không chứng minh nhà cung cấp sẽ luôn chấp nhận mọi lần đăng ký.
- Đăng ký là thao tác ghi lên tài khoản DVDD, không thuộc ba API worker mua số/lấy OTP đã cung cấp. Chỉ gửi khi người dùng chủ động bấm nút đăng ký.

## Xử lý trong ứng dụng

1. Kiểm tra dữ liệu cả ở trình duyệt và máy chủ. Mật khẩu 8–128 ký tự là quy tắc của ứng dụng, không phải giới hạn được suy ra từ form DVDD. Chuẩn hóa số Việt Nam từ +84/84 về 0.
2. GET form trong một phiên PHP mới. Chỉ nhận form POST về đúng origin/path, trường đã biết và hidden register=1; CAPTCHA/biểu mẫu thay đổi sẽ yêu cầu thao tác tại DVDD. Không chạy script, bỏ qua CAPTCHA hoặc gửi dữ liệu tới địa chỉ tùy ý.
3. POST đăng ký đúng một lần. Không tự thử lại nếu phản hồi mất hoặc lỗi mạng; thông báo chưa xác định và đề nghị đăng nhập trước khi đăng ký lại.
4. Sau khi không có lỗi rõ ràng, đăng nhập bằng thông tin vừa cung cấp và đối chiếu email hồ sơ. Một thông báo thành công từ form không đủ để báo đã kết nối. Nếu chưa xác minh được, trả trạng thái chưa xác định.
5. Đọc token hiện có và số dư/lịch sử. Chỉ sau bước này mới tạo hai cookie mã hóa như luồng đăng nhập. Thiếu token hoặc lỗi đồng bộ được hiển thị là cần hoàn tất thiết lập, không tự tạo/đổi token. Xóa cookie tài khoản cũ khi chuyển sang trạng thái thiết lập chưa kết nối.

Tổng thời hạn luồng đăng ký 45 giây, từng yêu cầu DVDD tối đa 15 giây, trình duyệt chờ tối đa 60 giây. Chỉ trả thông báo đã được chuẩn hóa, không trả HTML nhà cung cấp, cookie phiên, token hay mật khẩu. Mật khẩu được xóa khỏi form khi hoàn tất lần gửi hoặc chuyển tab, không lưu localStorage, cookie hoặc file.

## Kiểm tra

Kiểm thử tự động giả lập toàn bộ thao tác đăng ký tại nhà cung cấp: gửi đúng trường, trùng thông tin, phản hồi mất, xác minh thất bại, thiếu token, cookie mã hóa, chống bấm lặp và giao diện 320–1440 px. Chưa thực hiện đăng ký tài khoản mới thật; việc nhà cung cấp chấp nhận một đăng ký cụ thể còn phụ thuộc thông tin và quy định tại thời điểm gửi.
