// =====================================================
// 共用工具函數
// =====================================================

// 日期格式化函數
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
}

// 民國日期轉西元 Date 物件 (例如 1141201 → 2025/12/01)
function rocToDate(rocDateStr) {
    if (!rocDateStr || rocDateStr.length < 7) return null;
    const rocYear = parseInt(rocDateStr.substring(0, rocDateStr.length - 4), 10);
    const month = parseInt(rocDateStr.substring(rocDateStr.length - 4, rocDateStr.length - 2), 10);
    const day = parseInt(rocDateStr.substring(rocDateStr.length - 2), 10);
    if (isNaN(rocYear) || isNaN(month) || isNaN(day)) return null;
    const westernYear = rocYear + 1911;
    return new Date(westernYear, month - 1, day);
}

// 民國日期格式化顯示 (例如 1141201 → 114/12/01)
function formatRocDate(rocDateStr) {
    if (!rocDateStr || rocDateStr.length < 7) return rocDateStr || '';
    const rocYear = rocDateStr.substring(0, rocDateStr.length - 4);
    const month = rocDateStr.substring(rocDateStr.length - 4, rocDateStr.length - 2);
    const day = rocDateStr.substring(rocDateStr.length - 2);
    return `${rocYear}/${month}/${day}`;
}

// 增加天數
function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

// 計算兩個日期之間的天數差
function daysBetween(date1, date2) {
    const oneDay = 24 * 60 * 60 * 1000;
    return Math.round((date2 - date1) / oneDay);
}

// =====================================================
// 分頁1: 領藥計算機（原有功能）
// =====================================================

// 初始化實際領藥日期輸入欄位
function initializeActualDatesInputs() {
    const totalRefills = parseInt(document.getElementById('totalRefills').value);
    const actualDatesInputs = document.getElementById('actualDatesInputs');
    actualDatesInputs.innerHTML = '';

    for (let i = 1; i <= totalRefills; i++) {
        const div = document.createElement('div');
        div.className = 'form-group';
        div.innerHTML = `
            <label for="actualDate${i}">第 ${i} 回實際領藥日：</label>
            <input type="date" id="actualDate${i}" ${i === 1 ? 'required' : ''}>
            ${i > 1 ? '<span class="hint">(選填)</span>' : ''}
        `;
        actualDatesInputs.appendChild(div);
    }
}

// 計算領藥資訊
function calculateRefills() {
    const prescriptionDate = new Date(document.getElementById('prescriptionDate').value);
    const daysPerRefill = parseInt(document.getElementById('daysPerRefill').value);
    const totalRefills = parseInt(document.getElementById('totalRefills').value);

    if (!prescriptionDate || !daysPerRefill || !totalRefills) {
        alert('請填寫所有必填欄位');
        return;
    }

    // 收集實際領藥日期
    const actualDates = [];
    for (let i = 1; i <= totalRefills; i++) {
        const dateInput = document.getElementById(`actualDate${i}`).value;
        if (dateInput) {
            actualDates.push(new Date(dateInput));
        } else {
            actualDates.push(null);
        }
    }

    // 計算處方效期
    const prescriptionExpiry = addDays(prescriptionDate, daysPerRefill * totalRefills);

    // 計算每回的領藥資訊
    const refills = [];
    let previousMedicineEndDate = null;

    for (let i = 0; i < totalRefills; i++) {
        const refillNumber = i + 1;
        let expectedPickupStart, expectedPickupEnd, medicineEndDate = null;
        let originalExpectedPickupEnd = null;
        let normalPickupStart = null;
        let normalPickupEnd = null;
        let isDelayed = false;
        let delayMessage = '';
        let hasActualPickup = actualDates[i] !== null;

        if (i === 0) {
            expectedPickupStart = prescriptionDate;
            if (actualDates[0]) {
                medicineEndDate = addDays(actualDates[0], daysPerRefill);
                expectedPickupEnd = medicineEndDate;
                originalExpectedPickupEnd = medicineEndDate;
                previousMedicineEndDate = medicineEndDate;
            } else {
                expectedPickupEnd = addDays(prescriptionDate, daysPerRefill);
                originalExpectedPickupEnd = expectedPickupEnd;
                previousMedicineEndDate = expectedPickupEnd;
            }
        } else {
            let baseEndDate = refills[0].originalExpectedPickupEnd;
            for (let j = 1; j < i; j++) {
                baseEndDate = addDays(baseEndDate, daysPerRefill);
            }
            normalPickupStart = addDays(baseEndDate, -10);
            normalPickupEnd = baseEndDate;

            if (previousMedicineEndDate) {
                expectedPickupStart = addDays(previousMedicineEndDate, -10);
                expectedPickupEnd = previousMedicineEndDate;
                originalExpectedPickupEnd = expectedPickupEnd;

                const previousRefill = refills[i - 1];
                const isPreviousDelayed = previousRefill && previousRefill.actualPickupDate &&
                                         previousRefill.actualPickupDate > previousRefill.originalExpectedPickupEnd;

                if (actualDates[i]) {
                    const actualPickup = actualDates[i];
                    if (actualPickup > expectedPickupEnd) {
                        medicineEndDate = addDays(actualPickup, daysPerRefill);
                        previousMedicineEndDate = medicineEndDate;
                    } else {
                        medicineEndDate = addDays(expectedPickupEnd, daysPerRefill);
                        previousMedicineEndDate = medicineEndDate;
                    }
                } else {
                    if (isPreviousDelayed) {
                        const adjustedPickupStart = addDays(previousMedicineEndDate, -10);
                        const adjustedPickupEnd = previousMedicineEndDate;
                        delayMessage = `因上回領藥延遲，本次領藥區間為 ${formatDate(adjustedPickupStart)} ~ ${formatDate(adjustedPickupEnd)}`;
                        isDelayed = true;
                        const nextPickupEnd = addDays(adjustedPickupEnd, daysPerRefill);
                        normalPickupStart = addDays(nextPickupEnd, -10);
                        normalPickupEnd = nextPickupEnd;
                    }
                    const assumedMedicineEnd = addDays(previousMedicineEndDate, daysPerRefill);
                    previousMedicineEndDate = assumedMedicineEnd;
                    medicineEndDate = null;
                }
            } else {
                expectedPickupStart = null;
                expectedPickupEnd = null;
                medicineEndDate = null;
            }
        }

        let isExpired = false;
        let isPartiallyExpired = false;

        if (expectedPickupStart && expectedPickupEnd) {
            if (expectedPickupStart > prescriptionExpiry) {
                isExpired = true;
            } else if (expectedPickupEnd > prescriptionExpiry) {
                isPartiallyExpired = true;
                if (delayMessage) {
                    const adjustedStart = expectedPickupStart > prescriptionExpiry ? prescriptionExpiry : expectedPickupStart;
                    delayMessage = `因上回領藥延遲，本次領藥區間為 ${formatDate(adjustedStart)} ~ ${formatDate(prescriptionExpiry)}`;
                }
                expectedPickupEnd = prescriptionExpiry;
            }
        }

        refills.push({
            number: refillNumber,
            expectedPickupStart,
            expectedPickupEnd,
            originalExpectedPickupEnd,
            normalPickupStart,
            normalPickupEnd,
            medicineEndDate,
            actualPickupDate: actualDates[i],
            isDelayed,
            delayMessage,
            hasActualPickup,
            isExpired,
            isPartiallyExpired
        });
    }

    displayResults(prescriptionDate, prescriptionExpiry, daysPerRefill, totalRefills, refills);
}

// 顯示結果
function displayResults(prescriptionDate, prescriptionExpiry, daysPerRefill, totalRefills, refills) {
    const resultsDiv = document.getElementById('results');
    const prescriptionInfo = document.getElementById('prescriptionInfo');
    const ganttChart = document.getElementById('ganttChart');
    const refillDetails = document.getElementById('refillDetails');

    prescriptionInfo.innerHTML = `
        <div class="info-card">
            <p><strong>處方開立日：</strong>${formatDate(prescriptionDate)}</p>
            <p><strong>處方效期：</strong>${formatDate(prescriptionExpiry)}</p>
            <p><strong>每次領藥天數：</strong>${daysPerRefill} 天</p>
            <p><strong>可領回數：</strong>${totalRefills} 回</p>
        </div>
    `;

    generateGanttChart(ganttChart, refills, prescriptionDate, prescriptionExpiry);

    let detailsHTML = '<div class="details-container">';
    refills.forEach(refill => {
        if (refill.expectedPickupStart && refill.expectedPickupEnd) {
            const warningClass = refill.isDelayed ? 'warning' : '';
            const hasActualPickup = refill.actualPickupDate !== null;

            detailsHTML += `
                <div class="refill-card ${warningClass}">
                    <h3>第 ${refill.number} 回</h3>`;

            if (refill.isExpired && !hasActualPickup) {
                detailsHTML += `<p class="delay-warning">因上回領藥延遲，第 ${refill.number} 回處方過期無法領藥</p>`;
            } else if (refill.delayMessage && !hasActualPickup) {
                detailsHTML += `<p class="delay-warning">${refill.delayMessage}</p>`;
            } else if (refill.number > 1 && !hasActualPickup) {
                detailsHTML += `<p><strong>建議領藥期間：</strong>${formatDate(refill.expectedPickupStart)} ~ ${formatDate(refill.expectedPickupEnd)}</p>`;
            }

            detailsHTML += `
                    ${hasActualPickup ? `<p><strong>實際領藥日：</strong>${formatDate(refill.actualPickupDate)}</p>` : ''}
                    ${refill.medicineEndDate ? `<p><strong>藥品用完日：</strong>${formatDate(refill.medicineEndDate)}</p>` : ''}`;

            if (refill.number === totalRefills) {
                if (hasActualPickup && refill.medicineEndDate) {
                    const nextPickupStart = addDays(refill.medicineEndDate, -10);
                    const nextPickupEnd = refill.medicineEndDate;
                    detailsHTML += `<p><strong>回診時間：</strong>${formatDate(nextPickupStart)} ~ ${formatDate(nextPickupEnd)}</p>`;
                } else if (refill.isExpired) {
                    const previousRefill = refills[refill.number - 2];
                    if (previousRefill && previousRefill.medicineEndDate) {
                        const nextPickupStart = addDays(previousRefill.medicineEndDate, -10);
                        const nextPickupEnd = previousRefill.medicineEndDate;
                        detailsHTML += `<p><strong>回診時間：</strong>${formatDate(nextPickupStart)} ~ ${formatDate(nextPickupEnd)}</p>`;
                    }
                }
            }

            if (!hasActualPickup && refill.number > 1 && !refill.isExpired) {
                const previousRefill = refills[refill.number - 2];
                if (previousRefill && !previousRefill.actualPickupDate) {
                    detailsHTML += `<p class="hint">※ 此為預估時間，假設第 ${refill.number - 1} 回於建議期間最後一天領藥</p>`;
                }
            }

            if (refill.number > 1) {
                detailsHTML += `<p class="hint">可在藥品用完前10天回診領藥</p>`;
            }

            detailsHTML += `</div>`;
        }
    });
    detailsHTML += '</div>';
    refillDetails.innerHTML = detailsHTML;
    resultsDiv.style.display = 'block';
}

// 生成甘特圖
function generateGanttChart(container, refills, prescriptionDate, prescriptionExpiry) {
    const startDate = prescriptionDate;
    let endDate = prescriptionExpiry;
    refills.forEach(refill => {
        if (refill.medicineEndDate && refill.medicineEndDate > endDate) {
            endDate = refill.medicineEndDate;
        }
    });

    const totalDays = daysBetween(startDate, endDate);

    let chartHTML = '<div class="gantt-container">';
    chartHTML += '<div class="gantt-header">領藥時間甘特圖</div>';
    chartHTML += '<div class="gantt-chart">';

    chartHTML += '<div class="timeline">';
    const monthMarkers = [];
    let currentDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);

    monthMarkers.push({ date: new Date(startDate), position: 0 });

    while (currentDate <= endDate) {
        const position = (daysBetween(startDate, currentDate) / totalDays) * 100;
        monthMarkers.push({ date: new Date(currentDate), position });
        currentDate.setMonth(currentDate.getMonth() + 1);
    }

    monthMarkers.forEach(marker => {
        chartHTML += `<div class="timeline-marker" style="left: ${marker.position}%">${formatDate(marker.date)}</div>`;
    });
    chartHTML += '</div>';

    refills.forEach(refill => {
        chartHTML += `
            <div class="gantt-row">
                <div class="gantt-label">第 ${refill.number} 回</div>
                <div class="gantt-bars">`;

        if (refill.expectedPickupStart && refill.expectedPickupEnd) {
            const pickupStartPos = (daysBetween(startDate, refill.expectedPickupStart) / totalDays) * 100;
            const pickupEndPos = (daysBetween(startDate, refill.expectedPickupEnd) / totalDays) * 100;
            const pickupWidth = pickupEndPos - pickupStartPos;

            if (refill.actualPickupDate) {
                const actualPickupPos = (daysBetween(startDate, refill.actualPickupDate) / totalDays) * 100;
                const medicineEndPos = (daysBetween(startDate, refill.medicineEndDate) / totalDays) * 100;
                const medicineWidth = medicineEndPos - actualPickupPos;

                chartHTML += `
                    <div class="gantt-bar medicine"
                         style="left: ${actualPickupPos}%; width: ${medicineWidth}%"
                         title="用藥期間: ${formatDate(refill.actualPickupDate)} ~ ${formatDate(refill.medicineEndDate)}">
                        <span class="bar-label">用藥中</span>
                    </div>`;

                chartHTML += `
                    <div class="gantt-marker actual"
                         style="left: ${actualPickupPos}%"
                         title="實際領藥: ${formatDate(refill.actualPickupDate)}">
                    </div>`;

                if (refill.number === refills.length && refill.medicineEndDate) {
                    const nextPickupStart = addDays(refill.medicineEndDate, -10);
                    const nextPickupEnd = refill.medicineEndDate;
                    const nextPickupStartPos = (daysBetween(startDate, nextPickupStart) / totalDays) * 100;
                    const nextPickupEndPos = (daysBetween(startDate, nextPickupEnd) / totalDays) * 100;
                    const nextPickupWidth = nextPickupEndPos - nextPickupStartPos;

                    chartHTML += `
                    <div class="gantt-bar pickup"
                         style="left: ${nextPickupStartPos}%; width: ${nextPickupWidth}%"
                         title="回診期間: ${formatDate(nextPickupStart)} ~ ${formatDate(nextPickupEnd)}">
                        <span class="bar-label">回診</span>
                    </div>`;
                }
            } else {
                if (refill.isExpired) {
                    chartHTML += `
                    <div class="gantt-bar expired"
                         style="left: 95%; width: 5%"
                         title="處方過期">
                        <span class="bar-label">過期</span>
                    </div>`;
                } else {
                    const delayClass = refill.isDelayed ? 'delayed' : '';
                    chartHTML += `
                    <div class="gantt-bar pickup ${delayClass}"
                         style="left: ${pickupStartPos}%; width: ${pickupWidth}%"
                         title="領藥期間: ${formatDate(refill.expectedPickupStart)} ~ ${formatDate(refill.expectedPickupEnd)}">
                        <span class="bar-label">可領藥</span>
                    </div>`;
                }
            }
        }

        chartHTML += `</div></div>`;
    });

    chartHTML += '</div></div>';
    container.innerHTML = chartHTML;
}

// =====================================================
// 分頁2: 批次匯入篩選功能
// =====================================================

// 全域變數儲存篩選結果
let importedDelayedRecords = [];

/**
 * 解析 DRUG2.txt 檔案內容
 * 處方主檔以 ^ 開頭，後續行為處方醫令（藥品）
 * 回傳：陣列，每個元素為一筆處方（含主檔欄位 + 藥品列表）
 */
function parseDrugFile(text) {
    const lines = text.split('\n');
    const prescriptions = [];
    let current = null;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        if (line.startsWith('^')) {
            // 處方主檔行：去掉開頭的 ^ 和後面一個字元（分類碼）
            const dataStr = line.substring(2); // 去掉 ^X（X 為分類碼字元）
            const fields = dataStr.split(',');

            // 解析21個欄位
            if (fields.length >= 21) {
                current = {
                    idNumber: fields[0],           // 01.身分證號
                    birthDate: fields[1],           // 02.出生日期
                    name: fields[2],                // 03.姓名
                    hospitalCode: fields[3],        // 04.原處方醫療機構代號
                    caseType: fields[4],            // 05.案件分類
                    originalCaseType: fields[5],    // 06.原處方案件分類
                    treatCode1: fields[6],          // 07.特定治療項目代號一
                    treatCode2: fields[7],          // 08.特定治療項目代號二
                    treatCode3: fields[8],          // 09.特定治療項目代號三
                    treatCode4: fields[9],          // 10.特定治療項目代號四
                    department: fields[10],         // 11.就醫科別
                    prescriptionDate: fields[11],   // 12.就醫(處方)日期
                    icd1: fields[12],               // 13.國際疾病分類號一
                    icd2: fields[13],               // 14.國際疾病分類號二
                    visitSeq: fields[14],           // 15.就醫序號
                    copayCode: fields[15],          // 16.部分負擔代碼
                    refillSeq: fields[16],          // 17.連續處方箋調劑序號
                    totalRefills: fields[17],       // 18.連續處方可調劑次數
                    daysPerRefill: fields[18],      // 19.給藥日份
                    doctorCode: fields[19],         // 20.診治醫師代號
                    dispensingDate: fields[20],     // 21.調劑日期
                    medications: []
                };
                prescriptions.push(current);
            }
        } else if (current) {
            // 處方醫令行（藥品）
            const fields = line.split(',');
            if (fields.length >= 7) {
                current.medications.push({
                    nhiCode: fields[0],       // 健保碼
                    dosage: fields[1],        // 每次用量
                    unit: fields[2],          // 單位
                    frequency: fields[3],     // 使用頻率
                    route: fields[4],         // 給藥途徑
                    totalAmount: fields[5],   // 總量
                    medDays: fields[6]        // 藥品給藥日份
                });
            }
        }
    }

    return prescriptions;
}

/**
 * 篩選延遲領藥的處方
 *
 * 延遲邏輯：
 * - 連續處方箋（totalRefills >= 2）
 * - 調劑序號 2 或 3 代表第二、三次領藥
 * - 預期領藥截止日 = 處方日期 + 給藥日份 × 調劑序號
 * - 若調劑日期 > 預期截止日 → 延遲
 *
 * 「第一回延遲」= 調劑序號=2 且延遲（第2次來領藥時延遲）
 * 「第二回延遲」= 調劑序號=3 且延遲（第3次來領藥時延遲）
 */
function detectDelayedRefills(prescriptions, filterDelay1, filterDelay2) {
    const delayed = [];

    for (const rx of prescriptions) {
        const totalRefills = parseInt(rx.totalRefills, 10);
        const refillSeq = parseInt(rx.refillSeq, 10);
        const daysPerRefill = parseInt(rx.daysPerRefill, 10);

        // 只處理連續處方箋（可調劑次數 >= 2）且調劑序號 >= 2
        if (isNaN(totalRefills) || totalRefills < 2) continue;
        if (isNaN(refillSeq) || refillSeq < 2) continue;
        if (isNaN(daysPerRefill) || daysPerRefill <= 0) continue;

        const prescriptionDateObj = rocToDate(rx.prescriptionDate);
        const dispensingDateObj = rocToDate(rx.dispensingDate);

        if (!prescriptionDateObj || !dispensingDateObj) continue;

        // 預期最晚領藥日 = 處方日期 + 給藥日份 × 調劑序號
        // 例如第2次領藥（調劑序號=2）：處方日 + 28天 × 2 = 第56天應領完
        const expectedDeadline = addDays(prescriptionDateObj, daysPerRefill * refillSeq);

        // 計算延遲天數
        const delayDays = daysBetween(expectedDeadline, dispensingDateObj);

        if (delayDays > 0) {
            // 判斷延遲類型
            const delayType = refillSeq - 1; // 調劑序號2→第一回延遲, 序號3→第二回延遲

            // 根據篩選條件過濾
            if (delayType === 1 && !filterDelay1) continue;
            if (delayType === 2 && !filterDelay2) continue;

            delayed.push({
                ...rx,
                delayType,                    // 1=第一回延遲, 2=第二回延遲
                delayDays,                    // 延遲天數
                expectedDeadline,             // 預期領藥截止日
                prescriptionDateObj,          // 處方日期 Date 物件
                dispensingDateObj,             // 調劑日期 Date 物件
                expectedDeadlineStr: formatDate(expectedDeadline),
                prescriptionDateStr: formatRocDate(rx.prescriptionDate),
                dispensingDateStr: formatRocDate(rx.dispensingDate)
            });
        }
    }

    // 依延遲天數由大到小排序
    delayed.sort((a, b) => b.delayDays - a.delayDays);
    return delayed;
}

/**
 * 處理匯入按鈕點擊
 */
function handleImport() {
    const fileInput = document.getElementById('drugFile');
    const filterDelay1 = document.getElementById('filterDelay1').checked;
    const filterDelay2 = document.getElementById('filterDelay2').checked;

    if (!fileInput.files || fileInput.files.length === 0) {
        alert('請選擇 DRUG2.txt 檔案');
        return;
    }

    if (!filterDelay1 && !filterDelay2) {
        alert('請至少勾選一個篩選條件');
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = function(e) {
        const text = e.target.result;

        // 解析檔案
        const prescriptions = parseDrugFile(text);

        // 篩選延遲領藥
        const delayed = detectDelayedRefills(prescriptions, filterDelay1, filterDelay2);
        importedDelayedRecords = delayed;

        // 顯示結果
        displayImportResults(prescriptions.length, delayed);
    };

    reader.readAsText(file, 'Big5'); // 健保申報檔通常使用 Big5 編碼
}

/**
 * 顯示匯入結果
 */
function displayImportResults(totalPrescriptions, delayed) {
    const resultsDiv = document.getElementById('importResults');
    const summaryDiv = document.getElementById('importSummary');

    const delay1Count = delayed.filter(r => r.delayType === 1).length;
    const delay2Count = delayed.filter(r => r.delayType === 2).length;

    summaryDiv.innerHTML = `
        <div class="summary-cards">
            <div class="summary-card">
                <div class="summary-number">${totalPrescriptions}</div>
                <div class="summary-label">總處方筆數</div>
            </div>
            <div class="summary-card highlight">
                <div class="summary-number">${delayed.length}</div>
                <div class="summary-label">延遲領藥筆數</div>
            </div>
            <div class="summary-card warn1">
                <div class="summary-number">${delay1Count}</div>
                <div class="summary-label">第一回延遲</div>
            </div>
            <div class="summary-card warn2">
                <div class="summary-number">${delay2Count}</div>
                <div class="summary-label">第二回延遲</div>
            </div>
        </div>
    `;

    renderImportTable(delayed);
    resultsDiv.style.display = 'block';
}

/**
 * 渲染延遲領藥表格
 */
function renderImportTable(records) {
    const tableDiv = document.getElementById('importTable');

    if (records.length === 0) {
        tableDiv.innerHTML = '<p class="no-results">沒有找到符合條件的延遲領藥記錄。</p>';
        return;
    }

    let html = `
        <div class="table-scroll">
            <table class="import-data-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>姓名</th>
                        <th>身分證號</th>
                        <th>延遲類型</th>
                        <th>處方日期</th>
                        <th>調劑序號</th>
                        <th>可調劑次數</th>
                        <th>給藥日份</th>
                        <th>預期領藥截止</th>
                        <th>實際調劑日期</th>
                        <th>延遲天數</th>
                        <th>ICD碼</th>
                    </tr>
                </thead>
                <tbody>`;

    records.forEach((r, idx) => {
        const delayTypeLabel = r.delayType === 1 ? '第一回延遲' : '第二回延遲';
        const delayTypeClass = r.delayType === 1 ? 'badge-warn1' : 'badge-warn2';
        const severityClass = r.delayDays >= 14 ? 'severity-high' : r.delayDays >= 7 ? 'severity-mid' : '';

        html += `
                    <tr class="${severityClass}">
                        <td>${idx + 1}</td>
                        <td><strong>${r.name}</strong></td>
                        <td class="mono">${maskId(r.idNumber)}</td>
                        <td><span class="badge ${delayTypeClass}">${delayTypeLabel}</span></td>
                        <td>${r.prescriptionDateStr}</td>
                        <td class="center">${r.refillSeq}</td>
                        <td class="center">${r.totalRefills}</td>
                        <td class="center">${r.daysPerRefill}</td>
                        <td>${r.expectedDeadlineStr}</td>
                        <td>${r.dispensingDateStr}</td>
                        <td class="center"><strong class="delay-num">${r.delayDays} 天</strong></td>
                        <td class="mono">${r.icd1}${r.icd2 ? ', ' + r.icd2 : ''}</td>
                    </tr>`;
    });

    html += `</tbody></table></div>`;
    tableDiv.innerHTML = html;
}

/**
 * 遮蔽身分證號（保留前2碼和後3碼）
 */
function maskId(id) {
    if (!id || id.length < 6) return id;
    return id.substring(0, 2) + '*'.repeat(id.length - 5) + id.substring(id.length - 3);
}

/**
 * 篩選搜尋與類型過濾
 */
function filterImportResults() {
    const searchText = document.getElementById('searchInput').value.trim().toLowerCase();
    const delayTypeFilter = document.getElementById('delayTypeFilter').value;

    let filtered = importedDelayedRecords;

    if (searchText) {
        filtered = filtered.filter(r =>
            r.name.toLowerCase().includes(searchText) ||
            r.idNumber.toLowerCase().includes(searchText)
        );
    }

    if (delayTypeFilter !== 'all') {
        const type = parseInt(delayTypeFilter, 10);
        filtered = filtered.filter(r => r.delayType === type);
    }

    renderImportTable(filtered);
}

/**
 * 匯出 CSV
 */
function exportCsv() {
    if (importedDelayedRecords.length === 0) {
        alert('沒有可匯出的資料');
        return;
    }

    // 取得目前過濾後的資料
    const searchText = document.getElementById('searchInput').value.trim().toLowerCase();
    const delayTypeFilter = document.getElementById('delayTypeFilter').value;

    let filtered = importedDelayedRecords;
    if (searchText) {
        filtered = filtered.filter(r =>
            r.name.toLowerCase().includes(searchText) ||
            r.idNumber.toLowerCase().includes(searchText)
        );
    }
    if (delayTypeFilter !== 'all') {
        const type = parseInt(delayTypeFilter, 10);
        filtered = filtered.filter(r => r.delayType === type);
    }

    const headers = ['姓名', '身分證號', '延遲類型', '處方日期', '調劑序號', '可調劑次數', '給藥日份', '預期領藥截止', '實際調劑日期', '延遲天數', 'ICD碼一', 'ICD碼二'];
    const rows = filtered.map(r => [
        r.name,
        r.idNumber,
        r.delayType === 1 ? '第一回延遲' : '第二回延遲',
        r.prescriptionDateStr,
        r.refillSeq,
        r.totalRefills,
        r.daysPerRefill,
        r.expectedDeadlineStr,
        r.dispensingDateStr,
        r.delayDays,
        r.icd1,
        r.icd2 || ''
    ]);

    // BOM + CSV
    let csv = '\uFEFF' + headers.join(',') + '\n';
    rows.forEach(row => {
        csv += row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `延遲領藥名單_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}

// =====================================================
// 分頁切換與事件綁定
// =====================================================

document.addEventListener('DOMContentLoaded', () => {
    // 分頁切換
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            // 移除所有 active
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

            // 設定 active
            btn.classList.add('active');
            document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
        });
    });

    // === 分頁1: 領藥計算機 ===
    initializeActualDatesInputs();
    document.getElementById('totalRefills').addEventListener('change', initializeActualDatesInputs);
    document.getElementById('calculateBtn').addEventListener('click', calculateRefills);
    document.getElementById('prescriptionDate').addEventListener('change', (e) => {
        const prescriptionDate = e.target.value;
        if (prescriptionDate) {
            document.getElementById('actualDate1').value = prescriptionDate;
        }
    });

    // === 分頁2: 批次匯入篩選 ===
    document.getElementById('importBtn').addEventListener('click', handleImport);
    document.getElementById('searchInput').addEventListener('input', filterImportResults);
    document.getElementById('delayTypeFilter').addEventListener('change', filterImportResults);
    document.getElementById('exportCsvBtn').addEventListener('click', exportCsv);
});
