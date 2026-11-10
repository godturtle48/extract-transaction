/**
 * Content Script for MISA MoneyKeeper (moneykeeperapp.misa.vn/management/add-transaction)
 * Injects floating assistant, scans MISA accounts/wallets, parses bank statement,
 * and auto-fills MISA transaction grid with full fidelity identical to manual entry.
 */

(function () {
    let extractedTransactions = [];
    let isFilling = false;
    let availableAccounts = [];
    let availableCategories = [];

    // Helper: Sleep
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Check if we are on add-transaction page
    function isAddTransactionPage() {
        return window.location.href.includes("/management/add-transaction");
    }

    // Embed floating button
    function injectFloatingButton() {
        if (document.getElementById("misa-bank-floating-btn")) return;
        if (!isAddTransactionPage()) return;

        const iconUrl = chrome.runtime.getURL("icons/icon48.png");
        const btn = document.createElement("button");
        btn.id = "misa-bank-floating-btn";
        btn.innerHTML = `
            <img src="${iconUrl}" style="width: 20px; height: 20px; object-fit: contain; vertical-align: middle;" alt="Logo">
            <span>Nhập từ Sao kê Ngân hàng</span>
        `;
        btn.addEventListener("click", openDrawer);
        document.body.appendChild(btn);
    }

    // Embed drawer overlay
    function injectDrawer() {
        if (document.getElementById("misa-bank-drawer-overlay")) return;

        const iconUrl = chrome.runtime.getURL("icons/icon48.png");
        const overlay = document.createElement("div");
        overlay.id = "misa-bank-drawer-overlay";
        overlay.innerHTML = `
            <div id="misa-bank-drawer">
                <div class="mbd-header">
                    <div class="mbd-title">
                        <img src="${iconUrl}" style="width: 24px; height: 24px; object-fit: contain; vertical-align: middle;" alt="Logo">
                        <span>Trợ Lý Điền Sao Kê Vào Sổ Thu Chi MISA</span>
                    </div>
                    <button class="mbd-close-btn" id="mbdCloseBtn">&times;</button>
                </div>

                <div class="mbd-body">
                    <!-- Account / Wallet Combobox from MISA -->
                    <div class="mbd-account-bar">
                        <div class="mbd-account-label">
                            <span>🏦 Tài khoản / Ví ghi sổ:</span>
                        </div>
                        <div class="mbd-account-control">
                            <select id="mbdAccountSelect" class="mbd-account-select">
                                <option value="">-- Đang quét tài khoản từ MISA... --</option>
                            </select>
                            <button type="button" id="mbdRefreshAccounts" class="mbd-btn-refresh" title="Quét lại danh sách ví từ MISA">🔄 Quét lại</button>
                        </div>
                    </div>

                    <!-- Dropzone -->
                    <div class="mbd-dropzone" id="mbdDropzone">
                        <input type="file" id="mbdFileInput" accept=".pdf" style="display: none;">
                        <div style="font-size: 28px; margin-bottom: 6px;">📄</div>
                        <div style="font-size: 14px; font-weight: 700; color: #008FD3;">Kéo thả file PDF sao kê vào đây hoặc bấm để chọn file</div>
                        <div style="font-size: 12px; color: #64748b; margin-top: 4px;">Tự động nhận diện Techcombank, Vietcombank, MBBank, BIDV...</div>
                    </div>

                    <div id="mbdLoading" style="display: none; text-align: center; padding: 20px; font-weight: 600; color: #008FD3;">
                        ⏳ Đang đọc và phân tích file PDF...
                    </div>

                    <!-- Results Section -->
                    <div id="mbdResults" style="display: none;">
                        <div class="mbd-stats">
                            <div class="mbd-stat-card">
                                <div class="mbd-stat-label">Tổng giao dịch</div>
                                <div class="mbd-stat-val" id="mbdStatCount">0</div>
                            </div>
                            <div class="mbd-stat-card">
                                <div class="mbd-stat-label">Tổng thu (+)</div>
                                <div class="mbd-stat-val" style="color: #16a34a;" id="mbdStatIncome">+0 đ</div>
                            </div>
                            <div class="mbd-stat-card">
                                <div class="mbd-stat-label">Tổng chi (-)</div>
                                <div class="mbd-stat-val" style="color: #dc2626;" id="mbdStatExpense">-0 đ</div>
                            </div>
                            <div class="mbd-stat-card">
                                <div class="mbd-stat-label">Đã chọn điền</div>
                                <div class="mbd-stat-val" style="color: #008FD3;" id="mbdStatSelected">0</div>
                            </div>
                        </div>

                        <div class="mbd-controls">
                            <div style="display: flex; gap: 8px; align-items: center;">
                                <label style="font-size: 12px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px;">
                                    <input type="checkbox" id="mbdCheckAll" checked> Chọn tất cả
                                </label>
                                <select id="mbdFilterType" style="padding: 4px 8px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px;">
                                    <option value="all">Tất cả (Thu & Chi)</option>
                                    <option value="Thu">Chỉ tiền Thu (+)</option>
                                    <option value="Chi">Chỉ tiền Chi (-)</option>
                                </select>
                            </div>
                            <input type="text" id="mbdSearch" placeholder="🔍 Tìm kiếm..." style="padding: 4px 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px; width: 180px;">
                        </div>

                        <div class="mbd-table-wrapper">
                            <table class="mbd-table">
                                <thead>
                                    <tr>
                                        <th style="width: 35px; text-align: center;">Chọn</th>
                                        <th style="width: 80px;">Ngày</th>
                                        <th style="width: 50px;">Loại</th>
                                        <th style="width: 110px; text-align: right;">Số tiền</th>
                                        <th style="width: 130px;">Hạng mục MISA</th>
                                        <th>Ghi chú / Diễn giải</th>
                                        <th style="width: 60px; text-align: center;">Thao tác</th>
                                    </tr>
                                </thead>
                                <tbody id="mbdTableBody"></tbody>
                            </table>
                        </div>
                    </div>
                </div>

                <div class="mbd-footer">
                    <span id="mbdFooterInfo" style="font-size: 12px; color: #64748b;">Chọn các giao dịch bạn muốn ghi sổ.</span>
                    <button class="mbd-btn-fill" id="mbdBtnFill" disabled>
                        <span>⚡ Tự động điền vào bảng MISA</span>
                    </button>
                </div>
            </div>
        `;
        document.body.appendChild(overlay);

        // Bind events
        document.getElementById("mbdCloseBtn").addEventListener("click", closeDrawer);
        overlay.addEventListener("click", (e) => {
            if (e.target === overlay) closeDrawer();
        });

        const dropzone = document.getElementById("mbdDropzone");
        const fileInput = document.getElementById("mbdFileInput");
        dropzone.addEventListener("click", () => fileInput.click());
        fileInput.addEventListener("change", (e) => {
            if (e.target.files.length > 0) handleFile(e.target.files[0]);
        });
        ["dragenter", "dragover"].forEach(name => {
            dropzone.addEventListener(name, (e) => { e.preventDefault(); dropzone.classList.add("dragover"); });
        });
        ["dragleave", "drop"].forEach(name => {
            dropzone.addEventListener(name, (e) => { e.preventDefault(); dropzone.classList.remove("dragover"); });
        });
        dropzone.addEventListener("drop", (e) => {
            if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
        });

        document.getElementById("mbdCheckAll").addEventListener("change", (e) => {
            const checked = e.target.checked;
            extractedTransactions.forEach(t => t.selected = checked);
            renderTable();
            updateStats();
        });

        document.getElementById("mbdFilterType").addEventListener("change", renderTable);
        document.getElementById("mbdSearch").addEventListener("input", renderTable);
        document.getElementById("mbdRefreshAccounts").addEventListener("click", () => scanMisaAccounts(true));
        document.getElementById("mbdBtnFill").addEventListener("click", () => executeAutoFill());
    }

    // -------------------------------------------------------------
    // DYNAMIC TABLE COLUMN DETECTORS BY HEADER NAME
    // -------------------------------------------------------------

    function getColumnIndexByName(keyword, defaultIdx) {
        const ths = Array.from(document.querySelectorAll(".grid-viewer table thead th, table thead th"));
        console.log(`[MISA Ext] Đang dò cột '${keyword}' trong số ${ths.length} tiêu đề cột:`, ths.map(t => t.textContent.trim()));
        for (let i = 0; i < ths.length; i++) {
            const text = ths[i].textContent.trim().toLowerCase();
            if (text.includes(keyword.toLowerCase())) {
                console.log(`[MISA Ext] -> Khớp cột '${keyword}' tại index [${i}] (${ths[i].textContent.trim()})`);
                return i;
            }
        }
        console.warn(`[MISA Ext] -> Không tìm thấy cột '${keyword}', dùng index mặc định [${defaultIdx}]`);
        return defaultIdx;
    }

    function getAmountColumnIndex() { return getColumnIndexByName("số tiền", 1); }
    function getCategoryColumnIndex() { return getColumnIndexByName("hạng mục", 2); }
    function getAccountColumnIndex() { return getColumnIndexByName("tài khoản", 3); }
    function getDateColumnIndex() { return getColumnIndexByName("thời gian", 4); }
    function getDescriptionColumnIndex() { return getColumnIndexByName("diễn giải", 5); }

    // -------------------------------------------------------------
    // EXTRACT DIRECTLY FROM MsSearchableSelect.props.data IN VUE 3
    // (100% CSP COMPLIANT: Uses Chrome Manifest V3 MAIN world bridge)
    // -------------------------------------------------------------

    function requestAccountsFromPageBridge() {
        return new Promise((resolve) => {
            const handler = (e) => {
                window.removeEventListener("MISA_EXT_ACCOUNTS_LOADED", handler);
                const accs = e.detail?.accounts || [];
                console.log("[MISA Ext] Nhận kết quả từ page_bridge:", accs);
                resolve(accs);
            };
            window.addEventListener("MISA_EXT_ACCOUNTS_LOADED", handler);

            // Request via CustomEvent (zero inline scripts, completely safe against CSP)
            window.dispatchEvent(new CustomEvent("MISA_EXT_REQUEST_ACCOUNTS"));

            // Timeout after 1.2s if no response
            setTimeout(() => {
                window.removeEventListener("MISA_EXT_ACCOUNTS_LOADED", handler);
                resolve([]);
            }, 1200);
        });
    }

    async function scanMisaAccounts(force = false) {
        const selectEl = document.getElementById("mbdAccountSelect");
        if (!selectEl) return;

        selectEl.innerHTML = `<option value="">⏳ Đang trích xuất từ component MsSearchableSelect...</option>`;

        // 1. Trích xuất trực tiếp từ component MsSearchableSelect và biến data trong Vue 3
        const vueAccounts = await requestAccountsFromPageBridge();
        if (vueAccounts.length > 0) {
            console.log(`[MISA Ext] ✅ Đã lấy thành công ${vueAccounts.length} tài khoản từ MsSearchableSelect.data:`, vueAccounts);
            availableAccounts = vueAccounts.map(a => a.label);
            populateAccountSelect(vueAccounts);
            return;
        }

        // 2. Fallback: Dò từ ô trên bảng
        const accountsSet = new Set();
        const accColIdx = getAccountColumnIndex();
        const rows = Array.from(document.querySelectorAll(".grid-viewer tbody tr, table tbody tr"));

        rows.forEach((row, rIdx) => {
            const tds = row.querySelectorAll("td");
            if (tds[accColIdx]) {
                const cell = tds[accColIdx];
                const input = cell.querySelector("input");
                const val = input ? (input.value || input.placeholder) : cell.textContent.trim();
                if (val && !val.includes("Chọn tài khoản") && !val.includes("Lựa chọn") && val.trim().length > 1) {
                    accountsSet.add(val.trim());
                }
            }
        });

        const fallbackList = Array.from(accountsSet);
        if (fallbackList.length > 0) {
            availableAccounts = fallbackList;
            populateAccountSelect(fallbackList);
        } else {
            selectEl.innerHTML = `<option value="">-- Chưa tìm thấy tài khoản (hãy mở trang Ghi chép hàng loạt) --</option>`;
        }
    }

    function populateAccountSelect(accounts) {
        const selectEl = document.getElementById("mbdAccountSelect");
        if (!selectEl) return;
        selectEl.innerHTML = "";

        // Add auto/default option
        const optDefault = document.createElement("option");
        optDefault.value = "";
        optDefault.textContent = "-- Giữ nguyên tài khoản mặc định của MISA --";
        selectEl.appendChild(optDefault);

        accounts.forEach(acc => {
            const label = typeof acc === "string" ? acc : (acc.label || acc.walletName || acc.name || "");
            const desc = (typeof acc === "object" && acc.describe) ? ` (${acc.describe})` : "";
            const opt = document.createElement("option");
            opt.value = label;
            opt.textContent = `🏦 ${label}${desc}`;
            selectEl.appendChild(opt);
        });

        // Auto-select Techcombank if available
        const tcbOpt = accounts.find(a => {
            const l = (typeof a === "string" ? a : (a.label || "")).toLowerCase();
            return l.includes("techcombank") || l.includes("tcb");
        });
        if (tcbOpt) {
            selectEl.value = typeof tcbOpt === "string" ? tcbOpt : tcbOpt.label;
        } else if (accounts.length > 0) {
            const first = accounts[0];
            selectEl.value = typeof first === "string" ? first : first.label;
        }
    }

    function openDrawer() {
        injectDrawer();
        const overlay = document.getElementById("misa-bank-drawer-overlay");
        overlay.style.display = "flex";
        scanMisaAccounts();
    }

    function closeDrawer() {
        const overlay = document.getElementById("misa-bank-drawer-overlay");
        if (overlay) overlay.style.display = "none";
    }

    function formatVND(n) {
        return new Intl.NumberFormat("vi-VN").format(n) + " đ";
    }

    async function handleFile(file) {
        if (!file || !file.name.toLowerCase().endsWith(".pdf")) {
            alert("Vui lòng chọn file PDF sao kê!");
            return;
        }

        const loading = document.getElementById("mbdLoading");
        loading.style.display = "block";
        document.getElementById("mbdResults").style.display = "none";

        try {
            const result = await BankPDFParser.parsePDF(file);
            extractedTransactions = result.transactions;
            displayResults(result);
        } catch (err) {
            console.error(err);
            alert("Lỗi khi đọc file PDF: " + err.message);
        } finally {
            loading.style.display = "none";
        }
    }

    function displayResults(data) {
        document.getElementById("mbdResults").style.display = "block";
        document.getElementById("mbdStatCount").textContent = data.summary.count;
        document.getElementById("mbdStatIncome").textContent = "+" + formatVND(data.summary.totalIncome);
        document.getElementById("mbdStatExpense").textContent = "-" + formatVND(data.summary.totalExpense);
        renderTable();
        updateStats();
    }

    function updateStats() {
        const selected = extractedTransactions.filter(t => t.selected);
        document.getElementById("mbdStatSelected").textContent = selected.length;
        const btnFill = document.getElementById("mbdBtnFill");
        btnFill.disabled = selected.length === 0;
        btnFill.innerHTML = `<span>⚡ Tự động điền ${selected.length} giao dịch vào MISA</span>`;
        document.getElementById("mbdFooterInfo").textContent = `Đã chọn ${selected.length}/${extractedTransactions.length} giao dịch.`;
    }

    function renderTable() {
        const filterType = document.getElementById("mbdFilterType").value;
        const query = (document.getElementById("mbdSearch").value || "").toLowerCase();
        const tbody = document.getElementById("mbdTableBody");
        tbody.innerHTML = "";

        const filtered = extractedTransactions.filter(t => {
            if (filterType !== "all" && t.type !== filterType) return false;
            if (query) {
                const combined = `${t.date} ${t.category} ${t.misaCategory} ${t.note} ${t.description}`.toLowerCase();
                if (!combined.includes(query)) return false;
            }
            return true;
        });

        filtered.forEach(t => {
            const tr = document.createElement("tr");
            const isThu = t.type === "Thu";
            tr.innerHTML = `
                <td style="text-align: center;">
                    <input type="checkbox" class="tx-check" data-id="${t.id}" ${t.selected ? "checked" : ""}>
                </td>
                <td>${t.date}</td>
                <td><span class="mbd-badge ${isThu ? 'mbd-badge-thu' : 'mbd-badge-chi'}">${t.type}</span></td>
                <td style="text-align: right; font-weight: 700; color: ${isThu ? '#16a34a' : '#dc2626'};">
                    ${isThu ? '+' : '-'}${formatVND(t.amount)}
                </td>
                <td>
                    <input type="text" class="tx-misa-cat" data-id="${t.id}" value="${t.misaCategory || t.category}" style="width: 100%; font-size: 11px; padding: 4px 6px; border: 1px solid #cbd5e1; border-radius: 4px;">
                </td>
                <td>
                    <input type="text" class="tx-note" data-id="${t.id}" value="${t.note || t.description}" style="width: 100%; font-size: 11px; padding: 4px 6px; border: 1px solid #cbd5e1; border-radius: 4px;">
                </td>
                <td style="text-align: center;">
                    <button type="button" class="btn-fill-single" data-id="${t.id}" style="background: #f1f5f9; border: 1px solid #cbd5e1; padding: 3px 6px; border-radius: 4px; font-size: 11px; cursor: pointer; font-weight: 600;" title="Điền riêng giao dịch này vào dòng đầu tiên">Điền</button>
                </td>
            `;
            tbody.appendChild(tr);
        });

        // Bind checkbox listeners
        tbody.querySelectorAll(".tx-check").forEach(cb => {
            cb.addEventListener("change", (e) => {
                const id = parseInt(e.target.dataset.id, 10);
                const item = extractedTransactions.find(x => x.id === id);
                if (item) item.selected = e.target.checked;
                updateStats();
            });
        });

        // Bind input listeners
        tbody.querySelectorAll(".tx-misa-cat").forEach(inp => {
            inp.addEventListener("change", (e) => {
                const id = parseInt(e.target.dataset.id, 10);
                const item = extractedTransactions.find(x => x.id === id);
                if (item) item.misaCategory = e.target.value;
            });
        });

        tbody.querySelectorAll(".tx-note").forEach(inp => {
            inp.addEventListener("change", (e) => {
                const id = parseInt(e.target.dataset.id, 10);
                const item = extractedTransactions.find(x => x.id === id);
                if (item) item.note = e.target.value;
            });
        });

        // Single fill button
        tbody.querySelectorAll(".btn-fill-single").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const id = parseInt(e.target.dataset.id, 10);
                const item = extractedTransactions.find(x => x.id === id);
                if (item) executeAutoFill([item]);
            });
        });
    }

    // Helper: simulate user typing & input events with complete fidelity
    function setInputValue(input, val) {
        if (!input) return;
        input.focus();
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
        if (nativeSetter) {
            nativeSetter.call(input, val);
        } else {
            input.value = val;
        }
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        input.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: "Enter", code: "Enter" }));
        input.dispatchEvent(new Event("blur", { bubbles: true }));
    }

    function showToast(msg) {
        const toast = document.createElement("div");
        toast.className = "mbd-toast";
        toast.innerHTML = `<span>${msg}</span>`;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 4500);
    }

    // -------------------------------------------------------------
    // ROBUST AUTO-FILL FIELD SETTERS
    // -------------------------------------------------------------

    // 1. Amount
    async function fillRowAmount(row, amount) {
        const amtColIdx = getAmountColumnIndex();
        const tds = Array.from(row.querySelectorAll("td"));
        const cell = tds[amtColIdx] || row;
        const moneyInput = cell.querySelector(".money-input input") || cell.querySelector("input");
        if (moneyInput) {
            setInputValue(moneyInput, amount.toString());
            await sleep(60);
        }
    }

    // 2. Account / Wallet Selection
    async function fillRowAccount(row, chosenAccount) {
        if (!chosenAccount) return;
        const accColIdx = getAccountColumnIndex();
        const tds = Array.from(row.querySelectorAll("td"));
        const accCell = tds[accColIdx];
        if (!accCell) return;

        const clickTarget = accCell.querySelector("input") || accCell.querySelector(".dropdown") || accCell;
        clickTarget.click();
        await sleep(150);

        // Find matching option in dropdown
        const options = Array.from(document.querySelectorAll(
            ".item-custom.account, .item-custom, .ms-dropdown-menu li, .con-ms-dropdown--menu .item-custom"
        ));
        const target = chosenAccount.toLowerCase();
        let matched = options.find(opt => opt.textContent.toLowerCase().includes(target));

        if (matched) {
            matched.click();
            await sleep(100);
        } else {
            // Also try typing into input if searchable
            const input = accCell.querySelector("input");
            if (input) {
                setInputValue(input, chosenAccount);
                await sleep(100);
                const firstOpt = document.querySelector(".item-custom.account, .item-custom, .ms-dropdown-menu li");
                if (firstOpt) firstOpt.click();
            }
            document.body.click();
        }
    }

    // 3. Category Selection
    async function fillRowCategory(row, txType, categoryName) {
        if (!categoryName) return;
        const catColIdx = getCategoryColumnIndex();
        const tds = Array.from(row.querySelectorAll("td"));
        const catCell = tds[catColIdx];
        if (!catCell) return;

        const clickTarget = catCell.querySelector("input") || catCell.querySelector(".dropdown") || catCell;
        clickTarget.click();
        await sleep(150);

        // Switch Tab: Chi tiền (Spend) or Thu tiền (Collect)
        const isThu = txType === "Thu";
        const targetTabTitle = isThu ? "Thu tiền" : "Chi tiền";
        const tabs = Array.from(document.querySelectorAll(".item-tab, .tab-item, [class*='tab']"));
        const matchingTab = tabs.find(t => t.textContent.includes(targetTabTitle));
        if (matchingTab) {
            matchingTab.click();
            await sleep(120);
        }

        // Find matching option
        const options = Array.from(document.querySelectorAll(".item-custom, .ms-dropdown-menu .item-custom, .ms-select-item"));
        const target = categoryName.toLowerCase();

        // 1. Exact match
        let matched = options.find(opt => opt.textContent.trim().toLowerCase() === target);
        // 2. Contains match
        if (!matched) {
            matched = options.find(opt => opt.textContent.toLowerCase().includes(target));
        }
        // 3. Partial keyword match
        if (!matched) {
            const words = target.split(/\s+/).filter(w => w.length > 2);
            for (const w of words) {
                matched = options.find(opt => opt.textContent.toLowerCase().includes(w));
                if (matched) break;
            }
        }

        if (matched) {
            matched.click();
            await sleep(100);
        } else {
            clickTarget.blur();
            document.body.click();
        }
    }

    // 4. Transaction Date
    async function fillRowDate(row, dateStr) {
        if (!dateStr) return;
        const dateColIdx = getDateColumnIndex();
        const tds = Array.from(row.querySelectorAll("td"));
        const cell = tds[dateColIdx] || row;
        const dateInput = cell.querySelector(".datepicker input") || cell.querySelector("input");
        if (dateInput) {
            const fullDate = dateStr.includes(":") ? dateStr : `${dateStr} 12:00`;
            setInputValue(dateInput, fullDate);
            await sleep(60);
        }
    }

    // 5. Description / Note
    async function fillRowDescription(row, desc) {
        if (!desc) return;
        const descColIdx = getDescriptionColumnIndex();
        const tds = Array.from(row.querySelectorAll("td"));
        const cell = tds[descColIdx] || row;
        const descInput = cell.querySelector("input[placeholder*='diễn giải' i]") || cell.querySelector("input");
        if (descInput) {
            setInputValue(descInput, desc);
            await sleep(60);
        }
    }

    // -------------------------------------------------------------
    // MAIN AUTO-FILL ENGINE
    // -------------------------------------------------------------
    async function executeAutoFill(customList = null) {
        const selected = customList || extractedTransactions.filter(t => t.selected);
        if (selected.length === 0) {
            alert("Vui lòng chọn ít nhất 1 giao dịch!");
            return;
        }

        if (isFilling) return;
        isFilling = true;
        closeDrawer();

        const chosenAccount = document.getElementById("mbdAccountSelect") ? document.getElementById("mbdAccountSelect").value : "";

        showToast(`⚡ Đang chuẩn bị điền ${selected.length} giao dịch vào bảng MISA...`);

        // Find table rows
        let rows = Array.from(document.querySelectorAll(".grid-viewer tbody tr"));
        if (!rows || rows.length === 0) {
            alert("Không tìm thấy bảng nhập liệu trên trang MISA! Hãy đảm bảo bạn đang ở trang 'Ghi chép hàng loạt' (/management/add-transaction).");
            isFilling = false;
            return;
        }

        // Add rows if needed
        const addRowBtn = document.querySelector(".content-add-row .add-row");
        while (rows.length < selected.length && addRowBtn) {
            addRowBtn.click();
            await sleep(120);
            rows = Array.from(document.querySelectorAll(".grid-viewer tbody tr"));
        }

        for (let i = 0; i < selected.length; i++) {
            const tx = selected[i];
            const row = rows[i];
            if (!row) break;

            showToast(`✍️ Đang điền dòng ${i + 1}/${selected.length}: ${tx.type} ${formatVND(tx.amount)}...`);

            // Step 0: Direct Vue 3 reactive model update (in Main World)
            window.dispatchEvent(new CustomEvent("MISA_EXT_FILL_VUE_ROW", {
                detail: { rowIdx: i, txData: tx, chosenAccount: chosenAccount }
            }));

            // Step 1: Fill Amount
            await fillRowAmount(row, tx.amount);

            // Step 2: Fill Account (if selected)
            if (chosenAccount) {
                await fillRowAccount(row, chosenAccount);
            }

            // Step 3: Fill Date
            await fillRowDate(row, tx.date);

            // Step 4: Fill Category
            await fillRowCategory(row, tx.type, tx.misaCategory || tx.category);

            // Step 5: Fill Description
            await fillRowDescription(row, tx.note || tx.description);

            // Visual Highlight
            row.classList.add("misa-bank-filled-row");
            await sleep(80);
        }

        isFilling = false;
        showToast(`🎉 Đã điền xong ${selected.length} giao dịch! Bạn hãy kiểm tra lại và bấm 'Lưu' trên MISA.`);
    }

    // Listen for messages from extension popup
    if (typeof chrome !== "undefined" && chrome.runtime && chrome.runtime.onMessage) {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.action === "open_drawer") {
                openDrawer();
                sendResponse({ status: "opened" });
            } else if (request.action === "get_accounts") {
                scanMisaAccounts().then(() => {
                    sendResponse({ accounts: availableAccounts });
                });
                return true;
            } else if (request.action === "fill_transactions") {
                if (request.transactions && request.transactions.length > 0) {
                    if (request.chosenAccount) {
                        const sel = document.getElementById("mbdAccountSelect");
                        if (sel) sel.value = request.chosenAccount;
                    }
                    executeAutoFill(request.transactions);
                    sendResponse({ status: "filling" });
                }
            }
            return true;
        });
    }

    // Initialize observer & History API listener for SPA navigation
    function init() {
        // Intercept pushState & replaceState for Vue Router client-side navigation
        const origPush = history.pushState;
        history.pushState = function () {
            origPush.apply(this, arguments);
            window.dispatchEvent(new Event("misa_url_change"));
        };
        const origReplace = history.replaceState;
        history.replaceState = function () {
            origReplace.apply(this, arguments);
            window.dispatchEvent(new Event("misa_url_change"));
        };
        window.addEventListener("popstate", () => window.dispatchEvent(new Event("misa_url_change")));

        function checkPage() {
            if (isAddTransactionPage()) {
                injectFloatingButton();
            } else {
                const btn = document.getElementById("misa-bank-floating-btn");
                if (btn) btn.remove();
            }
        }

        window.addEventListener("misa_url_change", checkPage);

        checkPage();
        const observer = new MutationObserver(() => checkPage());
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // -------------------------------------------------------------
    // EXPOSE CONSOLE DEBUG UTILITIES FOR EASY TESTING IN F12
    // -------------------------------------------------------------
    window.__MISA_EXT_DEBUG__ = {
        scanAccounts: () => scanMisaAccounts(true),
        getColumns: () => ({
            amount: getAmountColumnIndex(),
            category: getCategoryColumnIndex(),
            account: getAccountColumnIndex(),
            date: getDateColumnIndex(),
            description: getDescriptionColumnIndex()
        }),
        openDrawer: () => openDrawer(),
        closeDrawer: () => closeDrawer(),
        testFillRow: async (rowIdx = 0, customTx = null) => {
            const rows = Array.from(document.querySelectorAll(".grid-viewer tbody tr, table tbody tr"));
            if (!rows[rowIdx]) {
                console.error(`Không tìm thấy dòng ${rowIdx}`);
                return;
            }
            const tx = customTx || (extractedTransactions && extractedTransactions[0]);
            if (!tx) {
                console.warn("[DEBUG] Chưa có giao dịch nào được tải từ PDF. Hãy nạp file PDF hoặc truyền tx: testFillRow(0, { amount: 50000, type: 'Chi', misaCategory: 'Ăn uống', date: '01/01/2026', note: '...' })");
                return;
            }
            const acc = document.getElementById("mbdAccountSelect")?.value || (availableAccounts[0] && (availableAccounts[0].label || availableAccounts[0])) || "";
            console.log(`[DEBUG] Đang thử điền vào dòng ${rowIdx + 1}:`, tx, "Tài khoản:", acc);
            await fillRowAmount(rows[rowIdx], tx.amount);
            if (acc) await fillRowAccount(rows[rowIdx], acc);
            await fillRowDate(rows[rowIdx], tx.date);
            await fillRowCategory(rows[rowIdx], tx.type, tx.misaCategory);
            await fillRowDescription(rows[rowIdx], tx.note);
            rows[rowIdx].classList.add("misa-bank-filled-row");
            console.log(`[DEBUG] ✅ Hoàn tất thử nghiệm điền dòng ${rowIdx + 1}!`);
        }
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
