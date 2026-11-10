"""
Smart Rule-based Classifier for Vietnamese Bank Transactions.
Automatically assigns accounting categories suitable for personal / household bookkeeping (Sổ thu chi).
"""
import os
import json
import re
from typing import Tuple, List

class CategoryClassifier:
    """Classifies bank transactions into income and expense categories."""

    # Default expense categorization rules
    DEFAULT_EXPENSE_RULES = [
        ("Ví điện tử & Nạp tiền", [
            r"nap\s+vi", r"\bmomo\b", r"zalopay", r"viettel\s*money", r"vnpay", r"shopeepay"
        ]),
        ("Xăng xe & Đi lại", [
            r"xang\s+dau", r"\bxang\b", r"petro", r"gui\s+xe", r"rua\s+xe", r"taxi",
            r"\bgrab\b", r"\bbe\b", r"xanh\s+sm", r"ve\s+xe", r"ve\s+may\s+bay", r"phi\s+cau\s+duong"
        ]),
        ("Nhà cửa & Thuê phòng", [
            r"tien\s+nha", r"thue\s+nha", r"tien\s+phong", r"chung\s+cu", r"dien\s+nuoc",
            r"tien\s+dien", r"tien\s+nuoc", r"phi\s+quan\s+ly", r"internet", r"mang\s+wifi"
        ]),
        ("Ăn uống", [
            r"an\s+toi", r"an\s+sang", r"an\s+trua", r"tien\s+an", r"banh\s+ts", r"tra\s+sua",
            r"cafe", r"ca\s+phe", r"nha\s+hang", r"quan\s+an", r"\bpho\b", r"\bbun\b", r"\bcom\b",
            r"\bfood\b", r"grabfood", r"shopeefood", r"starbucks", r"highlands", r"phuc\s+long"
        ]),
        ("Trả nợ & Vay mượn", [
            r"tin\s+dung", r"tra\s+no", r"no\s+hang\s+thang", r"khoan\s+vay", r"vay\s+von",
            r"tra\s+gop", r"lai\s+vay", r"tien\s+tra\b", r"the\s+tin\s+dung", r"\bcredit\b"
        ]),
        ("Gia đình & Tiêu vặt", [
            r"tieu\s+vat", r"tien\s+cho", r"sinh\s+hoat", r"bieu\s+bo", r"bieu\s+me",
            r"vo\s+con", r"con\s+cai", r"hoc\s+phi", r"sua\s+ta", r"tien\s+tieu\s+vat"
        ]),
        ("Tiết kiệm & Đầu tư", [
            r"topi", r"tich\s+luy", r"dau\s+tu", r"chung\s+khoan", r"co\s+phieu",
            r"trai\s+phieu", r"vang", r"tiet\s+kiem", r"sinh\s+loi\s+tu\s+dong", r"upoint"
        ]),
        ("Mua sắm & Tiêu dùng", [
            r"shopee", r"lazada", r"tiki", r"sieu\s+thi", r"winmart", r"coopmart",
            r"bach\s+hoa", r"quan\s+ao", r"thoi\s+trang", r"mua\s+sam"
        ]),
        ("Y tế & Sức khỏe", [
            r"thuoc", r"nha\s+khoa", r"benh\s+vien", r"kham\s+benh", r"gym", r"yoga", r"the\s+thao"
        ]),
    ]

    # Default income categorization rules
    DEFAULT_INCOME_RULES = [
        ("Lương & Thu nhập chính", [
            r"luong", r"salary", r"payroll", r"thuong", r"bonus", r"khoan\s+luong"
        ]),
        ("Tiền lãi & Lợi nhuận", [
            r"sinh\s+loi", r"loi\s+nhuan", r"lai\s+suat", r"tiet\s+kiem", r"co\s+tuc", r"interest"
        ]),
        ("Rút tiết kiệm & Đầu tư", [
            r"topi", r"rut\s+tien", r"thanh\s+ly", r"ban\s+chung\s+khoan"
        ]),
        ("Thu đòi nợ & Được trả tiền", [
            r"tra\s+tien", r"tra\s+no", r"hoan\s+tien", r"refund"
        ]),
        ("Thu nhập khác & Chuyển khoản", [
            r"chuyen\s+tien", r"chuyen\s+khoan", r"banh\s+ts", r"mua\s+nha", r"qr", r"ibft"
        ])
    ]

    _loaded = False
    _expense_rules = []
    _income_rules = []

    @classmethod
    def _load_rules(cls):
        if cls._loaded:
            return

        cfg_path = os.path.join(os.getcwd(), "categories.json")
        if os.path.exists(cfg_path):
            try:
                with open(cfg_path, "r", encoding="utf-8") as f:
                    cfg = json.load(f)
                    cls._expense_rules = [(item["category"], item["patterns"]) for item in cfg.get("expense_rules", [])]
                    cls._income_rules = [(item["category"], item["patterns"]) for item in cfg.get("income_rules", [])]
                    cls._loaded = True
                    return
            except Exception:
                pass

        cls._expense_rules = cls.DEFAULT_EXPENSE_RULES
        cls._income_rules = cls.DEFAULT_INCOME_RULES
        cls._loaded = True

    @classmethod
    def classify(cls, tx_type: str, description: str, counterparty: str = "") -> str:
        """
        Classifies transaction based on type, description, and counterparty.
        Returns the category name.
        """
        cls._load_rules()
        text = f"{description} {counterparty}".lower()
        rules = cls._income_rules if tx_type == "Thu" else cls._expense_rules
        default_cat = "Thu khác" if tx_type == "Thu" else "Chi tiêu khác"

        for category, patterns in rules:
            for pattern in patterns:
                if re.search(pattern, text, re.IGNORECASE):
                    return category

        return default_cat
