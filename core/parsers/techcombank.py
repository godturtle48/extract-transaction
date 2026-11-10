"""
Techcombank Statement Parser.
Parses 'SỔ PHỤ KIÊM PHIẾU BÁO NỢ/CÓ' from Techcombank.
"""
import re
from typing import List, Optional
import pdfplumber

from core.models import Transaction, AccountInfo, StatementSummary
from core.parsers.base import BaseBankParser
from core.classifier import CategoryClassifier


class TechcombankParser(BaseBankParser):
    BANK_NAME = "Techcombank (Ngân hàng TMCP Kỹ Thương Việt Nam)"

    def can_parse(self, pdf_path: str) -> bool:
        try:
            with pdfplumber.open(pdf_path) as pdf:
                if len(pdf.pages) == 0:
                    return False
                first_page_text = pdf.pages[0].extract_text() or ""
                return "KỸ THƯƠNG VIỆT NAM" in first_page_text or "Techcombank" in first_page_text
        except Exception:
            return False

    def _parse_amount(self, val: Optional[str]) -> int:
        if not val:
            return 0
        cleaned = re.sub(r"[^\d]", "", val)
        return int(cleaned) if cleaned else 0

    def _extract_sender_from_desc(self, description: str) -> Optional[str]:
        """
        Attempts to extract sender's name from Techcombank transaction description
        when the Remitter column in the PDF statement is left empty.
        Examples:
        - 'BUI DANG BAO NGAN chuyen tien banh ts' -> 'BUI DANG BAO NGAN'
        - 'IBFT NGUYEN THI MINH NGOC chuyen ti en' -> 'NGUYEN THI MINH NGOC'
        - 'MBVCB... TRAN THI HIEN chuyen tien...' -> 'TRAN THI HIEN'
        - 'Nguyen Hong Ha chuyen tien QR' -> 'Nguyen Hong Ha'
        """
        # Case 1: MBVCB ... TRAN THI HIEN chuyen tien.CT tu ...
        m_ct = re.search(r"\b([A-Z\s]{4,35})\s+chuyen\s+tien\.CT\s+tu", description)
        if m_ct:
            name = m_ct.group(1).strip()
            # remove any prefix like transaction codes
            name = re.sub(r"^[A-Z0-9\.\s]+\.\s*", "", name).strip()
            if len(name) > 3:
                return name

        # Case 2: IBFT [NAME] chuyen
        m_ibft = re.search(r"IBFT\s+([A-Z\s]{4,35})\s+chuyen", description, re.IGNORECASE)
        if m_ibft:
            return m_ibft.group(1).strip()

        # Case 3: [NAME] chuyen tien / chuyen ti en / chuyen khoan
        m_simple = re.search(r"^([A-Z\s]{4,35}|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+chuyen\s+(?:tien|ti\s+en|khoan)", description, re.IGNORECASE)
        if m_simple:
            return m_simple.group(1).strip()

        return None

    def parse(self, pdf_path: str) -> StatementSummary:
        account_info = AccountInfo(bank_name=self.BANK_NAME)
        raw_rows = []
        full_text = ""

        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text() or ""
                full_text += page_text + "\n"
                tables = page.extract_tables() or []
                for table in tables:
                    for row in table:
                        raw_rows.append([cell.strip() if cell else "" for cell in row])

        # Extract account info from header
        m_acc = re.search(r"Số tài khoản/\s*Account no\.:\s*(\S+)", full_text)
        if m_acc:
            account_info.account_number = m_acc.group(1).strip()

        m_name = re.search(r"Tên khách hàng/\s*Customer name:\s*(.+?)(?:\s+Loại tiền|\n|$)", full_text)
        if m_name:
            account_info.account_name = m_name.group(1).strip()

        m_id = re.search(r"Số ID khách hàng/\s*Customer ID:\s*(\S+)", full_text)
        if m_id:
            account_info.customer_id = m_id.group(1).strip()

        m_curr = re.search(r"Loại tiền/\s*Currency:\s*(\S+)", full_text)
        if m_curr:
            account_info.currency = m_curr.group(1).strip()

        m_dates = re.search(r"Từ ngày/From date:\s*([\d/]+)\s*-\s*Đến ngày/To date:\s*([\d/]+)", full_text)
        if m_dates:
            account_info.start_date = m_dates.group(1).strip()
            account_info.end_date = m_dates.group(2).strip()

        # Process table rows
        opening_balance = 0
        ending_balance = 0
        parsed_raw_txs = []
        current_tx = None

        for row in raw_rows:
            if not any(row):
                continue

            col0 = row[0]
            # Check for header rows
            if "Transaction date" in col0 or "Ngày giao dịch" in col0:
                continue

            # Check for opening / ending balance rows
            if "Opening balance" in col0 or "Số dư đầu kỳ" in col0:
                opening_balance = self._parse_amount(row[-1] if len(row) > 1 else col0)
                continue
            if "Ending balance" in col0 or "Số dư cuối kỳ" in col0:
                ending_balance = self._parse_amount(row[-1] if len(row) > 1 else col0)
                continue

            # Check if this row starts with a date DD/MM/YYYY
            if re.match(r"^\d{2}/\d{2}/\d{4}$", col0):
                current_tx = {
                    "date": col0,
                    "counterparty": row[1].replace("\n", " ").strip() if len(row) > 1 else "",
                    "counterparty_bank": row[2].replace("\n", " ").strip() if len(row) > 2 else "",
                    "details": row[3].replace("\n", " ").strip() if len(row) > 3 else "",
                    "tx_no": row[4].replace("\n", " ").strip() if len(row) > 4 else "",
                    "debit": row[5].replace("\n", " ").strip() if len(row) > 5 else "",
                    "credit": row[6].replace("\n", " ").strip() if len(row) > 6 else "",
                    "balance": row[7].replace("\n", " ").strip() if len(row) > 7 else "",
                }
                parsed_raw_txs.append(current_tx)
            else:
                # Continuation of previous transaction across page boundary or multi-line cell
                if current_tx:
                    if len(row) > 1 and row[1]:
                        current_tx["counterparty"] += (" " + row[1].replace("\n", " ").strip())
                    if len(row) > 2 and row[2]:
                        current_tx["counterparty_bank"] += (" " + row[2].replace("\n", " ").strip())
                    if len(row) > 3 and row[3]:
                        current_tx["details"] += (" " + row[3].replace("\n", " ").strip())
                    if len(row) > 4 and row[4]:
                        current_tx["tx_no"] += (" " + row[4].replace("\n", " ").strip())
                    if len(row) > 5 and row[5]:
                        current_tx["debit"] += (" " + row[5].replace("\n", " ").strip())
                    if len(row) > 6 and row[6]:
                        current_tx["credit"] += (" " + row[6].replace("\n", " ").strip())
                    if len(row) > 7 and row[7]:
                        current_tx["balance"] += (" " + row[7].replace("\n", " ").strip())

        # Build clean Transaction objects
        transactions: List[Transaction] = []
        total_income = 0
        total_expense = 0
        category_summary: dict = {}

        for idx, raw in enumerate(parsed_raw_txs, 1):
            debit_val = self._parse_amount(raw.get("debit"))
            credit_val = self._parse_amount(raw.get("credit"))
            balance_val = self._parse_amount(raw.get("balance"))

            if credit_val > 0:
                tx_type = "Thu"
                amount = credit_val
                total_income += credit_val
            else:
                tx_type = "Chi"
                amount = debit_val
                total_expense += debit_val

            counterparty = raw.get("counterparty", "").strip()
            details = raw.get("details", "").strip()
            # Clean extra spaces
            counterparty = re.sub(r"\s+", " ", counterparty)
            details = re.sub(r"\s+", " ", details)
            bank = re.sub(r"\s+", " ", raw.get("counterparty_bank", "").strip())
            tx_code = re.sub(r"\s+", " ", raw.get("tx_no", "").strip())

            # Infer counterparty if empty
            if not counterparty:
                extracted_name = self._extract_sender_from_desc(details)
                if extracted_name:
                    counterparty = extracted_name

            # Category classification
            category = CategoryClassifier.classify(tx_type, details, counterparty)

            # Generate short practical note
            note = ""
            combined_desc = f"{details} {counterparty} {bank}".lower()
            if "an toi" in combined_desc:
                note = "Ăn tối"
            elif "luong" in combined_desc:
                note = "Nhận lương"
            elif "tien nha" in combined_desc:
                note = "Tiền thuê nhà"
            elif "tien tra no" in combined_desc or "no hang thang" in combined_desc:
                note = "Trả nợ ngân hàng / cá nhân"
            elif "tin dung" in combined_desc:
                note = "Thanh toán thẻ tín dụng"
            elif "tieu vat cua vo" in combined_desc:
                note = "Tiền tiêu vặt vợ"
            elif "tieu vat cua chong" in combined_desc:
                note = "Tiền tiêu vặt chồng"
            elif "tieu vat" in combined_desc:
                note = "Tiền tiêu vặt"
            elif "momo" in combined_desc:
                note = "Nạp ví MoMo"
            elif "xang" in combined_desc or "xang dau" in combined_desc:
                note = "Đổ xăng xe"
            elif "banh ts" in combined_desc:
                note = "Bánh trà sữa"
            elif "topi" in combined_desc:
                note = "Đầu tư / Tích lũy Topi"
            elif "sinh loi tu dong" in combined_desc:
                note = "Lợi nhuận Sinh lời tự động"

            tx = Transaction(
                id=idx,
                date=raw.get("date", ""),
                type=tx_type,
                amount=amount,
                category=category,
                counterparty=counterparty,
                counterparty_bank=bank,
                description=details,
                balance=balance_val,
                tx_code=tx_code,
                note=note
            )
            transactions.append(tx)

            # Track category aggregates
            if category not in category_summary:
                category_summary[category] = {"income": 0, "expense": 0, "count": 0}
            if tx_type == "Thu":
                category_summary[category]["income"] += amount
            else:
                category_summary[category]["expense"] += amount
            category_summary[category]["count"] += 1

        summary = StatementSummary(
            account=account_info,
            opening_balance=opening_balance,
            ending_balance=ending_balance,
            total_income=total_income,
            total_expense=total_expense,
            net_cash_flow=total_income - total_expense,
            transaction_count=len(transactions),
            transactions=transactions,
            category_summary=category_summary
        )
        return summary
