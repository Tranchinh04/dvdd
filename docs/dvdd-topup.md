# Nạp tiền DVDD

Quan sát HTTP chỉ đọc ngày 26/10/2026 bằng tài khoản đã được người dùng cho phép. Không chuyển tiền, tạo giao dịch nạp, mua số hoặc thay đổi tài khoản nhà cung cấp.

## Nguồn và kiểm tra

- Trang được đọc là `https://dvdd.casa/dashboard?page=transactions-add`, bằng cookie PHPSESSID của phiên đăng nhập đã xác minh. Trang có tên ngân hàng, chủ tài khoản, số tài khoản và nội dung chuyển khoản, không có biểu mẫu tạo đơn nạp.
- Ghi chú quan sát: tối thiểu 20K, có thể cộng ngay hoặc chậm 3–5 phút. Ứng dụng đọc các giá trị từ trang, không cố định chúng trong giao diện.
- `img#currentPhoto` chứa QR đầy đủ qua tham số `text` của `https://quickchart.io/qr`; QR tĩnh `qrCodeImage` không có sẵn nội dung nên không dùng.
- Payload quan sát là EMV TLV ASCII, ngân hàng MB/BIN 970422, định danh NAPAS A000000727, dịch vụ QRIBFTTA, tiền tệ 704, quốc gia VN, không có trường số tiền 54. Các trường 38.01.01 (tài khoản), 59 (người nhận), 62.08 (nội dung) khớp nguyên văn với hướng dẫn trên trang. BIN MB đối chiếu danh sách ngân hàng của VietQR tại `https://api.vietqr.io/v2/banks`.
- Máy chủ kiểm tra độ dài TLV, trùng trường, CRC16 và các trường thanh toán trước khi tạo PNG từ nguyên payload. Không gọi QuickChart để tải ảnh, không sửa nội dung QR, không có endpoint nhận địa chỉ tùy ý hoặc thực hiện chuyển khoản.

## Phạm vi xác nhận

Ba API được cung cấp chưa có API nạp/xác nhận thanh toán. Giao diện hiển thị số dư và các dòng giao dịch đúng như DVDD trả về. Không gán một khoản tăng số dư thành giao dịch nạp vừa thực hiện, không suy ra dấu tiền từ số tiền không có dấu, không báo thành công dựa vào nút “Tôi đã chuyển”.

Màn nạp yêu cầu phiên đăng nhập web, tách dữ liệu theo tài khoản, hủy yêu cầu khi rời màn/đăng xuất, không lưu dữ liệu nạp trong trình duyệt. QR được tải lại sau 5 phút khi trang hiển thị, ẩn nếu xác minh lại thất bại. Demo và kết nối chỉ bằng API token không lấy QR.

Kiểm thử dùng tài khoản/ngân hàng giả lập; QR PNG được giải mã bằng một thư viện độc lập để đối chiếu với payload nguồn. Kiểm tra trực tiếp chỉ đọc không xác minh giao dịch chuyển tiền thật hoặc bảo đảm thời gian DVDD cộng tiền.

Kiểm tra bản production tại máy ngày 26/10/2026: đăng nhập tài khoản được cho phép, `GET /api/topup` trả HTTP 200 với tài khoản khớp kết nối. Giải mã PNG trả về cho kết quả khớp số tài khoản, người nhận và nội dung nạp; mức tối thiểu 20.000đ, không có số tiền cố định trong QR. Phản hồi có `Cache-Control: no-store, private`. Sau kiểm tra đã đăng xuất phiên ứng dụng; không lưu giá trị ngân hàng/nội dung nạp thật vào hồ sơ kiểm thử.
