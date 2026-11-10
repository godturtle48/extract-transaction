"""
JSON Exporter for Bank Statement Bookkeeping.
"""
import json
from core.models import StatementSummary

class JSONExporter:
    @staticmethod
    def export(summary: StatementSummary, output_path: str):
        data = {
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

        with open(output_path, mode="w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
