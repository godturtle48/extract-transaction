"""
HTML Exporter: creates a standalone interactive dashboard to view, filter, and analyze transactions.
"""
import json
from core.models import StatementSummary

class HTMLExporter:
    @staticmethod
    def export(summary: StatementSummary, output_path: str):
        tx_data = [tx.to_dict() for tx in summary.transactions]
        json_data = json.dumps(tx_data, ensure_ascii=False)
        cats_data = json.dumps(summary.category_summary, ensure_ascii=False)

        html = f"""<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sổ Thu Chi - {summary.account.account_name}</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {{
            --primary: #2563eb;
            --primary-hover: #1d4ed8;
            --bg: #f8fafc;
            --card-bg: #ffffff;
            --text-main: #0f172a;
            --text-muted: #64748b;
            --green: #16a34a;
            --green-bg: #f0fdf4;
            --red: #dc2626;
            --red-bg: #fef2f2;
            --border: #e2e8f0;
        }}
        * {{ box-sizing: border-box; margin: 0; padding: 0; }}
        body {{
            font-family: 'Inter', -apple-system, sans-serif;
            background: var(--bg);
            color: var(--text-main);
            padding: 24px;
            line-height: 1.5;
        }}
        .container {{ max-width: 1300px; margin: 0 auto; }}
        .header {{
            background: var(--card-bg);
            padding: 24px;
            border-radius: 12px;
            border: 1px solid var(--border);
            margin-bottom: 20px;
        }}
        .header h1 {{ font-size: 24px; font-weight: 700; color: #1e3a8a; margin-bottom: 6px; }}
        .header p {{ color: var(--text-muted); font-size: 14px; }}
        
        .kpi-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 16px;
            margin-bottom: 24px;
        }}
        .kpi-card {{
            background: var(--card-bg);
            padding: 20px;
            border-radius: 12px;
            border: 1px solid var(--border);
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }}
        .kpi-label {{ font-size: 13px; color: var(--text-muted); font-weight: 500; margin-bottom: 6px; }}
        .kpi-value {{ font-size: 22px; font-weight: 700; }}
        .text-green {{ color: var(--green); }}
        .text-red {{ color: var(--red); }}
        .text-blue {{ color: var(--primary); }}

        .main-card {{
            background: var(--card-bg);
            border-radius: 12px;
            border: 1px solid var(--border);
            padding: 20px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.05);
        }}
        .controls {{
            display: flex;
            flex-wrap: wrap;
            gap: 12px;
            margin-bottom: 18px;
            align-items: center;
            justify-content: space-between;
        }}
        .search-input {{
            padding: 8px 14px;
            border: 1px solid var(--border);
            border-radius: 8px;
            font-size: 14px;
            min-width: 280px;
            outline: none;
        }}
        .search-input:focus {{ border-color: var(--primary); }}
        .filter-select {{
            padding: 8px 12px;
            border: 1px solid var(--border);
            border-radius: 8px;
            font-size: 14px;
            outline: none;
            background: white;
        }}
        .btn-group {{ display: flex; gap: 8px; }}
        .btn {{
            padding: 8px 14px;
            border-radius: 8px;
            border: 1px solid var(--border);
            background: white;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
        }}
        .btn:hover {{ background: #f1f5f9; }}
        .btn.active {{ background: var(--primary); color: white; border-color: var(--primary); }}

        table {{
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }}
        th {{
            background: #f8fafc;
            color: var(--text-muted);
            text-align: left;
            padding: 12px 14px;
            font-weight: 600;
            border-bottom: 1px solid var(--border);
        }}
        td {{
            padding: 12px 14px;
            border-bottom: 1px solid var(--border);
            vertical-align: middle;
        }}
        tr:hover td {{ background: #f8fafc; }}
        .badge {{
            display: inline-block;
            padding: 4px 8px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 12px;
        }}
        .badge-income {{ background: var(--green-bg); color: var(--green); }}
        .badge-expense {{ background: var(--red-bg); color: var(--red); }}
        .badge-cat {{ background: #eff6ff; color: #1d4ed8; }}
        .amount {{ font-weight: 600; font-variant-numeric: tabular-nums; }}
        .text-right {{ text-align: right; }}
        .text-center {{ text-align: center; }}
        .empty-state {{ text-align: center; padding: 40px; color: var(--text-muted); }}
    </style>
</head>
<body>
<div class="container">
    <div class="header">
        <h1>SỔ THEO DÕI THU CHI TỪ SAO KÊ</h1>
        <p><strong>{summary.account.bank_name}</strong> | Chủ tài khoản: <strong>{summary.account.account_name}</strong> | STK: <strong>{summary.account.account_number}</strong></p>
        <p>Kỳ sao kê: {summary.account.start_date} - {summary.account.end_date} | Đơn vị tiền tệ: {summary.account.currency}</p>
    </div>

    <div class="kpi-grid">
        <div class="kpi-card">
            <div class="kpi-label">Số dư đầu kỳ</div>
            <div class="kpi-value text-blue">{summary.opening_balance:,.0f} đ</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">Tổng thu nhập (+)</div>
            <div class="kpi-value text-green">+{summary.total_income:,.0f} đ</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">Tổng chi tiêu (-)</div>
            <div class="kpi-value text-red">-{summary.total_expense:,.0f} đ</div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">Dòng tiền ròng</div>
            <div class="kpi-value {'text-green' if summary.net_cash_flow >= 0 else 'text-red'}">
                {'+' if summary.net_cash_flow >= 0 else ''}{summary.net_cash_flow:,.0f} đ
            </div>
        </div>
        <div class="kpi-card">
            <div class="kpi-label">Số dư cuối kỳ</div>
            <div class="kpi-value">{summary.ending_balance:,.0f} đ</div>
        </div>
    </div>

    <div class="main-card">
        <div class="controls">
            <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                <input type="text" id="searchInput" class="search-input" placeholder="🔍 Tìm kiếm giao dịch, người gửi/nhận, nội dung...">
                <select id="categoryFilter" class="filter-select">
                    <option value="">Tất cả danh mục</option>
                </select>
            </div>
            <div class="btn-group">
                <button class="btn active" onclick="setTypeFilter('all', this)">Tất cả ({len(summary.transactions)})</button>
                <button class="btn" onclick="setTypeFilter('Thu', this)">Chỉ Thu</button>
                <button class="btn" onclick="setTypeFilter('Chi', this)">Chỉ Chi</button>
            </div>
        </div>

        <div style="overflow-x: auto;">
            <table>
                <thead>
                    <tr>
                        <th class="text-center" style="width: 50px;">STT</th>
                        <th style="width: 100px;">Ngày</th>
                        <th style="width: 80px;">Loại</th>
                        <th class="text-right" style="width: 140px;">Số tiền</th>
                        <th style="width: 160px;">Danh mục</th>
                        <th>Ghi chú / Đối tác</th>
                        <th>Nội dung giao dịch</th>
                        <th class="text-right" style="width: 140px;">Số dư sau GD</th>
                    </tr>
                </thead>
                <tbody id="txBody"></tbody>
            </table>
        </div>
    </div>
</div>

<script>
    const transactions = {json_data};
    let currentTypeFilter = 'all';

    // Populate categories dropdown
    const catSet = new Set(transactions.map(t => t.danh_muc));
    const catSelect = document.getElementById('categoryFilter');
    catSet.forEach(cat => {{
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat;
        catSelect.appendChild(opt);
    }});

    function formatVND(val) {{
        return new Intl.NumberFormat('vi-VN').format(val) + ' đ';
    }}

    function renderTable() {{
        const query = document.getElementById('searchInput').value.toLowerCase();
        const selectedCat = document.getElementById('categoryFilter').value;
        const tbody = document.getElementById('txBody');
        tbody.innerHTML = '';

        const filtered = transactions.filter(t => {{
            if (currentTypeFilter !== 'all' && t.loai !== currentTypeFilter) return false;
            if (selectedCat && t.danh_muc !== selectedCat) return false;
            if (query) {{
                const matchString = `${{t.ngay}} ${{t.danh_muc}} ${{t.doi_tac}} ${{t.ngan_hang_doi_tac}} ${{t.dien_giai}} ${{t.ghi_chu}}`.toLowerCase();
                if (!matchString.includes(query)) return false;
            }}
            return true;
        }});

        if (filtered.length === 0) {{
            tbody.innerHTML = '<tr><td colspan="8" class="empty-state">Không tìm thấy giao dịch nào phù hợp.</td></tr>';
            return;
        }}

        filtered.forEach(t => {{
            const tr = document.createElement('tr');
            const isThu = t.loai === 'Thu';
            tr.innerHTML = `
                <td class="text-center">${{t.stt}}</td>
                <td>${{t.ngay}}</td>
                <td><span class="badge ${{isThu ? 'badge-income' : 'badge-expense'}}">${{t.loai}}</span></td>
                <td class="text-right amount ${{isThu ? 'text-green' : 'text-red'}}">${{isThu ? '+' : '-'}}${{formatVND(t.so_tien)}}</td>
                <td><span class="badge badge-cat">${{t.danh_muc}}</span></td>
                <td>
                    <strong>${{t.ghi_chu || ''}}</strong>
                    ${{t.doi_tac ? `<div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">Đối tác: ${{t.doi_tac}}</div>` : ''}}
                </td>
                <td style="color: #334155;">${{t.dien_giai}}</td>
                <td class="text-right amount">${{formatVND(t.so_du)}}</td>
            `;
            tbody.appendChild(tr);
        }});
    }}

    function setTypeFilter(type, btn) {{
        currentTypeFilter = type;
        document.querySelectorAll('.btn-group .btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderTable();
    }}

    document.getElementById('searchInput').addEventListener('input', renderTable);
    document.getElementById('categoryFilter').addEventListener('change', renderTable);
    renderTable();
</script>
</body>
</html>
"""
        with open(output_path, mode="w", encoding="utf-8") as f:
            f.write(html)
