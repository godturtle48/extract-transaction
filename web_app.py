"""
Lightweight Web Interface for Bank Statement Bookkeeping.
Runs with Python standard library (http.server) - no external web frameworks required!
Usage:
    python3 web_app.py [--port 8080]
"""

import sys
import os
import json
import io
import tempfile
import urllib.parse
from http.server import HTTPServer, BaseHTTPRequestHandler
from email.message import EmailMessage

from core.parsers import get_parser
from core.exporters import ExcelExporter, CSVExporter
from core.models import StatementSummary

PORT = 8080
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
LATEST_SUMMARY = None

HTML_PAGE = """<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Trợ Lý Bóc Tách Sao Kê Ngân Hàng - Sổ Thu Chi</title>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <style>
        :root {
            --primary: #3b82f6;
            --primary-dark: #1d4ed8;
            --bg: #f8fafc;
            --card: #ffffff;
            --text: #0f172a;
            --muted: #64748b;
            --border: #e2e8f0;
            --green: #10b981;
            --green-light: #ecfdf5;
            --red: #ef4444;
            --red-light: #fef2f2;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Plus Jakarta Sans', -apple-system, sans-serif;
            background: var(--bg);
            color: var(--text);
            padding: 30px 20px;
        }
        .container { max-width: 1240px; margin: 0 auto; }
        .hero {
            text-align: center;
            margin-bottom: 30px;
        }
        .hero h1 { font-size: 28px; font-weight: 800; color: #1e3a8a; margin-bottom: 8px; }
        .hero p { color: var(--muted); font-size: 15px; }

        .upload-card {
            background: var(--card);
            border: 2px dashed #cbd5e1;
            border-radius: 16px;
            padding: 36px 20px;
            text-align: center;
            cursor: pointer;
            transition: all 0.2s ease;
            margin-bottom: 24px;
        }
        .upload-card:hover, .upload-card.dragover {
            border-color: var(--primary);
            background: #eff6ff;
        }
        .upload-icon { font-size: 40px; margin-bottom: 12px; }
        .upload-title { font-size: 16px; font-weight: 600; margin-bottom: 6px; }
        .upload-hint { font-size: 13px; color: var(--muted); }
        .btn-sample {
            margin-top: 14px;
            display: inline-block;
            background: white;
            border: 1px solid #cbd5e1;
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            color: #334155;
            cursor: pointer;
            transition: all 0.2s;
        }
        .btn-sample:hover { background: #f1f5f9; border-color: #94a3b8; }

        .kpi-row {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
        }
        .kpi-card {
            background: var(--card);
            padding: 20px;
            border-radius: 14px;
            border: 1px solid var(--border);
            box-shadow: 0 1px 3px rgba(0,0,0,0.03);
        }
        .kpi-label { font-size: 12px; font-weight: 600; color: var(--muted); text-transform: uppercase; margin-bottom: 6px; }
        .kpi-value { font-size: 22px; font-weight: 700; }
        .text-green { color: var(--green); }
        .text-red { color: var(--red); }
        .text-blue { color: var(--primary); }

        .charts-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 24px;
        }
        @media (max-width: 850px) { .charts-row { grid-template-columns: 1fr; } }
        .chart-box {
            background: var(--card);
            border-radius: 14px;
            border: 1px solid var(--border);
            padding: 20px;
        }
        .chart-title { font-size: 15px; font-weight: 700; margin-bottom: 16px; color: #1e293b; }

        .panel {
            background: var(--card);
            border-radius: 14px;
            border: 1px solid var(--border);
            padding: 24px;
        }
        .panel-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 12px;
            margin-bottom: 20px;
        }
        .export-actions { display: flex; gap: 10px; }
        .btn-export {
            padding: 8px 16px;
            border-radius: 8px;
            font-size: 13px;
            font-weight: 600;
            text-decoration: none;
            cursor: pointer;
            border: none;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            transition: all 0.2s;
        }
        .btn-excel { background: #059669; color: white; }
        .btn-excel:hover { background: #047857; }
        .btn-csv { background: #0284c7; color: white; }
        .btn-csv:hover { background: #0369a1; }

        .filters {
            display: flex;
            gap: 12px;
            flex-wrap: wrap;
            margin-bottom: 16px;
        }
        .search-box {
            flex: 1;
            min-width: 250px;
            padding: 8px 14px;
            border: 1px solid var(--border);
            border-radius: 8px;
            font-size: 14px;
            outline: none;
        }
        .search-box:focus { border-color: var(--primary); }
        .select-filter {
            padding: 8px 12px;
            border: 1px solid var(--border);
            border-radius: 8px;
            font-size: 14px;
            outline: none;
            background: white;
        }

        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th {
            background: #f8fafc;
            color: var(--muted);
            text-align: left;
            padding: 12px 14px;
            font-weight: 600;
            border-bottom: 1px solid var(--border);
        }
        td { padding: 12px 14px; border-bottom: 1px solid var(--border); }
        tr:hover td { background: #f8fafc; }
        .badge {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 11px;
        }
        .badge-income { background: var(--green-light); color: var(--green); }
        .badge-expense { background: var(--red-light); color: var(--red); }
        .badge-cat { background: #eff6ff; color: #1d4ed8; }
        .text-right { text-align: right; }
        .text-center { text-align: center; }
        .amount { font-weight: 700; }
        .loading { display: none; text-align: center; padding: 30px; font-weight: 600; color: var(--primary); }
    </style>
</head>
<body>
<div class="container">
    <div class="hero">
        <h1>SỔ THU CHI THÔNG MINH TỪ SAO KÊ NGÂN HÀNG</h1>
        <p>Tự động đọc PDF sao kê Techcombank & các ngân hàng, bóc tách dòng tiền và phân loại danh mục thu chi.</p>
    </div>

    <!-- Upload Zone -->
    <div class="upload-card" id="dropZone" onclick="document.getElementById('fileInput').click()">
        <input type="file" id="fileInput" accept=".pdf" style="display: none;" onchange="handleFileSelect(this.files[0])">
        <div class="upload-icon">📄</div>
        <div class="upload-title">Kéo & thả file PDF sao kê vào đây hoặc bấm để chọn file</div>
        <div class="upload-hint">Hỗ trợ file sao kê định dạng PDF từ Techcombank và các ngân hàng</div>
        <button type="button" class="btn-sample" onclick="event.stopPropagation(); loadSample();">
            ⚡ Phân tích nhanh file mẫu 3812554a...pdf
        </button>
    </div>

    <div id="loading" class="loading">⏳ Đang phân tích sao kê ngân hàng...</div>

    <div id="resultContent" style="display: none;">
        <!-- KPI Row -->
        <div class="kpi-row">
            <div class="kpi-card">
                <div class="kpi-label">Số dư đầu kỳ</div>
                <div class="kpi-value text-blue" id="kpiOpening">0 đ</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Tổng thu nhập (+)</div>
                <div class="kpi-value text-green" id="kpiIncome">+0 đ</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Tổng chi tiêu (-)</div>
                <div class="kpi-value text-red" id="kpiExpense">-0 đ</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Chênh lệch ròng</div>
                <div class="kpi-value" id="kpiNet">0 đ</div>
            </div>
            <div class="kpi-card">
                <div class="kpi-label">Số dư cuối kỳ</div>
                <div class="kpi-value" id="kpiEnding">0 đ</div>
            </div>
        </div>

        <!-- Charts Row -->
        <div class="charts-row">
            <div class="chart-box">
                <div class="chart-title">📊 Cơ Cấu Chi Tiêu Theo Danh Mục</div>
                <div style="max-height: 250px; position: relative;">
                    <canvas id="expenseChart"></canvas>
                </div>
            </div>
            <div class="chart-box">
                <div class="chart-title">🏦 Thông Tin Tài Khoản & Kỳ Sao Kê</div>
                <div id="accountDetails" style="font-size: 14px; line-height: 2;"></div>
            </div>
        </div>

        <!-- Table Panel -->
        <div class="panel">
            <div class="panel-header">
                <div>
                    <h2 style="font-size: 18px; font-weight: 700;">Danh Sách Giao Dịch Ghi Sổ</h2>
                    <span id="txCount" style="font-size: 13px; color: var(--muted);">0 giao dịch</span>
                </div>
                <div class="export-actions">
                    <a href="/api/download/excel" class="btn-export btn-excel">📥 Xuất File Excel (.xlsx)</a>
                    <a href="/api/download/csv" class="btn-export btn-csv">📥 Xuất File CSV</a>
                </div>
            </div>

            <div class="filters">
                <input type="text" id="searchBox" class="search-box" placeholder="🔍 Tìm kiếm giao dịch, người gửi/nhận, nội dung...">
                <select id="typeFilter" class="select-filter">
                    <option value="all">Tất cả (Thu & Chi)</option>
                    <option value="Thu">Chỉ tiền Thu (+)</option>
                    <option value="Chi">Chỉ tiền Chi (-)</option>
                </select>
                <select id="catFilter" class="select-filter">
                    <option value="all">Tất cả danh mục</option>
                </select>
            </div>

            <div style="overflow-x: auto;">
                <table>
                    <thead>
                        <tr>
                            <th class="text-center" style="width: 45px;">STT</th>
                            <th style="width: 95px;">Ngày</th>
                            <th style="width: 70px;">Loại</th>
                            <th class="text-right" style="width: 130px;">Số tiền</th>
                            <th style="width: 160px;">Danh mục</th>
                            <th style="width: 220px;">Ghi chú / Đối tác</th>
                            <th>Nội dung chuyển khoản</th>
                            <th class="text-right" style="width: 130px;">Số dư sau GD</th>
                        </tr>
                    </thead>
                    <tbody id="txBody"></tbody>
                </table>
            </div>
        </div>
    </div>
</div>

<script>
    let currentData = null;
    let expenseChartInstance = null;

    function formatVND(n) {
        return new Intl.NumberFormat('vi-VN').format(n) + ' đ';
    }

    const dropZone = document.getElementById('dropZone');
    ['dragenter', 'dragover'].forEach(name => {
        dropZone.addEventListener(name, (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
    });
    ['dragleave', 'drop'].forEach(name => {
        dropZone.addEventListener(name, (e) => { e.preventDefault(); dropZone.classList.remove('dragover'); });
    });
    dropZone.addEventListener('drop', (e) => {
        const files = e.dataTransfer.files;
        if (files.length > 0) handleFileSelect(files[0]);
    });

    function showLoading(show) {
        document.getElementById('loading').style.display = show ? 'block' : 'none';
        if (show) document.getElementById('resultContent').style.display = 'none';
    }

    async function loadSample() {
        showLoading(true);
        try {
            const res = await fetch('/api/parse_sample');
            const data = await res.json();
            currentData = data;
            renderResults(data);
        } catch (err) {
            alert('Lỗi: ' + err.message);
        } finally {
            showLoading(false);
        }
    }

    async function handleFileSelect(file) {
        if (!file || !file.name.toLowerCase().endsWith('.pdf')) {
            alert('Vui lòng chọn file định dạng PDF!');
            return;
        }
        showLoading(true);
        const formData = new FormData();
        formData.append('file', file);
        try {
            const res = await fetch('/api/upload', { method: 'POST', body: formData });
            const data = await res.json();
            if (data.error) {
                alert('Lỗi phân tích: ' + data.error);
                return;
            }
            currentData = data;
            renderResults(data);
        } catch (err) {
            alert('Lỗi khi tải file: ' + err.message);
        } finally {
            showLoading(false);
        }
    }

    function renderResults(data) {
        document.getElementById('resultContent').style.display = 'block';
        
        // KPIs
        const s = data.summary;
        document.getElementById('kpiOpening').textContent = formatVND(s.opening_balance);
        document.getElementById('kpiIncome').textContent = '+' + formatVND(s.total_income);
        document.getElementById('kpiExpense').textContent = '-' + formatVND(s.total_expense);
        
        const netEl = document.getElementById('kpiNet');
        netEl.textContent = (s.net_cash_flow >= 0 ? '+' : '') + formatVND(s.net_cash_flow);
        netEl.className = 'kpi-value ' + (s.net_cash_flow >= 0 ? 'text-green' : 'text-red');
        
        document.getElementById('kpiEnding').textContent = formatVND(s.ending_balance);

        // Account Details
        const acc = data.account_info;
        document.getElementById('accountDetails').innerHTML = `
            <div><strong>Ngân hàng:</strong> ${acc.bank || 'Techcombank'}</div>
            <div><strong>Chủ tài khoản:</strong> ${acc.customer_name || 'N/A'}</div>
            <div><strong>Số tài khoản:</strong> <span style="font-family: monospace; font-size: 15px; font-weight: 700;">${acc.account_number || 'N/A'}</span></div>
            <div><strong>Kỳ sao kê:</strong> ${acc.period || 'N/A'}</div>
            <div><strong>Loại tiền tệ:</strong> ${acc.currency || 'VND'}</div>
        `;

        // Populate Category Filter
        const catSelect = document.getElementById('catFilter');
        catSelect.innerHTML = '<option value="all">Tất cả danh mục</option>';
        Object.keys(data.category_summary).forEach(cat => {
            const opt = document.createElement('option');
            opt.value = cat;
            opt.textContent = `${cat} (${data.category_summary[cat].count})`;
            catSelect.appendChild(opt);
        });

        renderChart(data.category_summary);
        renderTable();
    }

    function renderChart(catSummary) {
        const labels = [];
        const values = [];
        const colors = [
            '#ef4444', '#f97316', '#f59e0b', '#10b981', '#06b6d4',
            '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#64748b'
        ];

        Object.entries(catSummary).forEach(([cat, d]) => {
            if (d.expense > 0) {
                labels.push(cat);
                values.push(d.expense);
            }
        });

        const ctx = document.getElementById('expenseChart').getContext('2d');
        if (expenseChartInstance) expenseChartInstance.destroy();

        expenseChartInstance = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: colors.slice(0, labels.length)
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } },
                    tooltip: {
                        callbacks: {
                            label: (ctx) => `${ctx.label}: ${formatVND(ctx.raw)}`
                        }
                    }
                }
            }
        });
    }

    function renderTable() {
        if (!currentData) return;
        const query = document.getElementById('searchBox').value.toLowerCase();
        const typeFilter = document.getElementById('typeFilter').value;
        const catFilter = document.getElementById('catFilter').value;
        const tbody = document.getElementById('txBody');
        tbody.innerHTML = '';

        const filtered = currentData.transactions.filter(t => {
            if (typeFilter !== 'all' && t.loai !== typeFilter) return false;
            if (catFilter !== 'all' && t.danh_muc !== catFilter) return false;
            if (query) {
                const combined = `${t.ngay} ${t.danh_muc} ${t.doi_tac} ${t.dien_giai} ${t.ghi_chu}`.toLowerCase();
                if (!combined.includes(query)) return false;
            }
            return true;
        });

        document.getElementById('txCount').textContent = `${filtered.length} giao dịch`;

        filtered.forEach(t => {
            const tr = document.createElement('tr');
            const isThu = t.loai === 'Thu';
            tr.innerHTML = `
                <td class="text-center">${t.stt}</td>
                <td>${t.ngay}</td>
                <td><span class="badge ${isThu ? 'badge-income' : 'badge-expense'}">${t.loai}</span></td>
                <td class="text-right amount ${isThu ? 'text-green' : 'text-red'}">${isThu ? '+' : '-'}${formatVND(t.so_tien)}</td>
                <td><span class="badge badge-cat">${t.danh_muc}</span></td>
                <td>
                    <strong>${t.ghi_chu || ''}</strong>
                    ${t.doi_tac ? `<div style="font-size: 11px; color: var(--muted); margin-top: 2px;">${t.doi_tac}</div>` : ''}
                </td>
                <td style="color: #334155;">${t.dien_giai}</td>
                <td class="text-right amount">${formatVND(t.so_du)}</td>
            `;
            tbody.appendChild(tr);
        });
    }

    document.getElementById('searchBox').addEventListener('input', renderTable);
    document.getElementById('typeFilter').addEventListener('change', renderTable);
    document.getElementById('catFilter').addEventListener('change', renderTable);

    // Auto load sample on first visit
    window.addEventListener('DOMContentLoaded', loadSample);
</script>
</body>
</html>
"""

class RequestHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        global LATEST_SUMMARY
        parsed_url = urllib.parse.urlparse(self.path)
        path = parsed_url.path

        if path == "/" or path == "/index.html":
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(HTML_PAGE.encode("utf-8"))
            return

        if path == "/api/parse_sample":
            sample_pdf = os.path.join(CURRENT_DIR, "3812554a-cb5e-42db-bf9f-5d9fc341d357.pdf")
            if not os.path.exists(sample_pdf):
                self._send_json({"error": "Không tìm thấy file mẫu"}, 404)
                return
            parser = get_parser(sample_pdf)
            summary = parser.parse(sample_pdf)
            LATEST_SUMMARY = summary
            self._send_json(self._summary_to_dict(summary))
            return

        if path == "/api/download/excel":
            if not LATEST_SUMMARY:
                sample_pdf = os.path.join(CURRENT_DIR, "3812554a-cb5e-42db-bf9f-5d9fc341d357.pdf")
                if os.path.exists(sample_pdf):
                    LATEST_SUMMARY = get_parser(sample_pdf).parse(sample_pdf)
            if not LATEST_SUMMARY:
                self.send_error(404, "Chưa có dữ liệu để xuất")
                return

            with tempfile.NamedTemporaryFile(suffix=".xlsx", delete=False) as tmp:
                tmp_path = tmp.name
            ExcelExporter.export(LATEST_SUMMARY, tmp_path)
            with open(tmp_path, "rb") as f:
                content = f.read()
            os.remove(tmp_path)

            filename = f"so_thu_chi_{LATEST_SUMMARY.account.account_number or 'bank'}.xlsx"
            self.send_response(200)
            self.send_header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
            self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
            return

        if path == "/api/download/csv":
            if not LATEST_SUMMARY:
                sample_pdf = os.path.join(CURRENT_DIR, "3812554a-cb5e-42db-bf9f-5d9fc341d357.pdf")
                if os.path.exists(sample_pdf):
                    LATEST_SUMMARY = get_parser(sample_pdf).parse(sample_pdf)
            if not LATEST_SUMMARY:
                self.send_error(404, "Chưa có dữ liệu để xuất")
                return

            with tempfile.NamedTemporaryFile(suffix=".csv", delete=False) as tmp:
                tmp_path = tmp.name
            CSVExporter.export(LATEST_SUMMARY, tmp_path)
            with open(tmp_path, "rb") as f:
                content = f.read()
            os.remove(tmp_path)

            filename = f"so_thu_chi_{LATEST_SUMMARY.account.account_number or 'bank'}.csv"
            self.send_response(200)
            self.send_header("Content-Type", "text/csv; charset=utf-8")
            self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
            return

        self.send_error(404, "Not Found")

    def do_POST(self):
        global LATEST_SUMMARY
        parsed_url = urllib.parse.urlparse(self.path)
        if parsed_url.path == "/api/upload":
            content_type = self.headers.get("Content-Type", "")
            if "multipart/form-data" not in content_type:
                self._send_json({"error": "Content-Type must be multipart/form-data"}, 400)
                return

            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)

            # Parse multipart body
            boundary = content_type.split("boundary=")[1].encode()
            parts = body.split(b"--" + boundary)
            file_bytes = None

            for part in parts:
                if b'filename="' in part:
                    header_part, content_part = part.split(b"\r\n\r\n", 1)
                    file_bytes = content_part.rstrip(b"\r\n--")
                    break

            if not file_bytes:
                self._send_json({"error": "Không tìm thấy nội dung file PDF"}, 400)
                return

            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                tmp.write(file_bytes)
                tmp_path = tmp.name

            try:
                parser = get_parser(tmp_path)
                summary = parser.parse(tmp_path)
                LATEST_SUMMARY = summary
                self._send_json(self._summary_to_dict(summary))
            except Exception as e:
                self._send_json({"error": f"Lỗi phân tích file PDF: {str(e)}"}, 500)
            finally:
                if os.path.exists(tmp_path):
                    os.remove(tmp_path)
            return

        self.send_error(404, "Not Found")

    def _send_json(self, data: dict, status: int = 200):
        content = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(content)))
        self.end_headers()
        self.wfile.write(content)

    def _summary_to_dict(self, summary: StatementSummary) -> dict:
        return {
            "account_info": {
                "bank": summary.account.bank_name,
                "customer_name": summary.account.account_name,
                "account_number": summary.account.account_number,
                "customer_id": summary.account.customer_id,
                "currency": summary.account.currency,
                "period": f"{summary.account.start_date} - {summary.account.end_date}"
            },
            "summary": {
                "opening_balance": summary.opening_balance,
                "ending_balance": summary.ending_balance,
                "total_income": summary.total_income,
                "total_expense": summary.total_expense,
                "net_cash_flow": summary.net_cash_flow,
                "transaction_count": summary.transaction_count,
            },
            "category_summary": summary.category_summary,
            "transactions": [tx.to_dict() for tx in summary.transactions]
        }


def run_server(port=PORT):
    server = HTTPServer(("0.0.0.0", port), RequestHandler)
    print(f"🚀 Web App Sổ Thu Chi đang chạy tại: http://localhost:{port}")
    print(f"👉 Mở trình duyệt để kéo thả file sao kê, xem biểu đồ và tải file Excel/CSV.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nĐã dừng server.")


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else PORT
    run_server(port)
