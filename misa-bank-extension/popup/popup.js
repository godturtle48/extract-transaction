/**
 * Popup Script for MISA Bank Extension
 */

let transactions = [];
let activeTabIsMisa = false;
let currentActiveTabId = null;

const MISA_URL = "https://moneykeeperapp.misa.vn/management/add-transaction";

function formatVND(n) {
    return new Intl.NumberFormat("vi-VN").format(n) + " đ";
}

// Check active tab
async function checkActiveTab() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.url && tab.url.includes("moneykeeperapp.misa.vn/management/add-transaction")) {
            activeTabIsMisa = true;
            currentActiveTabId = tab.id;
            const statusEl = document.getElementById("misaStatus");
            statusEl.className = "status-pill status-connected";
            document.getElementById("misaStatusText").textContent = "Đã kết nối MISA";
            document.getElementById("misaNavBanner").style.display = "none";
            loadAccountsFromMisaTab();
        } else {
            activeTabIsMisa = false;
            const statusEl = document.getElementById("misaStatus");
            statusEl.className = "status-pill status-disconnected";
            document.getElementById("misaStatusText").textContent = "Chưa mở MISA";
            document.getElementById("misaNavBanner").style.display = "flex";
            populateDefaultAccounts();
        }
    } catch (e) {
        console.error("Tab query error", e);
        populateDefaultAccounts();
    }
}

function loadAccountsFromMisaTab() {
    chrome.tabs.sendMessage(currentActiveTabId, { action: "get_accounts" }, (response) => {
        if (chrome.runtime.lastError || !response || !response.accounts || response.accounts.length === 0) {
            populateAccountOptions([]);
            return;
        }
        populateAccountOptions(response.accounts);
    });
}

function populateAccountOptions(accounts) {
    const sel = document.getElementById("popupAccountSelect");
    if (!sel) return;
    sel.innerHTML = `<option value="">-- Giữ nguyên tài khoản mặc định MISA --</option>`;

    if (!accounts || accounts.length === 0) {
        const opt = document.createElement("option");
        opt.value = "";
        opt.disabled = true;
        opt.textContent = "-- Chưa lấy được danh sách (mở MISA để đồng bộ) --";
        sel.appendChild(opt);
        return;
    }

    accounts.forEach(acc => {
        const label = typeof acc === "string" ? acc : (acc.label || acc.walletName || acc.name || "");
        if (!label) return;
        const opt = document.createElement("option");
        opt.value = label;
        opt.textContent = `🏦 ${label}`;
        sel.appendChild(opt);
    });

    if (accounts.length > 0) {
        const first = accounts[0];
        sel.value = typeof first === "string" ? first : (first.label || "");
    }
}

async function handleFile(file) {
    if (!file || !file.name.toLowerCase().endsWith(".pdf")) {
        alert("Vui lòng chọn file PDF sao kê!");
        return;
    }
    const loading = document.getElementById("popupLoading");
    loading.style.display = "block";
    document.getElementById("txSection").style.display = "none";

    try {
        const res = await BankPDFParser.parsePDF(file);
        transactions = res.transactions;
        showTransactions();
    } catch (err) {
        console.error(err);
        alert("Lỗi khi đọc file PDF: " + err.message);
    } finally {
        loading.style.display = "none";
    }
}

function showTransactions() {
    document.getElementById("txSection").style.display = "flex";
    renderList();
    updateKpi();
}

function updateKpi() {
    let inc = 0, exp = 0, selCount = 0;
    transactions.forEach(t => {
        if (t.selected) {
            selCount++;
            if (t.type === "Thu") inc += t.amount;
            else exp += t.amount;
        }
    });

    document.getElementById("kpiIncome").textContent = "+" + formatVND(inc);
    document.getElementById("kpiExpense").textContent = "-" + formatVND(exp);
    document.getElementById("kpiSelected").textContent = `${selCount}/${transactions.length}`;

    const btn = document.getElementById("btnFillMisa");
    btn.disabled = selCount === 0;
    btn.innerHTML = `<span>⚡ Tự động điền ${selCount} giao dịch vào MISA</span>`;
}

let activeTypeFilter = "all";

function renderList() {
    const listEl = document.getElementById("txList");
    listEl.innerHTML = "";

    const filtered = transactions.filter(t => {
        if (activeTypeFilter !== "all" && t.type !== activeTypeFilter) return false;
        return true;
    });

    filtered.forEach(t => {
        const isThu = t.type === "Thu";
        const div = document.createElement("div");
        div.className = "tx-item";
        div.innerHTML = `
            <input type="checkbox" class="tx-cb" data-id="${t.id}" ${t.selected ? "checked" : ""}>
            <span class="tx-badge ${isThu ? 'tx-badge-thu' : 'tx-badge-chi'}">${t.type}</span>
            <div class="tx-info">
                <div class="tx-info-top">
                    <span class="tx-amt" style="color: ${isThu ? '#16a34a' : '#dc2626'};">
                        ${isThu ? '+' : '-'}${formatVND(t.amount)}
                    </span>
                    <span style="font-size: 10px; color: #64748b;">${t.date}</span>
                </div>
                <div class="tx-desc">
                    <span class="tx-cat">${t.misaCategory || t.category}</span>
                    <span>${t.note || t.description}</span>
                </div>
            </div>
        `;
        listEl.appendChild(div);
    });

    listEl.querySelectorAll(".tx-cb").forEach(cb => {
        cb.addEventListener("change", (e) => {
            const id = parseInt(e.target.dataset.id, 10);
            const item = transactions.find(x => x.id === id);
            if (item) item.selected = e.target.checked;
            updateKpi();
        });
    });
}

// Auto Fill button clicked in popup
async function onFillMisa() {
    const selected = transactions.filter(t => t.selected);
    if (selected.length === 0) {
        alert("Vui lòng chọn ít nhất 1 giao dịch!");
        return;
    }

    if (!activeTabIsMisa) {
        // Open MISA tab and tell user
        if (confirm("Bạn cần mở trang 'Ghi chép hàng loạt' của MISA để điền tự động. Mở ngay?")) {
            chrome.tabs.create({ url: MISA_URL });
        }
        return;
    }

    // Send message to content script
    try {
        const chosenAccount = document.getElementById("popupAccountSelect") ? document.getElementById("popupAccountSelect").value : "";
        await chrome.tabs.sendMessage(currentActiveTabId, {
            action: "fill_transactions",
            transactions: selected,
            chosenAccount: chosenAccount
        });
        window.close(); // Close popup so user sees the MISA screen filling!
    } catch (err) {
        console.error("Message error", err);
        alert("Không thể gửi dữ liệu tới trang MISA. Hãy tải lại trang MISA và thử lại!");
    }
}

// Init
document.addEventListener("DOMContentLoaded", () => {
    checkActiveTab();

    const dropzone = document.getElementById("popupDropzone");
    const fileInput = document.getElementById("popupFileInput");
    dropzone.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", (e) => {
        if (e.target.files.length > 0) handleFile(e.target.files[0]);
    });

    document.getElementById("btnOpenMisa").addEventListener("click", () => {
        chrome.tabs.create({ url: MISA_URL });
    });

    document.getElementById("checkAll").addEventListener("change", (e) => {
        const val = e.target.checked;
        transactions.forEach(t => t.selected = val);
        renderList();
        updateKpi();
    });

    document.querySelectorAll(".filter-pills .pill").forEach(pill => {
        pill.addEventListener("click", (e) => {
            document.querySelectorAll(".filter-pills .pill").forEach(p => p.classList.remove("active"));
            e.target.classList.add("active");
            activeTypeFilter = e.target.dataset.type;
            renderList();
        });
    });

    document.getElementById("btnFillMisa").addEventListener("click", onFillMisa);
});
