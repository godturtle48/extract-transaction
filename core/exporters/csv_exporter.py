"""
CSV Exporter for Bank Statement Bookkeeping.
Uses UTF-8 with BOM (utf-8-sig) so Microsoft Excel opens it seamlessly without Vietnamese font issues.
"""
import csv
from core.models import StatementSummary

class CSVExporter:
    @staticmethod
    def export(summary: StatementSummary, output_path: str):
        headers = [
            "STT",
            "Ngày",
            "Loại",
            "Số tiền",
            "Danh mục",
            "Ghi chú",
            "Đối tác",
            "Ngân hàng đối tác",
            "Diễn giải",
            "Số dư",
            "Mã giao dịch"
        ]

        with open(output_path, mode="w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            for tx in summary.transactions:
                writer.writerow([
                    tx.id,
                    tx.date,
                    tx.type,
                    tx.amount,
                    tx.category,
                    tx.note,
                    tx.counterparty,
                    tx.counterparty_bank,
                    tx.description,
                    tx.balance,
                    tx.tx_code
                ])
