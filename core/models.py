"""
Data models for bank transactions and statement summary.
"""
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional

@dataclass
class Transaction:
    id: int
    date: str                  # DD/MM/YYYY
    type: str                  # "Thu" or "Chi"
    amount: int                # Số tiền (VND, số dương)
    category: str              # Danh mục thu chi (Ăn uống, Lương, Trả nợ,...)
    counterparty: str          # Người nhận / Người gửi
    counterparty_bank: str     # Ngân hàng đối tác
    description: str           # Diễn giải nội dung giao dịch
    balance: int               # Số dư sau giao dịch
    tx_code: str               # Số bút toán / Mã giao dịch
    note: str = ""             # Ghi chú bổ sung cho sổ thu chi

    def to_dict(self) -> Dict[str, Any]:
        return {
            "stt": self.id,
            "ngay": self.date,
            "loai": self.type,
            "so_tien": self.amount,
            "danh_muc": self.category,
            "doi_tac": self.counterparty,
            "ngan_hang_doi_tac": self.counterparty_bank,
            "dien_giai": self.description,
            "so_du": self.balance,
            "ma_giao_dich": self.tx_code,
            "ghi_chu": self.note
        }

@dataclass
class AccountInfo:
    bank_name: str = ""
    account_name: str = ""
    account_number: str = ""
    currency: str = "VND"
    customer_id: str = ""
    start_date: str = ""
    end_date: str = ""

@dataclass
class StatementSummary:
    account: AccountInfo
    opening_balance: int = 0
    ending_balance: int = 0
    total_income: int = 0
    total_expense: int = 0
    net_cash_flow: int = 0
    transaction_count: int = 0
    transactions: List[Transaction] = field(default_factory=list)
    category_summary: Dict[str, Dict[str, Any]] = field(default_factory=dict)
