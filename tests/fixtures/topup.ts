// Deliberately fictitious payment details. CRC independently checked with
// Python's binascii.crc_hqx(..., 0xffff); never used against the supplier.
export const topupPayload =
  "00020101021138560010A0000007270126000697042201120123456789010208QRIBFTTA5204000053037045802VN5914NGUOI NHAN THU62160812NAPFIXTURE016304F5BB";
export function topupHtml(payload = topupPayload) {
  return `<h2>Nạp tiền tài khoản</h2>
  <h5>TK Ngân hàng: NGUOI NHAN THU - 012345678901 - NGÂN HÀNG QUÂN ĐỘI (MB Bank)<button>Sao chép</button></h5>
  <h5>Nội dung CK: NAPFIXTURE01<button>Sao chép</button></h5>
  <p>* Lưu ý nạp tối thiểu 20K - Nạp tiền có thể vào ngay hoặc chậm 3-5 phút</p>
  <img id="currentPhoto" src="https://quickchart.io/qr?text=${encodeURIComponent(payload)}&amp;size=200">
  <img id="qrCodeImage" src="public/images/bank/qr_bank_mb.jpg">`;
}
