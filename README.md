# Bộ Công Cụ Trích Xuất Sao Kê Ngân Hàng & Tự Động Điền Sổ Thu Chi

Dự án cung cấp giải pháp toàn diện để trích xuất sao kê ngân hàng (PDF) và ghi chép vào sổ thu chi, đặc biệt hỗ trợ **Chrome Extension tự động điền trực tiếp vào ứng dụng web Sổ Thu Chi MISA**: [https://moneykeeperapp.misa.vn/management/add-transaction](https://moneykeeperapp.misa.vn/management/add-transaction).

---

## 🌟 1. Chrome Extension: Tự Động Điền Vào Sổ Thu Chi MISA (Khuyên Dùng)

Thư mục: [**`misa-bank-extension/`**](file:///home/nvlam_local/Documents/extract-transaction/misa-bank-extension/)

- **Cài đặt vào Chrome:** Vào `chrome://extensions` -> Bật *Developer mode* -> Bấm *Load unpacked* -> Chọn thư mục `misa-bank-extension`.
- **Trải nghiệm:** Mở trang [MISA Add Transaction](https://moneykeeperapp.misa.vn/management/add-transaction), bấm nút **"⚡ Nhập từ Sao kê Ngân hàng"** ở góc dưới phải, kéo thả PDF sao kê, chọn các giao dịch muốn lưu và bấm **"Tự động điền"**!
- Xem hướng dẫn chi tiết tại: [misa-bank-extension/README.md](file:///home/nvlam_local/Documents/extract-transaction/misa-bank-extension/README.md).

---

## 💻 2. Công Cụ Dòng Lệnh (CLI) & Xuất File (Excel, CSV, JSON, HTML)

1. **Trích xuất chính xác 100% dữ liệu giao dịch**:
   - Tự động ghép nối các giao dịch bị ngắt trang giữa các trang PDF.
   - Trích xuất thông tin tài khoản: Chủ tài khoản, Số tài khoản, Kỳ sao kê, Số dư đầu kỳ, Số dư cuối kỳ.
   - Tự động nhận diện tên đối tác chuyển khoản từ nội dung giao dịch khi cột đối tác bị để trống.

2. **Phân loại giao dịch thông minh (Smart Categorization)**:
   - Tự động phân loại dòng tiền thành **Thu** (Tiền vào) và **Chi** (Tiền ra).
   - Gắn danh mục thu chi chuẩn:
     - 💼 *Lương & Thu nhập chính*
     - 📈 *Tiết kiệm & Đầu tư* / *Tiền lãi & Lợi nhuận*
     - 💳 *Trả nợ & Vay mượn* (Thẻ tín dụng, nợ ngân hàng, trả tiền)
     - 🍜 *Ăn uống*
     - 🏠 *Nhà cửa & Thuê phòng*
     - 👨‍👩‍👧 *Gia đình & Tiêu vặt*
     - ⛽ *Xăng xe & Đi lại*
     - 📱 *Ví điện tử & Nạp tiền* (MoMo, ZaloPay,...)
   - Tự động tạo ghi chú ngắn gọn phục vụ ghi sổ thu chi.

3. **Xuất đa định dạng (Export Formats)**:
   - **Excel (.xlsx)**: File mẫu Sổ Thu Chi được tạo sẵn bảng màu (Xanh lá cho Thu, Đỏ cam cho Chi), thẻ KPI tóm tắt số dư, và sheet tổng hợp thu chi theo từng danh mục.
   - **CSV (UTF-8 with BOM)**: Tương thích hoàn toàn với Microsoft Excel, Google Sheets, Notion mà không bị lỗi font tiếng Việt.
   - **HTML Dashboard**: Giao diện web tương tác trực quan ngay trên trình duyệt (có bộ lọc tìm kiếm, lọc Thu/Chi, lọc theo Danh mục).
   - **JSON**: Dành cho tích hợp tự động hóa, API hoặc phần mềm kế toán.

---

## 📦 Cài Đặt Thư Viện

Yêu cầu môi trường Python 3.8+:

```bash
pip install -r requirements.txt
```

---

## 🛠️ Hướng Dẫn Sử Dụng

### 1. Chạy lệnh trích xuất cơ bản

```bash
python3 extract_transactions.py 3812554a-cb5e-42db-bf9f-5d9fc341d357.pdf
```

Lệnh trên sẽ in báo cáo tổng quan ra terminal và tự động tạo cả 4 file trong thư mục hiện tại:
- `so_thu_chi_<STK>.xlsx`: Sổ thu chi trên Excel.
- `so_thu_chi_<STK>.csv`: File CSV để import.
- `so_thu_chi_<STK>.html`: Giao diện web xem báo cáo.
- `so_thu_chi_<STK>.json`: Dữ liệu JSON có cấu trúc.

### 2. Các tùy chọn dòng lệnh nâng cao

```bash
# Chỉ xuất file Excel
python3 extract_transactions.py 3812554a-cb5e-42db-bf9f-5d9fc341d357.pdf --format xlsx

# Chỉ xuất CSV và Excel
python3 extract_transactions.py 3812554a-cb5e-42db-bf9f-5d9fc341d357.pdf --format xlsx,csv

# Lưu kết quả vào thư mục riêng
python3 extract_transactions.py 3812554a-cb5e-42db-bf9f-5d9fc341d357.pdf --output-dir ./ket_qua

# Đặt tên tiền tố cho file
python3 extract_transactions.py 3812554a-cb5e-42db-bf9f-5d9fc341d357.pdf --prefix thang_11_2026

# Chạy ở chế độ im lặng (không in danh sách giao dịch ra terminal)
python3 extract_transactions.py 3812554a-cb5e-42db-bf9f-5d9fc341d357.pdf --quiet
```

---

## 📂 Cấu Trúc Dự Án

```
extract-transaction/
├── extract_transactions.py       # File chạy chính (CLI)
├── requirements.txt              # Danh sách thư viện (pdfplumber, openpyxl)
├── README.md                     # Tài liệu hướng dẫn sử dụng
├── core/
│   ├── models.py                 # Định nghĩa mô hình dữ liệu (Transaction, Summary)
│   ├── classifier.py             # Bộ quy tắc phân loại thu chi thông minh
│   ├── parsers/
│   │   ├── base.py               # Interface parser chuẩn
│   │   ├── techcombank.py        # Bộ xử lý bóc tách sao kê Techcombank
│   │   └── __init__.py           # Registry tự động chọn parser
│   └── exporters/
│       ├── excel.py              # Xuất bảng tính Excel chuyên nghiệp
│       ├── csv_exporter.py       # Xuất file CSV chuẩn UTF-8
│       ├── json_exporter.py      # Xuất JSON
│       ├── html_exporter.py      # Xuất giao diện Web tương tác
│       └── __init__.py
└── output files (*.xlsx, *.csv, *.json, *.html)
```

---

## ⚙️ Tùy Biến Thêm Quy Tắc Phân Loại

Để thêm từ khóa hoặc danh mục chi tiêu riêng của bạn, chỉ cần mở file [core/classifier.py](file:///home/nvlam_local/Documents/extract-transaction/core/classifier.py) và bổ sung vào danh sách `EXPENSE_RULES` hoặc `INCOME_RULES`.
