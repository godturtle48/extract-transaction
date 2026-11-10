/**
 * Page Bridge Script (Runs in MAIN WORLD of moneykeeperapp.misa.vn).
 * Has direct access to Vue 3 component tree, MsSearchableSelect, props.data, and reactive state.
 */

(function () {
    console.log("[MISA Page Bridge] Khởi chạy trong ngữ cảnh trang web (MAIN WORLD)...");

    function checkComponentForAccounts(comp) {
        if (!comp) return null;

        const compName = comp.type?.name || comp.type?.__name;

        // 1. Check if component is MsSearchableSelect
        if (compName === "MsSearchableSelect") {
            const data = comp.props?.data || comp.setupState?.data || comp.ctx?.data;
            if (Array.isArray(data) && data.length > 0) {
                const first = data[0];
                if (first && (first.label || first.walletName || first.walletId || first.describe)) {
                    console.log("[MISA Page Bridge] ✅ Tìm thấy MsSearchableSelect với props.data:", data);
                    return data;
                }
            }
        }

        // 2. Check if component is AddSpendCollect (Parent component containing all data)
        if (compName === "AddSpendCollect") {
            const accData = comp.setupState?.accountData?.value || comp.setupState?.accountData;
            if (Array.isArray(accData) && accData.length > 0) {
                console.log("[MISA Page Bridge] ✅ Tìm thấy AddSpendCollect với accountData:", accData);
                return accData;
            }
        }

        return null;
    }

    function extractAccountsFromVueTree() {
        // Search elements in grid viewer
        const gridEls = Array.from(document.querySelectorAll(".grid-viewer, .grid-viewer *, table, table *"));
        for (const el of gridEls) {
            let comp = el.__vueParentComponent || el.__vnode?.component;
            while (comp) {
                const found = checkComponentForAccounts(comp);
                if (found) return normalize(found);
                comp = comp.parent;
            }
        }

        // Broader scan if not found in grid
        const allEls = Array.from(document.querySelectorAll("body *"));
        for (const el of allEls) {
            const comp = el.__vueParentComponent || el.__vnode?.component;
            if (comp) {
                const found = checkComponentForAccounts(comp);
                if (found) return normalize(found);
            }
        }

        return [];
    }

    function normalize(rawData) {
        if (!Array.isArray(rawData)) return [];
        return rawData.map(item => {
            const label = item.label || item.walletName || item.name || "";
            const desc = item.describe || (item.currentAmount ? `${item.currentAmount} đ` : "");
            const val = item.value || item.walletId || label;
            return {
                label: label.trim(),
                describe: desc.trim(),
                value: val,
                raw: {
                    label: item.label,
                    value: item.value,
                    walletId: item.walletId,
                    walletName: item.walletName
                }
            };
        }).filter(a => a.label.length > 0);
    }

    function scanAndBroadcast() {
        const accounts = extractAccountsFromVueTree();
        console.log(`[MISA Page Bridge] Quét được ${accounts.length} tài khoản từ Vue MsSearchableSelect / AddSpendCollect:`, accounts);
        window.dispatchEvent(new CustomEvent("MISA_EXT_ACCOUNTS_LOADED", {
            detail: { accounts: accounts }
        }));
        return accounts;
    }

    // Direct Vue-level row filling for complete manual-like fidelity
    function setVueRowData(rowIdx, txData, chosenAccountLabel) {
        try {
            const gridEl = document.querySelector(".grid-viewer");
            if (!gridEl) return false;
            let comp = gridEl.__vueParentComponent || gridEl.__vnode?.component;
            while (comp && comp.type?.name !== "AddSpendCollect") {
                comp = comp.parent;
            }
            if (!comp) return false;

            const tableRows = comp.setupState?.data?.value;
            const accountsList = comp.setupState?.accountData?.value || comp.setupState?.accountData || [];
            const categoriesList = comp.setupState?.categoriesData?.value || comp.setupState?.categoriesData || [];

            if (tableRows && tableRows[rowIdx]) {
                const row = tableRows[rowIdx];
                // 1. Amount as number
                if (txData.amount) {
                    row.amount = typeof txData.amount === "number" ? txData.amount : parseInt(txData.amount, 10);
                }

                // 2. Transaction Date as valid Date object
                if (txData.date) {
                    const parts = txData.date.split("/");
                    if (parts.length === 3) {
                        row.transactionDate = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10), 12, 0);
                    }
                }

                // 3. Description string
                row.description = txData.note || txData.description || "";

                // 4. Match Account object ({ value: walletId, label: walletName, ... })
                if (chosenAccountLabel && accountsList.length > 0) {
                    const matchedAcc = accountsList.find(a => (a.label || a.walletName || "").toLowerCase().includes(chosenAccountLabel.toLowerCase())) || accountsList[0];
                    if (matchedAcc) {
                        row.account = matchedAcc;
                        console.log(`[MISA Page Bridge] ✅ Đã gán row[${rowIdx}].account =`, matchedAcc.label);
                    }
                } else if (accountsList.length > 0 && !row.account) {
                    row.account = accountsList[0];
                }

                // 5. Match Category object ({ value: categoryId, label: name, type: 0/1 })
                if (categoriesList.length > 0) {
                    const targetCat = (txData.misaCategory || txData.category || "").toLowerCase();
                    const isThu = txData.type === "Thu";
                    const targetType = isThu ? 1 : 0;
                    let matchedCat = categoriesList.find(c => {
                        const matchType = (c.type === targetType);
                        const matchName = (c.label || c.name || "").toLowerCase().includes(targetCat);
                        return matchType && matchName;
                    });
                    if (!matchedCat) {
                        matchedCat = categoriesList.find(c => (c.label || c.name || "").toLowerCase().includes(targetCat)) || categoriesList[0];
                    }
                    if (matchedCat) {
                        row.category = matchedCat;
                        console.log(`[MISA Page Bridge] ✅ Đã gán row[${rowIdx}].category =`, matchedCat.label);
                    }
                }
                return true;
            }
        } catch (e) {
            console.warn("[MISA Page Bridge] Lỗi gán trực tiếp qua Vue:", e);
        }
        return false;
    }

    // Listen to requests from content.js
    window.addEventListener("MISA_EXT_REQUEST_ACCOUNTS", () => {
        scanAndBroadcast();
    });

    window.addEventListener("MISA_EXT_FILL_VUE_ROW", (e) => {
        const { rowIdx, txData, chosenAccount } = e.detail || {};
        const success = setVueRowData(rowIdx, txData, chosenAccount);
        window.dispatchEvent(new CustomEvent("MISA_EXT_VUE_ROW_FILLED", {
            detail: { rowIdx, success }
        }));
    });

    // Initial scan after delay for Vue to mount
    setTimeout(scanAndBroadcast, 800);
    setTimeout(scanAndBroadcast, 2000);
})();
