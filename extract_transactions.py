#!/usr/bin/env python3
"""
Bank Transaction Extractor for Bookkeeping (Sổ Thu Chi).
Extracts transactions from bank statement PDFs and generates structured files (Excel, CSV, JSON, HTML)
with automatic categorization and income/expense breakdown.
"""

import sys
import os
import argparse
from typing import List

from core.parsers import get_parser
from core.exporters import ExcelExporter, CSVExporter, JSONExporter, HTMLExporter
from core.models import StatementSummary


def format_currency(val: int) -> str:
    return f"{val:,.0f} đ".replace(",", ".")


def print_terminal_summary(summary: StatementSummary):
    print("\n" + "=" * 70)
    print(f"📊 BÁO CÁO TỔNG QUAN SAO KÊ - {summary.account.bank_name}")
    print("=" * 70)
    print(f" Chủ tài khoản: {summary.account.account_name}")
    print(f" Số tài khoản : {summary.account.account_number}")
    print(f" Kỳ sao kê    : {summary.account.start_date} -> {summary.account.end_date}")
    print(f" Số dư đầu kỳ : {format_currency(summary.opening_balance):>20}")
    print(f" Tổng THU (+) : {format_currency(summary.total_income):>20}")
    print(f" Tổng CHI (-) : {format_currency(summary.total_expense):>20}")
    net_str = ("+" if summary.net_cash_flow >= 0 else "") + format_currency(summary.net_cash_flow)
    print(f" Chênh lệch   : {net_str:>20}")
    print(f" Số dư cuối kỳ: {format_currency(summary.ending_balance):>20}")
    print("-" * 70)
    print(f"⚡ Tổng số giao dịch: {summary.transaction_count}")
    print("=" * 70)

    print("\n📂 PHÂN LOẠI THU CHI THEO DANH MỤC:")
    print(f"{'Danh mục':<28} | {'Số GD':<6} | {'Tổng Thu':<15} | {'Tổng Chi':<15}")
    print("-" * 70)
    for cat, data in sorted(summary.category_summary.items(), key=lambda x: (x[1]['expense'] + x[1]['income']), reverse=True):
        thu_str = format_currency(data['income']) if data['income'] > 0 else "-"
        chi_str = format_currency(data['expense']) if data['expense'] > 0 else "-"
        print(f"{cat:<28} | {data['count']:<6} | {thu_str:<15} | {chi_str:<15}")
    print("-" * 70)

    print("\n📋 DANH SÁCH GIAO DỊCH (GHI CHÉP SỔ THU CHI):")
    print(f"{'STT':<4} | {'Ngày':<10} | {'Loại':<4} | {'Số tiền':<15} | {'Danh mục':<22} | {'Nội dung / Ghi chú'}")
    print("-" * 90)
    for tx in summary.transactions:
        sign = "+" if tx.type == "Thu" else "-"
        amt_str = f"{sign}{format_currency(tx.amount)}"
        desc = tx.note if tx.note else (tx.description[:40] + "..." if len(tx.description) > 40 else tx.description)
        print(f"{tx.id:<4} | {tx.date:<10} | {tx.type:<4} | {amt_str:<15} | {tx.category:<22} | {desc}")
    print("=" * 90)


def main():
    parser = argparse.ArgumentParser(
        description="Trích xuất sao kê ngân hàng thành dữ liệu ghi sổ thu chi (Excel, CSV, JSON, HTML)."
    )
    parser.add_argument("pdf_path", help="Đường dẫn tới file PDF sao kê ngân hàng")
    parser.add_argument(
        "--format", "-f",
        default="all",
        help="Định dạng xuất file: all, xlsx, csv, json, html (mặc định: all)"
    )
    parser.add_argument(
        "--output-dir", "-o",
        default=".",
        help="Thư mục lưu file kết quả (mặc định: cùng thư mục hiện tại)"
    )
    parser.add_argument(
        "--prefix", "-p",
        default="so_thu_chi",
        help="Tên tiền tố của file xuất ra (mặc định: so_thu_chi)"
    )
    parser.add_argument(
        "--quiet", "-q",
        action="store_true",
        help="Ẩn báo cáo tóm tắt trên màn hình console"
    )

    args = parser.parse_args()

    if not os.path.exists(args.pdf_path):
        print(f"❌ Lỗi: Không tìm thấy file '{args.pdf_path}'")
        sys.exit(1)

    # Detect parser
    bank_parser = get_parser(args.pdf_path)
    if not bank_parser:
        print(f"❌ Không hỗ trợ định dạng file PDF này.")
        sys.exit(1)

    print(f"🔍 Đang phân tích sao kê: {args.pdf_path} ...")
    summary = bank_parser.parse(args.pdf_path)

    os.makedirs(args.output_dir, exist_ok=True)
    base_name = f"{args.prefix}_{summary.account.account_number}" if summary.account.account_number else args.prefix
    
    formats = [f.strip().lower() for f in args.format.split(",")]
    if "all" in formats:
        formats = ["xlsx", "csv", "json", "html"]

    generated_files = []

    if "xlsx" in formats:
        out_excel = os.path.join(args.output_dir, f"{base_name}.xlsx")
        ExcelExporter.export(summary, out_excel)
        generated_files.append(("Excel (.xlsx) - Mẫu Sổ Thu Chi đẹp mắt", out_excel))

    if "csv" in formats:
        out_csv = os.path.join(args.output_dir, f"{base_name}.csv")
        CSVExporter.export(summary, out_csv)
        generated_files.append(("CSV (UTF-8) - Import vào Excel/Google Sheets", out_csv))

    if "json" in formats:
        out_json = os.path.join(args.output_dir, f"{base_name}.json")
        JSONExporter.export(summary, out_json)
        generated_files.append(("JSON - Dành cho tích hợp lập trình/API", out_json))

    if "html" in formats:
        out_html = os.path.join(args.output_dir, f"{base_name}.html")
        HTMLExporter.export(summary, out_html)
        generated_files.append(("HTML - Giao diện Web tương tác xem & lọc", out_html))

    if not args.quiet:
        print_terminal_summary(summary)

    print("\n🎉 Đã xuất thành công các file:")
    for label, path in generated_files:
        print(f"  👉 {label}: {path}")


if __name__ == "__main__":
    main()
