/**
 * PDF Bank Statement Parser for Chrome Extension (using PDF.js).
 * Runs 100% locally in browser - fast, private, and secure.
 */

const BankPDFParser = {
    // Column x boundaries for Techcombank landscape statement (pt)
    TECHCOMBANK_COLS: [30.5, 109.5, 198.5, 287.5, 416.5, 535.5, 624.5, 713.8, 820.0],

    // MISA Category Mapping (Ordered: top-up e-wallet -> specific merchants -> generic wallet gateways)
    EXPENSE_RULES: [
        { category: "Ví điện tử", misaCategory: "Ví điện tử", patterns: [/nap\s+vi/i, /nap\s+tien\s+vi/i] },
        { category: "Đi lại", misaCategory: "Đi lại", patterns: [/xang\s+dau/i, /\bxang\b/i, /petro/i, /gui\s+xe/i, /rua\s+xe/i, /taxi/i, /\bgrab\b/i, /\bbe\b/i, /xanh\s+sm/i, /green\s*sm/i, /ve\s+xe/i] },
        { category: "Ăn uống", misaCategory: "Ăn uống", patterns: [/an\s+toi/i, /an\s+sang/i, /an\s+trua/i, /tien\s+an/i, /banh\s+ts/i, /tra\s+sua/i, /cafe/i, /ca\s+phe/i, /nha\s+hang/i, /quan\s+an/i, /\bpho\b/i, /\bbun\b/i, /\bcom\b/i, /\bfood\b/i, /grabfood/i, /shopeefood/i, /starbucks/i, /highlands/i, /mcdonald/i, /dominos/i, /pizza/i, /\bkfc\b/i, /lotteria/i, /jollibee/i] },
        { category: "Nhà cửa", misaCategory: "Nhà cửa", patterns: [/tien\s+nha/i, /thue\s+nha/i, /tien\s+phong/i, /chung\s+cu/i, /dien\s+nuoc/i, /tien\s+dien/i, /tien\s+nuoc/i, /internet/i] },
        { category: "Trả nợ", misaCategory: "Trả nợ", patterns: [/tin\s+dung/i, /tra\s+no/i, /no\s+hang\s+thang/i, /khoan\s+vay/i, /vay\s+von/i, /tra\s+gop/i, /lai\s+vay/i, /tien\s+tra\b/i, /the\s+tin\s+dung/i, /\bcredit\b/i] },
        { category: "Tiêu vặt", misaCategory: "Tiêu vặt", patterns: [/tieu\s+vat/i, /tien\s+cho/i, /sinh\s+hoat/i, /bieu\s+bo/i, /bieu\s+me/i, /vo\s+con/i, /con\s+cai/i, /hoc\s+phi/i] },
        { category: "Tiết kiệm & Đầu tư", misaCategory: "Tiết kiệm", patterns: [/topi/i, /tich\s+luy/i, /dau\s+tu/i, /chung\s+khoan/i, /co\s+phieu/i, /vang/i, /tiet\s+kiem/i, /sinh\s+loi\s+tu\s+dong/i, /upoint/i] },
        { category: "Mua sắm", misaCategory: "Mua sắm", patterns: [/shopee(?!pay)/i, /lazada/i, /tiki/i, /sieu\s+thi/i, /winmart/i, /maxvalu/i, /gs25/i, /circle\s*k/i, /familymart/i, /7-?eleven/i, /coopmart/i, /bach\s+hoa/i, /quan\s+ao/i, /thoi\s+trang/i, /mua\s+sam/i] },
        { category: "Ví điện tử", misaCategory: "Ví điện tử", patterns: [/\bmomo\b/i, /zalopay/i, /viettel\s*money/i, /vnpay/i, /shopeepay/i] }
    ],

    INCOME_RULES: [
        { category: "Lương", misaCategory: "Lương", patterns: [/luong/i, /salary/i, /payroll/i, /thuong/i, /bonus/i, /khoan\s+luong/i] },
        { category: "Tiền lãi", misaCategory: "Tiền lãi", patterns: [/sinh\s+loi/i, /loi\s+nhuan/i, /lai\s+suat/i, /tiet\s+kiem/i, /interest/i] },
        { category: "Thu hồi nợ", misaCategory: "Thu hồi nợ", patterns: [/tra\s+tien/i, /tra\s+no/i, /du\s+no/i, /hoan\s+tien/i, /refund/i] },
        { category: "Rút tiết kiệm / Đầu tư", misaCategory: "Rút tiết kiệm", patterns: [/topi/i, /rut\s+tien/i, /thanh\s+ly/i] },
        { category: "Thu khác", misaCategory: "Khoản thu khác", patterns: [/chuyen\s+tien/i, /chuyen\s+khoan/i, /banh\s+ts/i, /qr/i, /ibft/i] }
    ],

    classify(txType, desc, counterparty) {
        const text = `${desc} ${counterparty}`.toLowerCase();
        const rules = txType === "Thu" ? this.INCOME_RULES : this.EXPENSE_RULES;
        for (const rule of rules) {
            for (const pat of rule.patterns) {
                if (pat.test(text)) {
                    return { category: rule.category, misaCategory: rule.misaCategory };
                }
            }
        }
        return {
            category: txType === "Thu" ? "Thu khác" : "Chi tiêu khác",
            misaCategory: txType === "Thu" ? "Khoản thu khác" : "Khoản chi khác"
        };
    },

    extractSender(desc) {
        if (!desc) return "";
        let m = desc.match(/\b([A-Z\s]{4,35})\s+chuyen\s+tien\.CT\s+tu/);
        if (m) {
            let name = m[1].replace(/^[A-Z0-9\.\s]+\.\s*/, "").trim();
            if (name.length > 3) return name;
        }
        m = desc.match(/IBFT\s+([A-Z\s]{4,35})\s+chuyen/i);
        if (m) return m[1].trim();
        m = desc.match(/^([A-Z\s]{4,35}|[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s+chuyen\s+(?:tien|ti\s+en|khoan)/i);
        if (m) return m[1].trim();
        return "";
    },

    parseAmount(val) {
        if (!val) return 0;
        const s = String(val).replace(/VND|USD|đ|₫|\s/gi, "");
        // Handle decimal formats like "8,300,000.00", "-116,000.00", "0.00"
        if (/^-?[\d,]+\.\d{1,2}$/.test(s)) {
            const num = parseFloat(s.replace(/,/g, ""));
            return isNaN(num) ? 0 : Math.round(Math.abs(num));
        }
        // Handle European/VN decimal formats like "8.300.000,00"
        if (/^-?[\d.]+,\d{1,2}$/.test(s)) {
            const num = parseFloat(s.replace(/\./g, "").replace(",", "."));
            return isNaN(num) ? 0 : Math.round(Math.abs(num));
        }
        const cleaned = s.replace(/[^\d]/g, "");
        return cleaned ? parseInt(cleaned, 10) : 0;
    },

    normalizeDate(str) {
        if (!str) return "";
        const s = str.trim();
        let m = s.match(/^(\d{2})[-/.](\d{2})[-/.](\d{4})(?:\s.*)?$/);
        if (m) return `${m[1]}/${m[2]}/${m[3]}`;
        m = s.match(/^(\d{4})[-/.](\d{2})[-/.](\d{2})(?:\s.*)?$/);
        if (m) return `${m[3]}/${m[2]}/${m[1]}`;
        return "";
    },

    /**
     * Generates a clean, readable note for MISA from raw transaction description.
     */
    buildShortNote(desc, counterparty) {
        let shortNote = desc || "";
        const combined = `${desc} ${counterparty}`.toLowerCase();
        if (combined.includes("du no the tin dung")) shortNote = "Thanh toán dư nợ thẻ tín dụng";
        else if (combined.includes("an toi")) shortNote = "Ăn tối";
        else if (combined.includes("luong")) shortNote = "Lương";
        else if (combined.includes("tien nha")) shortNote = "Tiền thuê nhà";
        else if (combined.includes("tin dung")) shortNote = "Thanh toán thẻ tín dụng";
        else if (combined.includes("tra no") || combined.includes("no hang thang")) shortNote = "Trả nợ ngân hàng";
        else if (combined.includes("tieu vat cua vo")) shortNote = "Tiêu vặt vợ";
        else if (combined.includes("tieu vat cua chong")) shortNote = "Tiêu vặt chồng";
        else if (combined.includes("mcdonald")) shortNote = "McDonald's";
        else if (combined.includes("dominos")) shortNote = "Domino's Pizza";
        else if (combined.includes("green sm")) shortNote = "Green SM (Xanh SM)";
        else if (combined.includes("maxvalu")) shortNote = "Siêu thị MaxValu";
        else if (combined.includes("gs25")) shortNote = "GS25";
        else if (combined.includes("shopeepay")) shortNote = "ShopeePay";
        else if (combined.includes("momo")) shortNote = "Nạp ví MoMo";
        else if (combined.includes("xang")) shortNote = "Đổ xăng";
        else if (combined.includes("banh ts")) shortNote = "Bánh trà sữa";
        else if (combined.includes("topi")) shortNote = "Tích lũy Topi";
        else if (/^Retail\s+VNM\s+/i.test(desc)) {
            shortNote = desc.replace(/^Retail\s+VNM\s+(?:HA\s+NOI|TP\.?\s*HCM|HO\s+CHI\s+MINH|DA\s+NANG|QUAN\s+\d+|P\.[\w\s]+?)\s+/i, "").trim();
        }
        return shortNote;
    },

    /**
     * Parses a PDF File or ArrayBuffer and returns structured transaction list.
     */
    async parsePDF(fileOrBuffer) {
        let arrayBuffer;
        if (fileOrBuffer instanceof ArrayBuffer) {
            arrayBuffer = fileOrBuffer;
        } else if (fileOrBuffer.arrayBuffer) {
            arrayBuffer = await fileOrBuffer.arrayBuffer();
        } else {
            throw new Error("Invalid input: must be File or ArrayBuffer");
        }

        // Configure PDF.js worker
        if (typeof pdfjsLib !== "undefined" && pdfjsLib.GlobalWorkerOptions) {
            if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
                pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL("lib/pdf.worker.min.js");
            }
        }

        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;
        const numPages = pdf.numPages;

        let fullRawText = "";
        let allLines = [];

        for (let p = 1; p <= numPages; p++) {
            const page = await pdf.getPage(p);
            const textContent = await page.getTextContent();
            const viewport = page.getViewport({ scale: 1.0 });

            // Extract words with coordinates
            // In PDF.js, y is from bottom-left, convert to top: viewport.height - y
            const items = textContent.items.map(item => {
                const x = item.transform[4];
                const y = item.transform[5];
                const top = viewport.height - y;
                fullRawText += item.str + " ";
                return {
                    text: item.str.trim(),
                    x: x,
                    width: item.width,
                    top: top
                };
            }).filter(i => i.text.length > 0);

            // Group into horizontal lines (within 3.5 points)
            const lineBuckets = {};
            for (const item of items) {
                const bucketTop = Math.round(item.top / 3.5) * 3.5;
                if (!lineBuckets[bucketTop]) lineBuckets[bucketTop] = [];
                lineBuckets[bucketTop].push(item);
            }

            const sortedTops = Object.keys(lineBuckets).map(Number).sort((a, b) => a - b);
            for (const top of sortedTops) {
                const lineItems = lineBuckets[top].sort((a, b) => a.x - b.x);
                const cols = ["", "", "", "", "", "", "", ""];
                for (const item of lineItems) {
                    const midX = item.x + (item.width / 2.0);
                    for (let c = 0; c < this.TECHCOMBANK_COLS.length - 1; c++) {
                        if (midX >= this.TECHCOMBANK_COLS[c] && midX < this.TECHCOMBANK_COLS[c + 1]) {
                            cols[c] += (cols[c] ? " " : "") + item.text;
                            break;
                        }
                    }
                }
                if (cols.some(c => c.length > 0)) {
                    allLines.push(cols);
                }
            }
        }

        // Extract metadata from header text
        let accNum = "";
        let accName = "";
        let period = "";
        const mAcc = fullRawText.match(/Số tài khoản\/?\s*Account no\.:?\s*(\S+)/i);
        if (mAcc) accNum = mAcc[1];
        const mName = fullRawText.match(/Tên khách hàng\/?\s*Customer name:?\s*([^Loại|Currency|\n]+)/i);
        if (mName) accName = mName[1].trim();
        const mPeriod = fullRawText.match(/Từ ngày\/?From date:?\s*([\d/]+)\s*-\s*Đến ngày\/?To date:?\s*([\d/]+)/i);
        if (mPeriod) period = `${mPeriod[1]} - ${mPeriod[2]}`;

        // Group rows into transactions
        const rawTxs = [];
        let currTx = null;
        let openingBal = 0;
        let endingBal = 0;

        for (const row of allLines) {
            const col0 = row[0].trim();
            if (/^(Transaction date|Ngày giao dịch)/i.test(col0)) continue;
            if (/^(Opening balance|Số dư đầu kỳ)/i.test(col0)) {
                openingBal = this.parseAmount(row[7] || row[row.length - 1]);
                continue;
            }
            if (/^(Ending balance|Số dư cuối kỳ)/i.test(col0)) {
                endingBal = this.parseAmount(row[7] || row[row.length - 1]);
                continue;
            }

            if (/^\d{2}\/\d{2}\/\d{4}$/.test(col0)) {
                currTx = {
                    date: col0,
                    counterparty: row[1].trim(),
                    bank: row[2].trim(),
                    desc: row[3].trim(),
                    ref: row[4].trim(),
                    debit: row[5].trim(),
                    credit: row[6].trim(),
                    balance: row[7].trim()
                };
                rawTxs.push(currTx);
            } else if (currTx) {
                // Continuation
                if (row[1]) currTx.counterparty += " " + row[1].trim();
                if (row[2]) currTx.bank += " " + row[2].trim();
                if (row[3]) currTx.desc += " " + row[3].trim();
                if (row[4]) currTx.ref += " " + row[4].trim();
                if (row[5]) currTx.debit += " " + row[5].trim();
                if (row[6]) currTx.credit += " " + row[6].trim();
                if (row[7]) currTx.balance += " " + row[7].trim();
            }
        }

        // Build clean transactions
        const transactions = [];
        let totalIncome = 0;
        let totalExpense = 0;

        for (let i = 0; i < rawTxs.length; i++) {
            const raw = rawTxs[i];
            const debit = this.parseAmount(raw.debit);
            const credit = this.parseAmount(raw.credit);
            const isThu = credit > 0;
            const amount = isThu ? credit : debit;
            
            if (isThu) totalIncome += amount;
            else totalExpense += amount;

            let counterparty = raw.counterparty.replace(/\s+/g, " ").trim();
            const desc = raw.desc.replace(/\s+/g, " ").trim();
            if (!counterparty) {
                counterparty = this.extractSender(desc);
            }

            const { category, misaCategory } = this.classify(isThu ? "Thu" : "Chi", desc, counterparty);
            const shortNote = this.buildShortNote(desc, counterparty);

            transactions.push({
                id: i + 1,
                date: raw.date,
                type: isThu ? "Thu" : "Chi",
                misaType: isThu ? "Collect" : "Spend",
                amount: amount,
                category: category,
                misaCategory: misaCategory,
                counterparty: counterparty,
                description: desc,
                note: shortNote,
                balance: this.parseAmount(raw.balance),
                ref: raw.ref,
                selected: true // Default selected for import
            });
        }

        return {
            account: {
                bank: "Techcombank",
                accountNumber: accNum,
                accountName: accName,
                period: period
            },
            summary: {
                openingBalance: openingBal,
                endingBalance: endingBal,
                totalIncome: totalIncome,
                totalExpense: totalExpense,
                netCashFlow: totalIncome - totalExpense,
                count: transactions.length
            },
            transactions: transactions
        };
    },

    /**
     * Parses pasted bank/credit-card statement text (tab-separated or space-separated rows).
     */
    parseText(rawText) {
        if (!rawText || !rawText.trim()) {
            throw new Error("Nội dung trống!");
        }

        const lines = rawText.replace(/\r\n/g, "\n").split("\n");
        const dateCellRe = /^(?:\d{2}[-/.]\d{2}[-/.]\d{4}|\d{4}[-/.]\d{2}[-/.]\d{2})(?:\s+\d{2}:\d{2}(?::\d{2})?)?$/;
        const amtTokenRe = /^-?[\d.,]+(?:\s*(?:VND|USD|đ|₫))?$/i;

        // Locate first transaction row
        let firstTxLineIdx = -1;
        let accNum = "";
        for (let i = 0; i < lines.length; i++) {
            const trimmed = lines[i].trim();
            if (!trimmed) continue;
            if (!accNum && /^\d{4,6}\*+\d{4}$/.test(trimmed)) {
                accNum = trimmed;
            }
            const firstCell = trimmed.split("\t")[0].trim();
            if (dateCellRe.test(firstCell)) {
                firstTxLineIdx = i;
                break;
            }
        }

        if (firstTxLineIdx === -1) {
            throw new Error("Không tìm thấy dòng giao dịch nào bắt đầu bằng ngày tháng (VD: 24-10-2026 hoặc 24/10/2026).");
        }

        // Parse header column positions if a tab-separated header block precedes the rows
        let headerCols = null;
        let descIdx = -1, refIdx = -1, debitIdx = -1, creditIdx = -1, amountIdx = -1, balanceIdx = -1;
        if (firstTxLineIdx > 0) {
            const headerBlock = lines.slice(0, firstTxLineIdx).join("\n");
            if (headerBlock.includes("\t")) {
                headerCols = headerBlock.split("\t").map(h => h.toLowerCase());
                headerCols.forEach((h, idx) => {
                    if (descIdx === -1 && /mô tả|description|diễn giải|nội dung|details/.test(h)) descIdx = idx;
                    else if (refIdx === -1 && /tham chiếu|ref\s*no/.test(h)) refIdx = idx;
                    else if (debitIdx === -1 && /ghi nợ|debit/.test(h)) debitIdx = idx;
                    else if (creditIdx === -1 && /ghi có|credit/.test(h)) creditIdx = idx;
                    else if (balanceIdx === -1 && /số dư|balance/.test(h)) balanceIdx = idx;
                    else if (amountIdx === -1 && /số tiền|amount/.test(h) && !/gốc|original/.test(h)) amountIdx = idx;
                });
            }
        }

        const transactions = [];
        let totalIncome = 0;
        let totalExpense = 0;

        for (let i = firstTxLineIdx; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            const cols = line.includes("\t")
                ? line.split("\t").map(c => c.trim())
                : line.split(/\s{2,}/).map(c => c.trim());

            if (cols.length < 2 || !dateCellRe.test(cols[0])) continue;

            const txDate = this.normalizeDate(cols[0]);
            const hasPostingDate = cols.length > 2 && dateCellRe.test(cols[1]);
            const defaultDescStart = hasPostingDate ? 2 : 1;

            let desc = "";
            let ref = "";
            let debit = 0;
            let credit = 0;
            let balance = 0;

            if (debitIdx !== -1 && creditIdx !== -1 && cols.length > Math.max(debitIdx, creditIdx)) {
                desc = (descIdx !== -1 && cols[descIdx]) ? cols[descIdx] : (cols[defaultDescStart] || "");
                ref = (refIdx !== -1 && cols[refIdx]) ? cols[refIdx] : "";
                debit = this.parseAmount(cols[debitIdx]);
                credit = this.parseAmount(cols[creditIdx]);
                if (balanceIdx !== -1 && cols[balanceIdx]) balance = this.parseAmount(cols[balanceIdx]);
            } else {
                // Fallback heuristic when header is missing or partial
                desc = cols[defaultDescStart] || "";
                const tailCols = cols.slice(defaultDescStart + 1);
                const numericTail = [];
                for (let j = tailCols.length - 1; j >= 0; j--) {
                    if (amtTokenRe.test(tailCols[j])) {
                        numericTail.unshift(tailCols[j]);
                    } else {
                        break;
                    }
                }
                if (tailCols.length > numericTail.length && /^\d{4,}$/.test(tailCols[0])) {
                    ref = tailCols[0];
                }

                if (numericTail.length >= 2) {
                    debit = this.parseAmount(numericTail[numericTail.length - 2]);
                    credit = this.parseAmount(numericTail[numericTail.length - 1]);
                } else if (numericTail.length === 1) {
                    const rawAmt = numericTail[0];
                    const parsed = this.parseAmount(rawAmt);
                    if (rawAmt.trim().startsWith("-")) debit = parsed;
                    else credit = parsed;
                }
            }

            desc = desc.replace(/\s+/g, " ").trim();
            const isThu = credit > 0 && debit === 0 ? true : (debit > 0 && credit === 0 ? false : credit > debit);
            const amount = isThu ? credit : debit;
            if (!txDate || amount <= 0) continue;

            if (isThu) totalIncome += amount;
            else totalExpense += amount;

            const counterparty = this.extractSender(desc);
            const { category, misaCategory } = this.classify(isThu ? "Thu" : "Chi", desc, counterparty);
            const shortNote = this.buildShortNote(desc, counterparty);

            transactions.push({
                id: transactions.length + 1,
                date: txDate,
                type: isThu ? "Thu" : "Chi",
                misaType: isThu ? "Collect" : "Spend",
                amount: amount,
                category: category,
                misaCategory: misaCategory,
                counterparty: counterparty,
                description: desc,
                note: shortNote,
                balance: balance,
                ref: ref,
                selected: true
            });
        }

        if (transactions.length === 0) {
            throw new Error("Không trích xuất được giao dịch hợp lệ nào từ nội dung đã dán.");
        }

        return {
            account: {
                bank: accNum ? `Thẻ ${accNum}` : "Sao kê copy",
                accountNumber: accNum,
                accountName: "",
                period: ""
            },
            summary: {
                openingBalance: 0,
                endingBalance: 0,
                totalIncome: totalIncome,
                totalExpense: totalExpense,
                netCashFlow: totalIncome - totalExpense,
                count: transactions.length
            },
            transactions: transactions
        };
    }
};

if (typeof window !== "undefined") {
    window.BankPDFParser = BankPDFParser;
}
