# Cơ sở của connector tài khoản DVDD

Kiểm tra ngày 21/10/2026 trên mini app được mở từ `https://t.me/dvddBot`. Người dùng đã cho phép đăng nhập tài khoản của họ và đọc cấu hình/thông tin tài khoản. Không mua số, nạp tiền, tạo/xoay token hay hủy giao dịch trong quá trình xác minh.

## Quan sát

- Đường dẫn mục API trong mini app dẫn đến `https://dvdd.casa/dashboard?page=api`.
- Đăng nhập thông thường tại `/login.php` nhận `emailAddress`, `pass`, `sessionKey`, `initData`, `redirect`, `login`. Đăng nhập từ ứng dụng này với phiên mới và `initData` rỗng đã thành công; không cần đăng nhập Telegram lại.
- Cookie phiên quan sát được là `PHPSESSID`. Các trang tài khoản trả HTML có dữ liệu sẵn: hồ sơ tại `page=admin-profile-form`, API token tại `page=api`, bảng số của chủ tài khoản tại `page=order-phone`, giao dịch tại `page=transactions&paging=N`.
- Mục API được kiểm tra chỉ mô tả ba hàm `getPhoneNumber`, `getPhoneNumberVNMB`, `getOtp`, trùng tài liệu người dùng cung cấp. Chưa xác minh có API JSON chính thức riêng cho hồ sơ/số dư/lịch sử hay không; không thử đoán tên hàm trên endpoint có chức năng tính phí.
- Trang thuê số có bảng riêng của chủ tài khoản và các bảng hoạt động công khai của người khác. Connector chỉ nhận bảng có đủ tám tiêu đề của lịch sử thuê số. Bảng giao dịch được nhận bằng sáu tiêu đề riêng.
- Tài khoản kiểm tra trả 10 dòng thuê số và 20 giao dịch trên một trang, với 7 trang giao dịch. Đây là số liệu quan sát của tài khoản đó tại thời điểm kiểm tra, không chứng minh giới hạn hoặc tổng lịch sử của mọi tài khoản.
- Bảng thuê số không cung cấp năm/thời điểm ISO trong các dòng đã kiểm tra. Bảng giao dịch có thời gian đầy đủ; connector giữ văn bản gốc và không suy ra tổng chi tiêu/nạp tiền từ các số tiền không có dấu.
- Kiểm tra HTTP chỉ đọc bổ sung: tham số `paging=2` trên trang thuê số vẫn trả cùng 10 mã đơn, không có liên kết phân trang thuê số. Đọc đủ 7 trang giao dịch thu được 128 giao dịch, gồm 90 mã thuê số riêng biệt và 26 khoản hoàn có mô tả không nhận OTP. Đây là số đếm quan sát, không phải dữ liệu cố định trong ứng dụng.
- Cột mã đơn của giao dịch có thể trống. Mô tả đã quan sát: `Trừ ví đơn hàng [mã đơn] phí thuê số`, `Trừ ví đơn hàng [mã đơn] phí thuê số VNMB`, `Hoàn ví không nhận được OTP [mã đơn]`. Có thể ghép mã trong mô tả thuê số với bảng thuê số để lấy năm mua; cả 10 đơn chi tiết của tài khoản kiểm tra có giao dịch ngày đầy đủ tương ứng. 80 mã thuê cũ chỉ còn trong giao dịch, không thể suy ra số/OTP hoặc thành công chỉ từ khoản trừ tiền.

## Bằng chứng và giới hạn

REA CLI 6.4.0 quan sát trình duyệt do tác vụ tạo, qua CDP cục bộ; các lần quan sát giữ metadata mạng/script và kiểu dữ liệu, không giữ cookie, mật khẩu, giá trị storage hoặc nội dung phản hồi tài khoản:

- Đăng nhập: `ev_c1dc184e2659c1c17b021cb830bdbb0ba6ea89266687c26e0210203be069e031`.
- Hồ sơ: `ev_54a5f7af50e8877099e3f73cac3d0214a92c0f3119d632b16eb97115b63e2e00`.
- Lịch sử: `ev_3f5dd5cf8465c42674c27d06fbe1dfcee894672898ba88eec5e3633bcaf6dcbf`.

Mỗi lần quan sát chỉ bao phủ thời gian sau khi gắn REA, không chứng minh các request trước đó. Các trường biểu mẫu, cấu trúc HTML và kết quả đăng nhập từ connector được xác minh bổ sung bằng Playwright/HTTP; những kiểm tra này không phải bằng chứng do REA tạo. Không đưa HTML tài khoản, cookie, token hoặc ảnh chứa thông tin xác thực vào báo cáo này.

## Lựa chọn triển khai

Ứng dụng dùng API được tài liệu hóa để mua số/lấy OTP và một connector phiên web để đọc tài khoản. Phiên web mã hóa trong cookie HttpOnly, ràng buộc với dấu vân tay token; mật khẩu không được lưu. Không có cơ chế tạo tài khoản hoặc ví tiền riêng của ứng dụng.

Cấu trúc trang có thể thay đổi. Thiếu số dư được trả `null`; bảng không đọc được được trả `null` kèm cảnh báo; không thay bằng số 0 hoặc lịch sử rỗng. Lỗi đồng bộ tạm thời giữ lần cập nhật trước kèm thông báo, còn hết phiên yêu cầu đăng nhập lại. Có kiểm thử HTML giả lập và kiểm tra trực tiếp chỉ đọc bằng tài khoản được cho phép.

Lịch sử chung tải tiến dần các trang được nhà cung cấp quảng bá, gộp theo mã đơn với dữ liệu cục bộ, không sao chép đơn từ tài khoản khác hoặc chế độ demo. Mô tả thuê/hoàn tiền chỉ được nhận bằng các mẫu đã xác minh ở trên; số tiền không rõ giữ `null`, không suy đoán mạng từ giá. Lịch sử chỉ còn giao dịch được đánh dấu rõ và không tự kiểm tra OTP. Dữ liệu không có năm không được tự gán năm hiện tại; thống kê toàn thời gian vẫn tính đơn nhưng biểu đồ ngày bỏ các đơn chưa xác định thời điểm.
