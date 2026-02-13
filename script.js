// 日期格式化函數
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
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
    let previousMedicineEndDate = null; // 記錄前一回的實際藥品用完日

    for (let i = 0; i < totalRefills; i++) {
        const refillNumber = i + 1;
        let expectedPickupStart, expectedPickupEnd, medicineEndDate = null;
        let originalExpectedPickupEnd = null; // 保存原始建議領藥期間結束日（用於判斷是否延遲）
        let normalPickupStart = null; // 保存基於正常情況的領藥期間開始日（用於顯示回診時間）
        let normalPickupEnd = null; // 保存基於正常情況的領藥期間結束日（用於顯示回診時間）
        let isDelayed = false;
        let delayMessage = '';
        let hasActualPickup = actualDates[i] !== null;

        if (i === 0) {
            // 第一回
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
                // 第一回沒有實際領藥日期時，不計算用完日
            }
        } else {
            // 後續回數：計算基於正常情況的領藥期間（用於顯示回診時間）
            // 需要回推到未延遲的時間點
            let baseEndDate = refills[0].originalExpectedPickupEnd; // 從第一回開始
            for (let j = 1; j < i; j++) {
                baseEndDate = addDays(baseEndDate, daysPerRefill);
            }
            normalPickupStart = addDays(baseEndDate, -10);
            normalPickupEnd = baseEndDate;

            // 使用前一回的實際藥品用完日計算當前建議領藥期間
            if (previousMedicineEndDate) {
                expectedPickupStart = addDays(previousMedicineEndDate, -10);
                expectedPickupEnd = previousMedicineEndDate;
                originalExpectedPickupEnd = expectedPickupEnd; // 保存原始值

                // 檢查前一回是否延遲
                const previousRefill = refills[i - 1];
                const isPreviousDelayed = previousRefill && previousRefill.actualPickupDate &&
                                         previousRefill.actualPickupDate > previousRefill.originalExpectedPickupEnd;

                // 檢查是否延遲
                if (actualDates[i]) {
                    const actualPickup = actualDates[i];

                    // 判斷是否延遲領藥（實際領藥日超過建議領藥期間結束日）
                    if (actualPickup > expectedPickupEnd) {
                        // 延遲領藥：藥品已用完，用完日 = 實際領藥日 + 天數
                        medicineEndDate = addDays(actualPickup, daysPerRefill);
                        previousMedicineEndDate = medicineEndDate;
                    } else {
                        // 正常領藥：藥品會累計，用完日 = 前一回用完日 + 天數
                        medicineEndDate = addDays(expectedPickupEnd, daysPerRefill);
                        previousMedicineEndDate = medicineEndDate;
                    }
                } else {
                    // 沒有實際領藥日期時，檢查前一回是否延遲
                    if (isPreviousDelayed) {
                        // 前一回延遲了，需要基於前一回實際藥品用完日重新計算
                        const adjustedPickupStart = addDays(previousMedicineEndDate, -10);
                        const adjustedPickupEnd = previousMedicineEndDate;

                        delayMessage = `因上回領藥延遲，本次領藥區間為 ${formatDate(adjustedPickupStart)} ~ ${formatDate(adjustedPickupEnd)}`;
                        isDelayed = true;

                        // 計算回診時間：基於延遲調整後的領藥區間 + 28天
                        const nextPickupEnd = addDays(adjustedPickupEnd, daysPerRefill);
                        normalPickupStart = addDays(nextPickupEnd, -10);
                        normalPickupEnd = nextPickupEnd;
                    }

                    // 假設在建議期間最後一天領藥，更新 previousMedicineEndDate 以便下一回計算
                    const assumedMedicineEnd = addDays(previousMedicineEndDate, daysPerRefill);
                    previousMedicineEndDate = assumedMedicineEnd;
                    // 不計算用完日
                    medicineEndDate = null;
                }
            } else {
                // 理論上不會到這裡，因為第一回一定會有 expectedPickupEnd
                expectedPickupStart = null;
                expectedPickupEnd = null;
                medicineEndDate = null;
            }
        }

        // 檢查處方是否過期或部分超出效期
        let isExpired = false;
        let isPartiallyExpired = false;

        if (expectedPickupStart && expectedPickupEnd) {
            if (expectedPickupStart > prescriptionExpiry) {
                // 完全過期：領藥開始日超過處方效期
                isExpired = true;
            } else if (expectedPickupEnd > prescriptionExpiry) {
                // 部分過期：領藥區間超出處方效期，截斷到處方效期
                isPartiallyExpired = true;

                // 如果有延遲訊息，需要更新為截斷後的區間
                if (delayMessage) {
                    // 開始日應該是 expectedPickupStart（已經基於 previousMedicineEndDate - 10 計算過）
                    // 但如果開始日也超出處方效期，則從處方效期開始
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
            originalExpectedPickupEnd, // 保存原始建議期間結束日
            normalPickupStart, // 保存基於正常情況的領藥期間開始日
            normalPickupEnd, // 保存基於正常情況的領藥期間結束日
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

    // 處方基本資訊
    prescriptionInfo.innerHTML = `
        <div class="info-card">
            <p><strong>處方開立日：</strong>${formatDate(prescriptionDate)}</p>
            <p><strong>處方效期：</strong>${formatDate(prescriptionExpiry)}</p>
            <p><strong>每次領藥天數：</strong>${daysPerRefill} 天</p>
            <p><strong>可領回數：</strong>${totalRefills} 回</p>
        </div>
    `;

    // 生成甘特圖
    generateGanttChart(ganttChart, refills, prescriptionDate, prescriptionExpiry);

    // 詳細資訊 - 所有回數都顯示
    let detailsHTML = '<div class="details-container">';
    refills.forEach(refill => {
        // 所有回數都顯示，只要有建議領藥期間
        if (refill.expectedPickupStart && refill.expectedPickupEnd) {
            const warningClass = refill.isDelayed ? 'warning' : '';
            const hasActualPickup = refill.actualPickupDate !== null;

            detailsHTML += `
                <div class="refill-card ${warningClass}">
                    <h3>第 ${refill.number} 回</h3>`;

            // 處方過期訊息
            if (refill.isExpired && !hasActualPickup) {
                detailsHTML += `<p class="delay-warning">因上回領藥延遲，第 ${refill.number} 回處方過期無法領藥</p>`;
            } else if (refill.delayMessage && !hasActualPickup) {
                // 延遲訊息顯示在最上方
                detailsHTML += `<p class="delay-warning">${refill.delayMessage}</p>`;
            } else if (refill.number > 1 && !hasActualPickup) {
                // 沒有延遲但沒有實際領藥，顯示建議領藥期間
                detailsHTML += `<p><strong>建議領藥期間：</strong>${formatDate(refill.expectedPickupStart)} ~ ${formatDate(refill.expectedPickupEnd)}</p>`;
            }

            detailsHTML += `
                    ${hasActualPickup ? `<p><strong>實際領藥日：</strong>${formatDate(refill.actualPickupDate)}</p>` : ''}
                    ${refill.medicineEndDate ? `<p><strong>藥品用完日：</strong>${formatDate(refill.medicineEndDate)}</p>` : ''}`;

            // 如果是最後一回且有實際領藥日期和藥品用完日，顯示回診時間
            // 或者如果過期，從前一回推算回診時間
            if (refill.number === totalRefills) {
                if (hasActualPickup && refill.medicineEndDate) {
                    const nextPickupStart = addDays(refill.medicineEndDate, -10);
                    const nextPickupEnd = refill.medicineEndDate;
                    detailsHTML += `<p><strong>回診時間：</strong>${formatDate(nextPickupStart)} ~ ${formatDate(nextPickupEnd)}</p>`;
                } else if (refill.isExpired) {
                    // 從前一回推算回診時間
                    const previousRefill = refills[refill.number - 2];
                    if (previousRefill && previousRefill.medicineEndDate) {
                        const nextPickupStart = addDays(previousRefill.medicineEndDate, -10);
                        const nextPickupEnd = previousRefill.medicineEndDate;
                        detailsHTML += `<p><strong>回診時間：</strong>${formatDate(nextPickupStart)} ~ ${formatDate(nextPickupEnd)}</p>`;
                    }
                }
            }

            // 第二回以後，如果當前回沒有實際領藥日期，顯示預估提示
            if (!hasActualPickup && refill.number > 1 && !refill.isExpired) {
                // 檢查前一回是否有實際領藥日期
                const previousRefill = refills[refill.number - 2]; // number 是 1-based，陣列是 0-based

                // 只有當前一回沒有實際領藥時才顯示預估提示
                if (previousRefill && !previousRefill.actualPickupDate) {
                    detailsHTML += `<p class="hint">※ 此為預估時間，假設第 ${refill.number - 1} 回於建議期間最後一天領藥</p>`;
                }
            }

            // 只有第二回以後才顯示「可在藥品用完前10天回診領藥」
            if (refill.number > 1) {
                detailsHTML += `<p class="hint">可在藥品用完前10天回診領藥</p>`;
            }

            detailsHTML += `
                </div>
            `;
        }
    });
    detailsHTML += '</div>';
    refillDetails.innerHTML = detailsHTML;

    resultsDiv.style.display = 'block';
}

// 生成甘特圖
function generateGanttChart(container, refills, prescriptionDate, prescriptionExpiry) {
    // 計算時間範圍
    const startDate = prescriptionDate;

    // 找出最晚的結束日期（可能是處方效期，也可能是最後一回的藥品用完日）
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

    // 時間軸 - 改為每月1號顯示
    chartHTML += '<div class="timeline">';
    const monthMarkers = [];

    // 從開始日期的下個月1號開始
    let currentDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1);

    // 先加入開始日期
    monthMarkers.push({
        date: new Date(startDate),
        position: 0
    });

    // 加入每月1號的標記
    while (currentDate <= endDate) {
        const position = (daysBetween(startDate, currentDate) / totalDays) * 100;
        monthMarkers.push({
            date: new Date(currentDate),
            position
        });
        currentDate.setMonth(currentDate.getMonth() + 1);
    }

    monthMarkers.forEach(marker => {
        chartHTML += `<div class="timeline-marker" style="left: ${marker.position}%">${formatDate(marker.date)}</div>`;
    });
    chartHTML += '</div>';

    // 每回的時間條
    refills.forEach(refill => {
        // 所有回數都顯示灰色背景條
        chartHTML += `
            <div class="gantt-row">
                <div class="gantt-label">第 ${refill.number} 回</div>
                <div class="gantt-bars">`;

        // 只有當有領藥區間時才顯示藍色可領藥條
        if (refill.expectedPickupStart && refill.expectedPickupEnd) {
            const pickupStartPos = (daysBetween(startDate, refill.expectedPickupStart) / totalDays) * 100;
            const pickupEndPos = (daysBetween(startDate, refill.expectedPickupEnd) / totalDays) * 100;
            const pickupWidth = pickupEndPos - pickupStartPos;

            // 如果有實際領藥日期，顯示用藥中
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

                // 顯示實際領藥標記
                chartHTML += `
                    <div class="gantt-marker actual"
                         style="left: ${actualPickupPos}%"
                         title="實際領藥: ${formatDate(refill.actualPickupDate)}">
                    </div>`;

                // 如果是最後一回，顯示回診區間
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
                // 沒有實際領藥日期
                if (refill.isExpired) {
                    // 處方過期，顯示在最右側
                    chartHTML += `
                    <div class="gantt-bar expired"
                         style="left: 95%; width: 5%"
                         title="處方過期">
                        <span class="bar-label">過期</span>
                    </div>`;
                } else {
                    // 顯示可領藥
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

        chartHTML += `
                </div>
            </div>
        `;
    });

    chartHTML += '</div></div>';
    container.innerHTML = chartHTML;
}

// 事件監聽
document.addEventListener('DOMContentLoaded', () => {
    // 初始化
    initializeActualDatesInputs();

    // 回數改變時重新生成輸入欄位
    document.getElementById('totalRefills').addEventListener('change', initializeActualDatesInputs);

    // 計算按鈕
    document.getElementById('calculateBtn').addEventListener('click', calculateRefills);

    // 設定第一回實際領藥日期預設為處方日
    document.getElementById('prescriptionDate').addEventListener('change', (e) => {
        const prescriptionDate = e.target.value;
        if (prescriptionDate) {
            document.getElementById('actualDate1').value = prescriptionDate;
        }
    });
});
