// --- 6. التحليلات والذكاء (Analytics & Intelligence) ---
function updateAnalytics() {
    let now = new Date(); let oneWeekAgo = new Date(); oneWeekAgo.setDate(now.getDate() - 7);
    let weeklySales = db.sales.filter(s => new Date(s.date) >= oneWeekAgo);

    let dailyTotals = {};
    for(let i=6; i>=0; i--) {
        let d = new Date(); d.setDate(now.getDate() - i);
        let dateStr = d.toLocaleDateString('ar-EG', { numberingSystem: 'latn', calendar: 'gregory', weekday: 'long', month: 'long', day: 'numeric' });
        dailyTotals[dateStr] = 0;
    }

    weeklySales.forEach(s => {
        let d = new Date(s.date).toLocaleDateString('ar-EG', { numberingSystem: 'latn', calendar: 'gregory', weekday: 'long', month: 'long', day: 'numeric' });
        if(dailyTotals[d] !== undefined) dailyTotals[d] += s.total;
    });

    let maxDaily = Math.max(...Object.values(dailyTotals), 1); 
    let chartDiv = document.getElementById('dailySalesChart'); chartDiv.innerHTML = '';
    
    Object.keys(dailyTotals).forEach(date => {
        let val = dailyTotals[date]; let pct = (val / maxDaily) * 100;
        chartDiv.innerHTML += `
            <div style="margin-bottom: 15px;">
                <div style="display:flex; justify-content:space-between; font-size:13px; color:#555; margin-bottom: 5px;">
                    <span>${date}</span> <strong style="color:var(--primary);">${displayNum(val)}</strong>
                </div>
                <div class="analytics-bar-container">
                    <div class="analytics-bar" style="width: ${pct}%;"></div>
                </div>
            </div>`;
    });

    let itemStats = {};
    weeklySales.forEach(sale => {
        if(sale.items) {
            sale.items.forEach(item => {
                if(!itemStats[item.id]) itemStats[item.id] = { name: item.name, soldQty: 0, stock: 0 };
                itemStats[item.id].soldQty += (item.qty * item.multiplier); 
            });
        }
    });

    db.products.forEach(p => { if(itemStats[p.id]) itemStats[p.id].stock = p.stock; });

    let topItems = Object.values(itemStats).sort((a,b) => b.soldQty - a.soldQty).slice(0, 5);
    let topListDiv = document.getElementById('topItemsList');
    topListDiv.innerHTML = topItems.length ? '' : '<p style="color:#7f8c8d;">لا توجد بيانات كافية</p>';
    topItems.forEach(ti => {
        topListDiv.innerHTML += `
            <div style="padding: 12px 0; border-bottom: 1px dashed #eee; display:flex; justify-content:space-between; align-items: center;">
                <span style="font-weight: 500;">${ti.name}</span> <span class="badge-small" style="background:var(--success);">مبيعات: ${displayNum(ti.soldQty)}</span>
            </div>`;
    });

    let restockSuggestions = Object.values(itemStats).filter(i => i.stock < (i.soldQty / 2) && i.soldQty > 0);
    let smartListDiv = document.getElementById('smartRestockList');
    smartListDiv.innerHTML = restockSuggestions.length ? '' : '<p style="color:#7f8c8d;">المخزون بوضع ممتاز بناءً على الطلب.</p>';
    restockSuggestions.forEach(rs => {
        smartListDiv.innerHTML += `
            <div style="padding: 12px 0; border-bottom: 1px dashed #eee; display:flex; justify-content:space-between; align-items:center;">
                <span style="font-weight: 500;">${rs.name}</span> <span class="badge-danger badge-small">المتوفر: ${displayNum(rs.stock)}</span>
            </div>`;
    });
}

// --- 7. التقارير وتحديث الواجهة (Reporting & UI) ---
let filterStart = null; let filterEnd = null;

function applyReportFilter() {
    let fFrom = document.getElementById('filter_from').value; let fTo = document.getElementById('filter_to').value;
    filterStart = fFrom ? new Date(fFrom).setHours(0,0,0,0) : null; filterEnd = fTo ? new Date(fTo).setHours(23,59,59,999) : null;
    closeModal('reportFilterModal'); updateUI();
}

function updateUI() {
    let invTable = document.getElementById('inventoryTable'); invTable.innerHTML = ''; 
    let totalCapital = 0; let availableItemsCount = 0;
    
    db.products.forEach(p => {
        totalCapital += (p.stock * p.buy_price_small);
        if(p.stock > 0) availableItemsCount++;
        let packs = Math.floor(p.stock / p.convert_factor); let bases = p.stock % p.convert_factor;
        
        let stockHTML = `<span class="badge-big ${p.stock <= p.convert_factor ? 'badge-danger' : ''}">${packs} ${p.unit_big}</span>
                         <span class="badge-small">${bases} ${p.unit_small}</span>`;
        
        invTable.innerHTML += `
            <tr>
                <td style="color:var(--primary);"><strong>${p.name}</strong></td>
                <td>${p.unit_small} / ${p.unit_big}</td> 
                <td dir="ltr" style="text-align:center;">${stockHTML}</td>
                <td dir="ltr" style="font-weight:bold; color:#555;">${displayNum(p.buy_price_small)} / <span style="color:var(--accent)">${displayNum(p.sell_price_small)}</span></td>
                <td>
                    <button class="btn btn-warning" onclick="openRestock(${p.id})" style="margin-bottom: 5px; font-size:12px; padding: 6px 10px;">تحديث/توريد</button>
                    <button class="btn btn-danger" onclick="promptDeleteProduct(${p.id})" style="padding: 6px 12px; font-size:12px;">🗑️</button>
                </td>
            </tr>`;
    });

    let custTable = document.getElementById('customersTable'); custTable.innerHTML = ''; let totalDebt = 0;
    db.customers.forEach(c => {
        totalDebt += c.total_debt;
        custTable.innerHTML += `
            <tr>
                <td><strong>${c.name}</strong></td><td dir="ltr" style="color:#555;">${c.phone || '-'}</td><td style="color:var(--danger); font-weight:bold; font-size: 15px;">${displayNum(c.total_debt)}</td>
                <td>
                    <button class="btn btn-primary" style="padding:6px 10px; font-size:12px;" onclick="openCustomerStatement(${c.id})">كشف</button>
                    <button class="btn btn-success" style="padding:6px 10px; font-size:12px;" onclick="openPayDebt(${c.id})" ${c.total_debt <= 0 ? 'disabled' : ''}>تسديد</button>
                    <button class="btn btn-danger" style="padding:6px 12px; font-size:12px;" onclick="deleteCustomer(${c.id})">🗑️</button>
                </td>
            </tr>`;
    });

    let repTable = document.getElementById('reportsTable'); repTable.innerHTML = '';
    let sTotal = 0, sProfit = 0, sCount = 0, allSalesTotal = 0, allSalesProfit = 0;
    let sortedSales = [...db.sales].sort((a,b) => b.id - a.id);
    sortedSales.forEach(s => {
        allSalesTotal += s.total; allSalesProfit += s.profit;
        let sDate = new Date(s.date).getTime(); let show = true;
        if(filterStart && sDate < filterStart) show = false;
        if(filterEnd && sDate > filterEnd) show = false;

        if(show) {
            sTotal += s.total; sProfit += s.profit; sCount++;
            let cName = s.invoice_type === 'cash' ? (s.cash_name ? s.cash_name : 'نقد') : "عميل مسجل";
            if(s.customer_id) { let c = db.customers.find(x => x.id === s.customer_id); cName = c ? c.name : "عميل محذوف"; }
            
            let detailsHTML = `<div style="text-align: right; font-size: 12px; color: #444; max-width:250px;">`;
            if(s.items && s.items.length > 0) {
                s.items.forEach(item => {
                    detailsHTML += `<div style="border-bottom: 1px dashed #ddd; padding: 3px 0; margin-bottom: 3px;">
                        <span style="color:var(--primary); font-weight:bold;">${item.name}</span> <br>
                        <span style="color:#7f8c8d;">الكمية: ${item.qty} ${item.unitName} | السعر: ${displayNum(item.price)}</span>
                    </div>`;
                });
            } else {
                detailsHTML += `<div style="font-weight:bold;">${s.product_name}</div>`;
            }
            detailsHTML += `</div>`;

            repTable.innerHTML += `
                <tr>
                    <td dir="ltr" style="font-size:13px; color:#555;">${formatDateTime(s.date)}</td>
                    <td>${s.invoice_type === 'cash' ? '<span class="badge-small" style="background:var(--success)">نقد</span>' : '<span class="badge-small" style="background:var(--danger)">سلف</span>'}</td>
                    <td><strong>${cName}</strong></td>
                    <td>${detailsHTML}</td>
                    <td style="font-weight:bold; font-size: 15px; color:var(--primary);">${displayNum(s.total)}</td>
                    <td><button class="btn btn-primary" style="background:var(--secondary); padding:8px 12px; font-size:13px;" onclick="reprintInvoice(${s.id})">🖨️ عرض وطباعة</button></td>
                </tr>`;
        }
    });

    document.getElementById('dashCapital').innerText = displayNum(totalCapital);
    document.getElementById('dashSales').innerText = displayNum(allSalesTotal);
    document.getElementById('dashProfit').innerText = displayNum(allSalesProfit);
    document.getElementById('dashDebt').innerText = displayNum(totalDebt);
    document.getElementById('dashItemsCount').innerText = availableItemsCount;

    document.getElementById('repSales').innerText = displayNum(sTotal);
    document.getElementById('repProfit').innerText = displayNum(sProfit);
    document.getElementById('repCount').innerText = sCount;

    updateAnalytics();
}

function printStatementTemplate(id) {
    let c = db.customers.find(x => x.id === id);
    if (!c) return;

    let cSales = db.sales.filter(s => s.customer_id === id && s.invoice_type === 'credit').sort((a, b) => a.id - b.id);
    let totalHistoricalDebt = cSales.reduce((sum, s) => sum + (s.debt_amount !== undefined ? s.debt_amount : s.total), 0);
    let totalPaid = totalHistoricalDebt - c.total_debt;

    let html = `
        <div class="header">
            <h2>نظام الشرق</h2>
            <h3 style="margin: 5px 0; border-bottom: 1px dashed #000; display: inline-block; padding-bottom: 5px;">كشف حساب عميل</h3>
            <p style="margin-top: 10px; font-size: 14px;">العميل: <strong>${c.name}</strong></p>
            <p>التاريخ: <span dir="ltr">${formatDateTime(new Date().toISOString())}</span></p>
        </div>
        <table>
            <tr>
                <th style="width: 25%;">التاريخ</th>
                <th style="width: 35%;">البيان</th>
                <th style="width: 20%;">السلف</th>
                <th style="width: 20%;">المتبقي</th>
            </tr>`;

    cSales.forEach(s => {
        let debtForThisSale = s.debt_amount !== undefined ? s.debt_amount : s.total;
        let unpaidForThisSale = 0;
        
        if (totalPaid >= debtForThisSale) { 
            unpaidForThisSale = 0; totalPaid -= debtForThisSale; 
        } else { 
            unpaidForThisSale = debtForThisSale - totalPaid; totalPaid = 0; 
        }
        
        let d = new Date(s.date);
        let shortDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

        html += `<tr>
          <td dir="ltr" style="font-size: 11px; white-space: nowrap; text-align: center;">${shortDate}</td>
            <td style="font-size: 11px;">${s.product_name}</td>
            <td dir="ltr" style="font-size: 12px;">${displayNum(debtForThisSale)}</td>
            <td dir="ltr" style="font-weight: bold; font-size: 12px;">${unpaidForThisSale > 0 ? displayNum(unpaidForThisSale) : 'مسدد'}</td>
        </tr>`;
    });

    html += `
        </table>
        <div class="total-area">
            <p style="display:flex; justify-content:space-between; margin:5px 0; font-size: 16px;">
                <span>إجمالي المديونية:</span> 
                <span dir="ltr" style="color:var(--danger);">${displayNum(c.total_debt)} ريال</span>
            </p>
        </div>
        <div class="footer">
            <p style="font-size: 11px;">تم إصدار الكشف إلكترونياً عبر نظام الشرق</p>
        </div>`;
    
    closeModal('statementModal');
    document.getElementById('receipt-content').innerHTML = html;
    document.getElementById('invoiceContainer').classList.add('active');
}

// تشغيل التحديث عند تحميل الصفحة
document.addEventListener("DOMContentLoaded", () => {
    let todayObj = new Date(); let tzOffset = todayObj.getTimezoneOffset() * 60000;
    let localISOTime = (new Date(todayObj - tzOffset)).toISOString().slice(0, -1);
    let todayStr = localISOTime.split('T')[0];

    if(document.getElementById('filter_from')) {
        document.getElementById('filter_from').value = todayStr; document.getElementById('filter_to').value = todayStr;
        filterStart = new Date(todayStr).setHours(0,0,0,0); filterEnd = new Date(todayStr).setHours(23,59,59,999);
    }
    updateUI();
});
