# Chrome Extension: Trợ Lý Điền Sao Kê Vào Sổ Thu Chi MISA

Extension tự động đọc file sao kê ngân hàng (PDF từ Techcombank, Vietcombank, MBBank...) và **tự động điền hàng loạt** vào form ghi chép của [Sổ Thu Chi MISA Web](https://moneykeeperapp.misa.vn/management/add-transaction).

---

## 🚀 Tính Năng Chính

1. **Đọc và bóc tách PDF ngân hàng 100% tại trình duyệt**:
   - Sử dụng thư viện Mozilla PDF.js tích hợp sẵn, xử lý trực tiếp trên máy người dùng, an toàn và bảo mật thông tin tài chính tuyệt đối.
2. **Tự động nhận diện dòng tiền**:
   - Tách biệt **Thu** (Tiền vào) và **Chi** (Tiền ra).
   - Tự động gợi ý **Hạng mục chi tiêu trên MISA** (*Ăn uống, Nhà cửa, Lương, Trả nợ, Tiêu vặt, Tiết kiệm, Ví điện tử, Xăng xe...*).
   - Tạo ghi chú ngắn gọn từ nội dung chuyển khoản và người nhận/người gửi.
3. **Lựa chọn giao dịch linh hoạt**:
   - Danh sách giao dịch hiển thị kèm checkbox để bạn chủ động chọn chỉ ghi chép những khoản cần thiết.
   - Cho phép chỉnh sửa nhanh Hạng mục hoặc Ghi chú trước khi điền.
4. **Tự động điền (Auto-fill) thông minh vào MISA**:
   - Tự động nhận diện số dòng hiện có trên bảng MISA và tự bấm **"Thêm dòng"** khi cần.
   - Điền tự động: **Số tiền**, **Thời gian (ngày)**, **Diễn giải**, và **Hạng mục** (tự chuyển đúng tab Thu tiền / Chi tiền).
   - Tô màu xanh lá các dòng đã điền để bạn dễ đối chiếu.

---

## 📥 Hướng Dẫn Cài Đặt Vào Google Chrome (Chỉ mất 30 giây)

1. Mở trình duyệt Google Chrome (hoặc Edge / Brave / Cốc Cốc).
2. Nhập vào thanh địa chỉ:
   ```text
   chrome://extensions
   ```
3. Ở góc trên bên phải màn hình, bật công tắc **Chế độ dành cho nhà phát triển (Developer mode)**.
4. Bấm vào nút **Tải tiện ích đã giải nén (Load unpacked)** ở góc trên bên trái.
5. Chọn thư mục:
   ```text
   /home/nvlam_local/Documents/extract-transaction/misa-bank-extension
   ```
6. Tiện ích **"Trợ Lý Điền Sao Kê Ngân Hàng - Sổ Thu Chi MISA"** sẽ xuất hiện trên thanh công cụ của Chrome!

---

## 🎯 Hướng Dẫn Sử Dụng

### Cách 1: Sử dụng trực tiếp nút trợ lý trên trang MISA (Khuyên dùng)

1. Truy cập vào trang ghi chép của MISA:
   👉 **[https://moneykeeperapp.misa.vn/management/add-transaction](https://moneykeeperapp.misa.vn/management/add-transaction)**
2. Nhìn góc dưới bên phải màn hình, bạn sẽ thấy nút nổi màu xanh:  
   👉 **"⚡ Nhập từ Sao kê Ngân hàng"**.
3. Bấm vào nút, bảng điều khiển bên phải sẽ trượt ra:
   - Kéo thả file PDF sao kê (ví dụ file `3812554a-cb5e-42db-bf9f-5d9fc341d357.pdf`) vào khung hoặc bấm nút **"Dùng thử dữ liệu mẫu"**.
   - Bảng giao dịch sẽ hiện ra với đầy đủ Ngày, Số tiền, Thu/Chi, Hạng mục gợi ý và Ghi chú.
   - Tích chọn các giao dịch bạn muốn ghi vào sổ.
4. Bấm nút: **"⚡ Tự động điền [N] giao dịch vào MISA"**.
5. Tiện ích sẽ tự động thêm dòng và điền từng giao dịch vào bảng MISA. Bạn kiểm tra lại và bấm **"Lưu"** của MISA là hoàn tất!

---

### Cách 2: Sử dụng qua Popup trên thanh công cụ Chrome

1. Bấm vào icon của Extension trên thanh công cụ tiện ích của Chrome.
2. Nạp file PDF sao kê hoặc bấm dùng thử dữ liệu mẫu.
3. Chọn các giao dịch cần ghi.
4. Bấm **"⚡ Tự động điền vào MISA"** (Extension sẽ gửi dữ liệu sang tab MISA đang mở và tự động điền).
