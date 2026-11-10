/**
 * Page Bridge Script (Runs in MAIN WORLD of moneykeeperapp.misa.vn).
 * Has direct access to window, localStorage, session cookies, and Vue 3 component tree.
 */

(function () {
    console.log("[MISA Page Bridge] Khởi chạy trong ngữ cảnh trang web (MAIN WORLD)...");

    let cachedAccounts = [];

    // Helper: Format VND currency
    function formatCurrency(n) {
        if (n == null || isNaN(n)) return "";
        try {
            return new Intl.NumberFormat("vi-VN").format(n) + " đ";
        } catch (e) {
            return `${n} đ`;
        }
    }

    // -------------------------------------------------------------
    // 1. EXTRACT AUTHENTICATION INFO FROM CURRENT SESSION
    // -------------------------------------------------------------
    function extractAuthInfo() {
        let token = "";
        let clientId = "";

        // a. Extract JWT token from localStorage (MISA saves it under 'moneykeeper_userInfo' or 'userInfo')
        try {
            const prefix = window._appConfig?.appPrefix || "moneykeeper_";
            const keysToTry = [`${prefix}userInfo`, "userInfo", "moneykeeper_user", "user"];
            for (const key of keysToTry) {
                const raw = localStorage.getItem(key);
                if (raw) {
                    try {
                        const parsed = JSON.parse(raw);
                        if (parsed && parsed.accessToken) {
                            token = parsed.accessToken;
                            break;
                        }
                    } catch (e) {}
                }
            }
        } catch (e) {}

        // b. Fallback: Scan all localStorage items for any object containing accessToken
        if (!token) {
            try {
                for (let i = 0; i < localStorage.length; i++) {
                    const k = localStorage.key(i);
                    if (!k) continue;
                    const v = localStorage.getItem(k);
                    if (v && v.includes("accessToken")) {
                        try {
                            const parsed = JSON.parse(v);
                            if (parsed?.accessToken) {
                                token = parsed.accessToken;
                                break;
                            }
                        } catch (e) {}
                    }
                }
            } catch (e) {}
        }

        // c. Fallback: Scan sessionStorage
        if (!token) {
            try {
                for (let i = 0; i < sessionStorage.length; i++) {
                    const k = sessionStorage.key(i);
                    if (!k) continue;
                    const v = sessionStorage.getItem(k);
                    if (v && v.includes("accessToken")) {
                        try {
                            const parsed = JSON.parse(v);
                            if (parsed?.accessToken) {
                                token = parsed.accessToken;
                                break;
                            }
                        } catch (e) {}
                    }
                }
            } catch (e) {}
        }

        // d. Extract X-MISA-ClientId from cookie or localStorage
        try {
            const match = document.cookie.match(/(?:^|;\s*)X-MISA-ClientId=([^;]+)/);
            if (match && match[1]) {
                clientId = decodeURIComponent(match[1]);
            }
        } catch (e) {}

        if (!clientId) {
            try {
                const storedCid = localStorage.getItem("X-MISA-ClientId");
                if (storedCid) clientId = storedCid;
            } catch (e) {}
        }

        if (!clientId) {
            clientId = "f7107d06-a458-4f26-996f-88f61a5218b9";
        }

        return { token, clientId };
    }

    // -------------------------------------------------------------
    // 2. FETCH ACCOUNTS FROM MISA API USING SESSION AUTH
    // -------------------------------------------------------------
    async function fetchAccountsFromApi() {
        try {
            const { token, clientId } = extractAuthInfo();
            console.log("[MISA Page Bridge] Gọi API /wallets/accounts với auth phiên đăng nhập:", {
                hasToken: !!token,
                clientId: clientId
            });

            const headers = {
                "accept": "application/json, text/plain, */*",
                "content-type": "application/json",
                "x-misa-clientdevicetype": "Web",
                "x-misa-clientdevicename": navigator.userAgent,
                "x-misa-clientversion": window._appConfig?.version || "1.0.0",
                "x-misa-clientid": clientId.startsWith("Web_") ? clientId : `Web_${clientId}`
            };

            if (token) {
                headers["authorization"] = `Bearer ${token}`;
            }

            const response = await fetch("https://moneykeeperapp.misa.vn/g1/api/business/api/v1/wallets/accounts", {
                method: "POST",
                headers: headers,
                credentials: "include",
                body: JSON.stringify({
                    searchText: "",
                    walletType: null,
                    inActive: null,
                    excludeReport: null,
                    skip: 0,
                    take: 100
                })
            });

            if (!response.ok) {
                console.warn(`[MISA Page Bridge] API /wallets/accounts trả về HTTP ${response.status}`);
                return null;
            }

            const rawList = await response.json();
            if (!Array.isArray(rawList)) {
                console.warn("[MISA Page Bridge] Dữ liệu trả về không phải là mảng:", rawList);
                return null;
            }

            console.log(`[MISA Page Bridge] ✅ API /wallets/accounts trả về ${rawList.length} tài khoản thành công!`);

            // Sort active accounts first, then inactive
            const sorted = [...rawList].sort((a, b) => {
                if (a.inActive === b.inActive) return 0;
                return a.inActive ? 1 : -1;
            });

            const normalized = sorted.map(item => {
                const label = item.walletName || item.label || "";
                const desc = item.bankName || (item.currentAmount != null ? formatCurrency(item.currentAmount) : "");
                return {
                    label: label.trim(),
                    describe: desc.trim(),
                    value: item.walletId,
                    walletId: item.walletId,
                    walletName: item.walletName,
                    bankName: item.bankName,
                    currentAmount: item.currentAmount,
                    currencyCode: item.currencyCode,
                    inActive: item.inActive,
                    raw: item
                };
            }).filter(a => a.label.length > 0);

            return normalized;
        } catch (err) {
            console.error("[MISA Page Bridge] Lỗi gọi API /wallets/accounts:", err);
            return null;
        }
    }

    // -------------------------------------------------------------
    // 3. FALLBACK: EXTRACT ACCOUNTS FROM VUE TREE
    // -------------------------------------------------------------
    function checkComponentForAccounts(comp) {
        if (!comp) return null;
        const compName = comp.type?.name || comp.type?.__name;

        if (compName === "MsSearchableSelect") {
            const data = comp.props?.data || comp.setupState?.data || comp.ctx?.data;
            if (Array.isArray(data) && data.length > 0) {
                const first = data[0];
                if (first && (first.label || first.walletName || first.walletId || first.describe)) {
                    return data;
                }
            }
        }

        if (compName === "AddSpendCollect") {
            const accData = comp.setupState?.accountData?.value || comp.setupState?.accountData;
            if (Array.isArray(accData) && accData.length > 0) {
                return accData;
            }
        }

        return null;
    }

    function extractAccountsFromVueTree() {
        const gridEls = Array.from(document.querySelectorAll(".grid-viewer, .grid-viewer *, table, table *"));
        for (const el of gridEls) {
            let comp = el.__vueParentComponent || el.__vnode?.component;
            while (comp) {
                const found = checkComponentForAccounts(comp);
                if (found) return normalizeVueData(found);
                comp = comp.parent;
            }
        }
        return [];
    }

    function normalizeVueData(rawData) {
        if (!Array.isArray(rawData)) return [];
        return rawData.map(item => {
            const label = item.label || item.walletName || item.name || "";
            const desc = item.describe || (item.currentAmount ? `${item.currentAmount} đ` : "");
            const val = item.value || item.walletId || label;
            return {
                label: label.trim(),
                describe: desc.trim(),
                value: val,
                walletId: item.walletId || val,
                walletName: item.walletName || label,
                raw: item
            };
        }).filter(a => a.label.length > 0);
    }

    // -------------------------------------------------------------
    // 4. SCAN & BROADCAST ACCOUNTS TO CONTENT SCRIPT
    // -------------------------------------------------------------
    async function scanAndBroadcast() {
        // Priority 1: Fetch via MISA API using session authen
        let accounts = await fetchAccountsFromApi();

        // Priority 2: Fallback to Vue component scanning if API fails
        if (!accounts || accounts.length === 0) {
            console.log("[MISA Page Bridge] API chưa trả về kết quả, thử quét Vue tree...");
            accounts = extractAccountsFromVueTree();
        }

        if (accounts && accounts.length > 0) {
            cachedAccounts = accounts;
            window.__MISA_ACCOUNTS__ = accounts;
            console.log(`[MISA Page Bridge] Phát sự kiện MISA_EXT_ACCOUNTS_LOADED với ${accounts.length} tài khoản.`);
            window.dispatchEvent(new CustomEvent("MISA_EXT_ACCOUNTS_LOADED", {
                detail: { accounts: accounts }
            }));
            return accounts;
        }

        return [];
    }

    // -------------------------------------------------------------
    // 5. DIRECT VUE ROW FILLING
    // -------------------------------------------------------------
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
            const accountsList = comp.setupState?.accountData?.value || comp.setupState?.accountData || cachedAccounts;
            const categoriesList = comp.setupState?.categoriesData?.value || comp.setupState?.categoriesData || [];

            if (tableRows && tableRows[rowIdx]) {
                const row = tableRows[rowIdx];
                // 1. Amount
                if (txData.amount) {
                    row.amount = typeof txData.amount === "number" ? txData.amount : parseInt(txData.amount, 10);
                }

                // 2. Transaction Date
                if (txData.date) {
                    const parts = txData.date.split("/");
                    if (parts.length === 3) {
                        row.transactionDate = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10), 12, 0);
                    }
                }

                // 3. Description
                row.description = txData.note || txData.description || "";

                // 4. Account matching
                if (chosenAccountLabel && accountsList.length > 0) {
                    const target = chosenAccountLabel.toLowerCase();
                    const matchedAcc = accountsList.find(a => (a.label || a.walletName || "").toLowerCase().includes(target)) || accountsList[0];
                    if (matchedAcc) {
                        row.account = {
                            value: matchedAcc.value || matchedAcc.walletId,
                            label: matchedAcc.label || matchedAcc.walletName,
                            describe: matchedAcc.describe || matchedAcc.bankName || "",
                            currentAmount: matchedAcc.currentAmount,
                            currencyCode: matchedAcc.currencyCode
                        };
                        console.log(`[MISA Page Bridge] ✅ Đã gán row[${rowIdx}].account =`, row.account);
                    }
                } else if (accountsList.length > 0 && !row.account) {
                    const first = accountsList[0];
                    row.account = {
                        value: first.value || first.walletId,
                        label: first.label || first.walletName,
                        describe: first.describe || first.bankName || "",
                        currentAmount: first.currentAmount,
                        currencyCode: first.currencyCode
                    };
                }

                // 5. Category matching
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

    // -------------------------------------------------------------
    // 6. EVENT LISTENERS & DEBUG EXPOSURE
    // -------------------------------------------------------------
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

    window.__MISA_EXT_BRIDGE__ = {
        fetchAccountsFromApi,
        extractAuthInfo,
        scanAndBroadcast,
        getCachedAccounts: () => cachedAccounts
    };

    // Auto-scan on load
    setTimeout(scanAndBroadcast, 400);
    setTimeout(scanAndBroadcast, 1800);
})();
