"""
Excel Exporter for Bank Statement Bookkeeping (Sổ Thu Chi).
Produces an aesthetically styled Excel workbook ready for personal/household finance management.
"""
from typing import Optional
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter

from core.models import StatementSummary

class ExcelExporter:
    @staticmethod
    def export(summary: StatementSummary, output_path: str):
        wb = openpyxl.Workbook()
        
        # ---------------- SHEET 1: SỔ THU CHI ----------------
        ws = wb.active
        ws.title = "Sổ Thu Chi"
        ws.views.sheetView[0].showGridLines = True

        # Styles
        font_title = Font(name="Calibri", size=16, bold=True, color="1F497D")
        font_sub = Font(name="Calibri", size=10, italic=True, color="595959")
        font_section = Font(name="Calibri", size=11, bold=True, color="1F497D")
        font_card_title = Font(name="Calibri", size=9, bold=True, color="595959")
        font_card_num = Font(name="Calibri", size=13, bold=True)
        font_header = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
        font_regular = Font(name="Calibri", size=10)
        font_bold = Font(name="Calibri", size=10, bold=True)

        fill_header = PatternFill(start_color="1F497D", end_color="1F497D", fill_type="solid")
        fill_income = PatternFill(start_color="E2EFDA", end_color="E2EFDA", fill_type="solid")   # soft green
        fill_expense = PatternFill(start_color="FCE4D6", end_color="FCE4D6", fill_type="solid")  # soft red/peach
        fill_zebra = PatternFill(start_color="F9FAFB", end_color="F9FAFB", fill_type="solid")

        color_green = "274E13"
        color_red = "990000"

        thin_side = Side(border_style="thin", color="D9D9D9")
        border_all = Border(left=thin_side, right=thin_side, top=thin_side, bottom=thin_side)
        card_border = Border(left=thin_side, right=thin_side, top=thin_side, bottom=thin_side)

        # Title
        ws["A1"] = "SỔ THEO DÕI THU CHI TỪ SAO KÊ NGÂN HÀNG"
        ws["A1"].font = font_title
        ws["A2"] = f"Ngân hàng: {summary.account.bank_name} | Chủ TK: {summary.account.account_name} | Số TK: {summary.account.account_number}"
        ws["A2"].font = font_sub
        ws["A3"] = f"Kỳ giao dịch: {summary.account.start_date} - {summary.account.end_date} | Đơn vị tiền tệ: {summary.account.currency}"
        ws["A3"].font = font_sub

        # KPI Summary Cards (Row 5 & 6)
        cards = [
            ("SỐ DƯ ĐẦU KỲ", summary.opening_balance, "B4C6E7", "000000"),
            ("TỔNG TIỀN THU (+)", summary.total_income, "C6EFCE", color_green),
            ("TỔNG TIỀN CHI (-)", summary.total_expense, "FFC7CE", color_red),
            ("CHÊNH LỆCH RÒNG", summary.net_cash_flow, "D9E1F2", color_green if summary.net_cash_flow >= 0 else color_red),
            ("SỐ DƯ CUỐI KỲ", summary.ending_balance, "FFF2CC", "000000"),
        ]

        col_pairs = [(1, 2), (3, 4), (5, 6), (7, 8), (9, 10)]
        for idx, (label, val, fill_color, text_color) in enumerate(cards):
            c_start, c_end = col_pairs[idx]
            ws.merge_cells(start_row=5, start_column=c_start, end_row=5, end_column=c_end)
            ws.merge_cells(start_row=6, start_column=c_start, end_row=6, end_column=c_end)

            cell_top = ws.cell(row=5, column=c_start, value=label)
            cell_top.font = font_card_title
            cell_top.alignment = Alignment(horizontal="center", vertical="center")
            cell_top.fill = PatternFill(start_color=fill_color, end_color=fill_color, fill_type="solid")
            cell_top.border = card_border

            cell_bot = ws.cell(row=6, column=c_start, value=val)
            cell_bot.font = Font(name="Calibri", size=12, bold=True, color=text_color)
            cell_bot.alignment = Alignment(horizontal="center", vertical="center")
            cell_bot.number_format = "#,##0"
            cell_bot.fill = PatternFill(start_color="FFFFFF", end_color="FFFFFF", fill_type="solid")
            cell_bot.border = card_border

        # Table Header (Row 8)
        table_start_row = 8
        headers = [
            ("STT", 6, "center"),
            ("Ngày GD", 12, "center"),
            ("Loại", 8, "center"),
            ("Số tiền (VND)", 16, "right"),
            ("Danh mục thu chi", 22, "left"),
            ("Ghi chú", 22, "left"),
            ("Đối tác / Người nhận-gửi", 28, "left"),
            ("Ngân hàng đối tác", 25, "left"),
            ("Diễn giải nội dung giao dịch", 38, "left"),
            ("Số dư sau GD", 16, "right"),
            ("Mã bút toán", 22, "left"),
        ]

        for col_idx, (header_name, width, align) in enumerate(headers, 1):
            cell = ws.cell(row=table_start_row, column=col_idx, value=header_name)
            cell.font = font_header
            cell.fill = fill_header
            cell.alignment = Alignment(horizontal=align, vertical="center", wrap_text=True)
            cell.border = border_all
            ws.column_dimensions[get_column_letter(col_idx)].width = width

        # Data Rows
        current_row = table_start_row + 1
        for tx in summary.transactions:
            ws.cell(row=current_row, column=1, value=tx.id).alignment = Alignment(horizontal="center")
            ws.cell(row=current_row, column=2, value=tx.date).alignment = Alignment(horizontal="center")
            
            loai_cell = ws.cell(row=current_row, column=3, value=tx.type)
            loai_cell.alignment = Alignment(horizontal="center")
            loai_cell.font = font_bold
            
            amt_cell = ws.cell(row=current_row, column=4, value=tx.amount)
            amt_cell.number_format = "#,##0"
            amt_cell.alignment = Alignment(horizontal="right")
            amt_cell.font = font_bold

            # Highlight Thu vs Chi
            if tx.type == "Thu":
                loai_cell.fill = fill_income
                loai_cell.font = Font(name="Calibri", size=10, bold=True, color=color_green)
                amt_cell.font = Font(name="Calibri", size=10, bold=True, color=color_green)
            else:
                loai_cell.fill = fill_expense
                loai_cell.font = Font(name="Calibri", size=10, bold=True, color=color_red)
                amt_cell.font = Font(name="Calibri", size=10, bold=True, color=color_red)

            ws.cell(row=current_row, column=5, value=tx.category).alignment = Alignment(horizontal="left")
            ws.cell(row=current_row, column=6, value=tx.note).alignment = Alignment(horizontal="left")
            ws.cell(row=current_row, column=7, value=tx.counterparty).alignment = Alignment(horizontal="left")
            ws.cell(row=current_row, column=8, value=tx.counterparty_bank).alignment = Alignment(horizontal="left")
            ws.cell(row=current_row, column=9, value=tx.description).alignment = Alignment(horizontal="left")

            bal_cell = ws.cell(row=current_row, column=10, value=tx.balance)
            bal_cell.number_format = "#,##0"
            bal_cell.alignment = Alignment(horizontal="right")

            ws.cell(row=current_row, column=11, value=tx.tx_code).alignment = Alignment(horizontal="left")

            # Border for all cells in row
            for c in range(1, len(headers) + 1):
                cell = ws.cell(row=current_row, column=c)
                if not cell.font.bold and cell.font.name != "Calibri":
                    cell.font = font_regular
                cell.border = border_all

            current_row += 1

        # Total Row at bottom
        ws.cell(row=current_row, column=1, value="")
        ws.cell(row=current_row, column=2, value="TỔNG CỘNG").font = font_bold
        ws.cell(row=current_row, column=3, value=f"{len(summary.transactions)} GD").font = font_bold
        total_amt_cell = ws.cell(row=current_row, column=4, value=f"=SUM(D{table_start_row+1}:D{current_row-1})")
        total_amt_cell.font = font_bold
        total_amt_cell.number_format = "#,##0"
        for c in range(1, len(headers) + 1):
            cell = ws.cell(row=current_row, column=c)
            cell.border = Border(top=thin_side, bottom=Side(border_style="double", color="1F497D"))
            cell.fill = PatternFill(start_color="F2F2F2", end_color="F2F2F2", fill_type="solid")

        # ---------------- SHEET 2: BÁO CÁO DANH MỤC ----------------
        ws2 = wb.create_sheet(title="Báo Cáo Theo Danh Mục")
        ws2.views.sheetView[0].showGridLines = True

        ws2["A1"] = "TỔNG HỢP THU CHI THEO DANH MỤC"
        ws2["A1"].font = font_title
        ws2["A2"] = f"Kỳ: {summary.account.start_date} - {summary.account.end_date}"
        ws2["A2"].font = font_sub

        cat_headers = ["STT", "Danh mục thu chi", "Số giao dịch", "Tổng Thu (VND)", "Tổng Chi (VND)", "Chênh lệch Ròng (VND)"]
        cat_widths = [6, 28, 14, 20, 20, 22]

        for col_idx, (h_name, width) in enumerate(zip(cat_headers, cat_widths), 1):
            cell = ws2.cell(row=4, column=col_idx, value=h_name)
            cell.font = font_header
            cell.fill = fill_header
            cell.alignment = Alignment(horizontal="center", vertical="center")
            cell.border = border_all
            ws2.column_dimensions[get_column_letter(col_idx)].width = width

        cat_row = 5
        idx = 1
        for cat_name, data in sorted(summary.category_summary.items(), key=lambda x: (x[1]["expense"] + x[1]["income"]), reverse=True):
            ws2.cell(row=cat_row, column=1, value=idx).alignment = Alignment(horizontal="center")
            ws2.cell(row=cat_row, column=2, value=cat_name).alignment = Alignment(horizontal="left")
            ws2.cell(row=cat_row, column=3, value=data["count"]).alignment = Alignment(horizontal="center")
            
            c_in = ws2.cell(row=cat_row, column=4, value=data["income"])
            c_in.number_format = "#,##0"
            c_in.alignment = Alignment(horizontal="right")
            if data["income"] > 0:
                c_in.font = Font(name="Calibri", size=10, bold=True, color=color_green)

            c_out = ws2.cell(row=cat_row, column=5, value=data["expense"])
            c_out.number_format = "#,##0"
            c_out.alignment = Alignment(horizontal="right")
            if data["expense"] > 0:
                c_out.font = Font(name="Calibri", size=10, bold=True, color=color_red)

            net = data["income"] - data["expense"]
            c_net = ws2.cell(row=cat_row, column=6, value=net)
            c_net.number_format = "#,##0"
            c_net.alignment = Alignment(horizontal="right")
            c_net.font = Font(name="Calibri", size=10, bold=True, color=color_green if net >= 0 else color_red)

            for c in range(1, 7):
                ws2.cell(row=cat_row, column=c).border = border_all
            cat_row += 1
            idx += 1

        wb.save(output_path)
