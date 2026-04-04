// --- 6. التحليلات والذكاء (Analytics & Intelligence) ---
function updateAnalytics() {
    let now = new Date(); 
    let oneWeekAgo = new Date(); 
    oneWeekAgo.setDate(now.getDate() - 7);
    
    let weeklySales = db.sales.filter(s => new Date(s.date) >= oneWeekAgo && !s.is_returned);

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
    let chartDivs = document.querySelectorAll('[id="dailySalesChart"]'); 
chartDivs.forEach(div => div.innerHTML = '');

Object.keys(dailyTotals).forEach(date => {
    let val = dailyTotals[date]; let pct = (val / maxDaily) * 100;
    let html = `
        <div style="margin-bottom: 15px;">
            <div style="display:flex; justify-content:space-between; font-size:13px; color:#555; margin-bottom: 5px;">
                <span>${date}</span> <strong style="color:var(--primary);">${displayNum(val)}</strong>
            </div>
            <div class="analytics-bar-container">
                <div class="analytics-bar" style="width: ${pct}%;"></div>
            </div>
        </div>`;
    chartDivs.forEach(div => div.innerHTML += html);
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
    if(topListDiv) {
        topListDiv.innerHTML = topItems.length ? '' : '<p style="color:#7f8c8d;">لا توجد بيانات كافية خلال آخر 7 أيام.</p>';
        topItems.forEach(ti => {
            topListDiv.innerHTML += `
                <div style="padding: 12px 0; border-bottom: 1px dashed #eee; display:flex; justify-content:space-between; align-items: center;">
                    <span style="font-weight: 500;">${ti.name}</span> <span class="badge-small" style="background:var(--success);">مبيعات: ${displayNum(ti.soldQty)}</span>
                </div>`;
        });
    }

    let restockSuggestions = Object.values(itemStats).filter(i => i.stock < (i.soldQty / 2) && i.soldQty > 0);
    let smartListDiv = document.getElementById('smartRestockList');
    if(smartListDiv) {
        smartListDiv.innerHTML = restockSuggestions.length ? '' : '<p style="color:#7f8c8d;">المخزون بوضع ممتاز بناءً على الطلب.</p>';
        restockSuggestions.forEach(rs => {
            smartListDiv.innerHTML += `
                <div style="padding: 12px 0; border-bottom: 1px dashed #eee; display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-weight: 500;">${rs.name}</span> <span class="badge-danger badge-small">المتوفر: ${displayNum(rs.stock)}</span>
                </div>`;
        });
    }

    let expiryAlerts = [];
    let todayNormalized = new Date();
    todayNormalized.setHours(0, 0, 0, 0); 

    db.products.forEach(p => {
        if(p.stock > 0 && p.batches && Array.isArray(p.batches)) {
            p.batches.forEach(batch => {
                if(batch.expiry_date && batch.expiry_date.trim() !== '') {
                    let expDate = new Date(batch.expiry_date);
                    if(!isNaN(expDate.getTime())) { 
                        expDate.setHours(0, 0, 0, 0); 
                        let diffTime = expDate.getTime() - todayNormalized.getTime();
                        let diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        if(diffDays <= 30) { 
                            expiryAlerts.push({ name: p.name, days: diffDays, qty: batch.qty_big, unit: p.unit_big });
                        }
                    }
                }
            });
        }
    });

    let expiryListDiv = document.getElementById('expiryAlertsList');
    if (expiryListDiv) {
        expiryAlerts.sort((a, b) => a.days - b.days);
        if(expiryAlerts.length === 0) {
            expiryListDiv.innerHTML = '<p style="text-align:center; color:#7f8c8d; padding:15px; font-weight:bold;">✅ لا توجد أصناف تقترب من الانتهاء قريباً. المخزون سليم.</p>';
        } else {
            expiryListDiv.innerHTML = '';
            expiryAlerts.forEach(ea => {
                let statusText = ea.days < 0 ? `منتهي منذ ${Math.abs(ea.days)} يوم` : (ea.days === 0 ? `ينتهي اليوم!` : `ينتهي خلال ${ea.days} يوم`);
                let bgColor = ea.days <= 0 ? '#ffebee' : '#fff8e1'; 
                let badgeColor = ea.days <= 0 ? 'var(--danger)' : '#e67e22'; 
                
                expiryListDiv.innerHTML += `
                    <div style="padding: 12px; border: 1px solid #eee; border-radius: 6px; margin-bottom: 8px; display:flex; justify-content:space-between; align-items:center; background: ${bgColor};">
                        <span style="font-weight: 500; color:var(--primary);">${ea.name} <br><small style="color:#7f8c8d;">(الكمية المسجلة بالدفعة: ${ea.qty} ${ea.unit})</small></span> 
                        <span class="badge-small" style="background:${badgeColor}; font-size: 13px; padding: 6px 10px;">${statusText}</span>
                    </div>`;
            });
        }
    }
}

// --- 7. التقارير والاسترجاع وتحديث الواجهة (Reporting, Returns & UI) ---
let filterStart = null; let filterEnd = null;

function applyReportFilter() {
    let fFrom = document.getElementById('filter_from').value; let fTo = document.getElementById('filter_to').value;
    filterStart = fFrom ? new Date(fFrom).setHours(0,0,0,0) : null; filterEnd = fTo ? new Date(fTo).setHours(23,59,59,999) : null;
    closeModal('reportFilterModal'); updateUI();
}

function promptReturnInvoice(saleId) {
    document.getElementById('returnSaleId').value = saleId;
    openModal('returnConfirmModal');
}

function executeReturnInvoice() {
    let saleId = parseInt(document.getElementById('returnSaleId').value);
    let sale = db.sales.find(s => s.id === saleId);
    
    if(!sale || sale.is_returned) {
        closeModal('returnConfirmModal');
        return alert("لا يمكن استرجاع الفاتورة (قد تكون مسترجعة مسبقاً)");
    }

    if (sale.items) {
        sale.items.forEach(item => {
            let prod = db.products.find(p => p.id === item.id);
            if (prod) {
                prod.stock += (item.qty * item.multiplier);
            }
        });
    }

    if (sale.invoice_type === 'credit' && sale.customer_id) {
        let customer = db.customers.find(c => c.id === sale.customer_id);
        if (customer) {
            let debtToDeduct = sale.debt_amount !== undefined ? sale.debt_amount : sale.total;
            customer.total_debt -= debtToDeduct;
            if(customer.total_debt < 0) customer.total_debt = 0; 
        }
    }

    // استرجاع المبالغ لحساب العميل (إذا تم الدفع من الرصيد)
    if (sale.paid_from_balance && sale.paid_from_balance > 0 && sale.customer_id) {
        let customer = db.customers.find(c => c.id === sale.customer_id);
        if (customer) {
            customer.balance = (customer.balance || 0) + sale.paid_from_balance;
        }
    }

    // --- خصم قيمة الفاتورة المسترجعة من الصندوق إذا كانت نقدية ---
    if (sale.invoice_type === 'cash' || (sale.paid_cash && sale.paid_cash > 0)) {
        let cashToReturn = sale.paid_cash !== undefined ? sale.paid_cash : sale.total;
        if(typeof addSystemTransaction === 'function') {
            addSystemTransaction('expense', cashToReturn, `استرجاع مبيعات نقدية فاتورة #${sale.id}`, sale.id);
        }
    }

    sale.is_returned = true;
    sale.returned_at = new Date().toISOString();

    saveData();
    closeModal('returnConfirmModal');
    showSuccessPopup();
}

function updateUI() {
    let invTable = document.getElementById('inventoryTable'); if(invTable) invTable.innerHTML = ''; 
    let totalCapital = 0; let availableItemsCount = 0;
    
    db.products.forEach(p => {
        totalCapital += (p.stock * p.buy_price_small);
        if(p.stock > 0) availableItemsCount++;
        let packs = Math.floor(p.stock / p.convert_factor); let bases = p.stock % p.convert_factor;
        
        let stockHTML = `<span class="badge-big ${p.stock <= p.convert_factor ? 'badge-danger' : ''}">${packs} ${p.unit_big}</span>
                         <span class="badge-small">${bases} ${p.unit_small}</span>`;
        
        if(invTable) {
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
        }
    });

    let custTable = document.getElementById('customersTable'); if(custTable) custTable.innerHTML = ''; let totalDebt = 0;
    db.customers.forEach(c => {
        totalDebt += (c.total_debt || 0);
        if(custTable) {
            custTable.innerHTML += `
                <tr>
                    <td><strong>${c.name}</strong></td>
                    <td dir="ltr" style="color:#555;">${c.phone || '-'}</td>
                    <td style="color:var(--danger); font-weight:bold; font-size: 15px;">${displayNum(c.total_debt)}</td>
                    <td style="color:var(--success); font-weight:bold; font-size: 15px;">${displayNum(c.balance || 0)}</td>
                    <td>
                        <button class="btn btn-primary" style="padding:6px 10px; font-size:12px;" onclick="openCustomerStatement(${c.id})">كشف</button>
                        <button class="btn btn-success" style="padding:6px 10px; font-size:12px;" onclick="openPayDebt(${c.id})">إيداع/سداد</button>
                        <button class="btn btn-danger" style="padding:6px 12px; font-size:12px;" onclick="deleteCustomer(${c.id})">🗑️</button>
                    </td>
                </tr>`;
        }
    });

    let repTable = document.getElementById('reportsTable'); if(repTable) repTable.innerHTML = '';
    let sTotal = 0, sProfit = 0, sCount = 0, allSalesTotal = 0, allSalesProfit = 0;
    let sortedSales = [...db.sales].sort((a,b) => b.id - a.id);
    
    sortedSales.forEach(s => {
        if(!s.is_returned) {
            allSalesTotal += s.total; allSalesProfit += s.profit;
        }

        let sDate = new Date(s.date).getTime(); let show = true;
        if(filterStart && sDate < filterStart) show = false;
        if(filterEnd && sDate > filterEnd) show = false;

        if(show) {
            if(!s.is_returned) {
                sTotal += s.total; sProfit += s.profit; sCount++;
            }

            let cName = s.invoice_type === 'cash' ? (s.cash_name ? s.cash_name : 'نقد') : "عميل مسجل";
            if(s.customer_id) { let c = db.customers.find(x => x.id === s.customer_id); cName = c ? c.name : "عميل محذوف"; }
            
            let paymentBadge = s.invoice_type === 'cash' ? '<span class="badge-small" style="background:var(--success)">نقد</span>' : '<span class="badge-small" style="background:var(--danger)">سلف</span>';
            if (s.paid_from_balance > 0) {
                 paymentBadge += ` <span class="badge-small" style="background:#9b59b6">من الرصيد</span>`;
            }

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

            let rowStyle = s.is_returned ? 'opacity: 0.6; background: #ffebee;' : '';
            let returnStatus = s.is_returned ? `<span class="badge-small" style="background:var(--danger); display:block; margin-top:5px;">مسترجعة</span>` : '';
            let returnBtnHTML = !s.is_returned ? `<button class="btn btn-danger" style="padding:8px 12px; font-size:13px; margin-top:5px;" onclick="promptReturnInvoice(${s.id})">↩️ استرجاع</button>` : '';
            let taxBadge = (!s.is_returned && s.tax_amount > 0) ? `<br><span style="font-size:11px; color:var(--danger);">ضريبة: ${displayNum(s.tax_amount)}</span>` : '';

            if(repTable) {
                repTable.innerHTML += `
                    <tr style="${rowStyle}">
                        <td dir="ltr" style="font-size:13px; color:#555;">${formatDateTime(s.date)} ${returnStatus}</td>
                        <td>${paymentBadge}</td>
                        <td><strong>${cName}</strong></td>
                        <td>${detailsHTML}</td>
                        <td style="font-weight:bold; font-size: 15px; color:var(--primary); text-decoration: ${s.is_returned ? 'line-through' : 'none'};">${displayNum(s.total)} ${taxBadge}</td>
                        <td>
                            <button class="btn btn-primary" style="background:var(--secondary); padding:8px 12px; font-size:13px;" onclick="reprintInvoice(${s.id})">🖨️ عرض</button>
                            ${returnBtnHTML}
                        </td>
                    </tr>`;
            }
        }
    });

   let currHTML = `<span class="currency-symbol">${db.settings.currency}</span>`;
    
    if(document.getElementById('dashCapital')) document.getElementById('dashCapital').innerHTML = currHTML + ' <span dir="ltr">' + displayNum(totalCapital) + '</span>';
    
    if(document.getElementById('dashSales')) {
        // عرض إجمالي المبيعات الحقيقي دون خصم المشتريات
        document.getElementById('dashSales').innerHTML = currHTML + ' <span dir="ltr">' + displayNum(allSalesTotal) + '</span>';
        
        // إعادة عنوان البطاقة إلى اسمها الصحيح
        let titleEl = document.getElementById('dashSales').previousElementSibling;
        if(titleEl && titleEl.tagName === 'H3') titleEl.innerText = 'إجمالي المبيعات';
    }
    
    if(document.getElementById('dashProfit')) document.getElementById('dashProfit').innerHTML = currHTML + ' <span dir="ltr">' + displayNum(allSalesProfit) + '</span>';
    if(document.getElementById('dashDebt')) document.getElementById('dashDebt').innerHTML = currHTML + ' <span dir="ltr">' + displayNum(totalDebt) + '</span>';
    if(document.getElementById('dashItemsCount')) document.getElementById('dashItemsCount').innerText = availableItemsCount;

    if(document.getElementById('repSales')) document.getElementById('repSales').innerHTML = currHTML + ' <span dir="ltr">' + displayNum(sTotal) + '</span>';
    if(document.getElementById('repProfit')) document.getElementById('repProfit').innerHTML = currHTML + ' <span dir="ltr">' + displayNum(sProfit) + '</span>';
    if(document.getElementById('repCount')) document.getElementById('repCount').innerText = sCount;
// عرض إجمالي المشتريات (يدعم التوريد القديم والفواتير الجديدة)
    if(document.getElementById('dashPurchases')) {
        let totalPurchases = db.purchases
        .filter(p => !p.is_returned) 
        .reduce((sum, p) => sum + (parseFloat(p.final_total) || 0), 0);
        document.getElementById('dashPurchases').innerHTML = currHTML + ' <span dir="ltr">' + displayNum(totalPurchases) + '</span>';
    }
    // -- إضافة هذا الكود في نهاية دالة updateUI() --
    if (typeof renderSuppliers === 'function') renderSuppliers();
    if (typeof renderPurchases === 'function') renderPurchases();
    // ----------------------------------------------
    let purchaseDisplay = document.getElementById('totalPurchases'); 
    if (purchaseDisplay) {
        purchaseDisplay.innerText = displayNum(totalPurchases);
    }
    updateAnalytics();
    if (typeof updateSmartDashboard === 'function') updateSmartDashboard();
}


// === طباعة كشف الحساب بواجهة الفاتورة ===
// === طباعة كشف الحساب الشامل ===
function printStatementTemplate(id) {
    let c = db.customers.find(x => x.id === id);
    if(!c) return;
    
    let allMovements = [];

    // 1. فواتير السلف (الدين)
    db.sales.filter(s => s.customer_id === id && s.invoice_type === 'credit').forEach(s => {
        let amt = s.debt_amount !== undefined ? s.debt_amount : s.total;
        allMovements.push({ date: new Date(s.date), desc: `فاتورة سلف #${s.id}`, amount: amt, type: 'دين' });
    });

    // 2. فواتير مسحوبة من الرصيد المودع
    db.sales.filter(s => s.customer_id === id && s.paid_from_balance > 0).forEach(s => {
        allMovements.push({ date: new Date(s.date), desc: `مشتريات من الرصيد #${s.id}`, amount: s.paid_from_balance, type: 'خصم' });
    });

    // 3. الدفعات النقدية
    db.transactions.filter(t => t.ref_id === `cust_${id}` || (t.desc && t.desc.includes(`للعميل: ${c.name}`))).forEach(t => {
        allMovements.push({ date: new Date(t.date), desc: t.desc, amount: t.amount, type: 'سداد/إيداع' });
    });

    allMovements.sort((a, b) => a.date - b.date);

    let curr = db.settings.currency;
    closeModal('statementModal');

    let logoHtml = db.settings.storeLogo ? `<img src="${db.settings.storeLogo}" style="max-width: 100px; max-height: 100px; margin: 0 auto 10px auto; display: block; border-radius: 8px;">` : '';
    let addressHtml = db.settings.storeAddress ? `<p style="margin: 3px 0; font-size:0.9em;">📍 ${db.settings.storeAddress}</p>` : '';
    let contactHtml = db.settings.storeContact ? `<p style="margin: 3px 0; font-size:0.9em;">📞 ${db.settings.storeContact}</p>` : '';
    
    let fSize = db.settings.receiptFontSize || 14;
    let margin = db.settings.receiptMargin !== undefined ? db.settings.receiptMargin : 10;
    let printWidthClass = db.settings.invoiceFormat === 'a4' ? '100%' : (db.settings.printerSize === '58mm' ? '58mm' : '80mm');
    
    let containerStyle = `font-size: ${fSize}px; padding: ${margin}px; max-width: ${printWidthClass}; margin: 0 auto; background: white; color: black; direction: rtl;`;

    let html = `
        <div style="${containerStyle}">
            <div style="text-align:center; margin-bottom: 15px; border-bottom: 2px dashed #000; padding-bottom: 10px;">
                ${logoHtml}
                <h2 style="margin:0 0 5px 0; font-size:1.3em;">${db.settings.storeName}</h2>
                ${addressHtml}
                ${contactHtml}
                <h3 style="margin:10px 0 5px 0; background:#eee; padding:5px; border-radius:5px; border:1px solid #ccc;">📄 كشف حساب مفصل</h3>
                <p style="margin:5px 0; font-weight:bold; font-size:1.1em;">العميل: ${c.name}</p>
                <div style="display:flex; justify-content:space-around; background:#f9f9f9; padding:5px; border:1px solid #ddd; margin-top:5px;">
                    <span style="color:var(--danger); font-weight:bold;">الديون: ${displayNum(c.total_debt)}</span>
                    <span style="color:var(--success); font-weight:bold;">الرصيد: ${displayNum(c.balance || 0)}</span>
                </div>
            </div>
            
            <table style="width:100%; border-collapse: collapse; text-align: right; margin-bottom: 15px;">
                <tr style="border-bottom: 2px solid #000;">
                    <th style="padding:4px 0; font-size:0.9em;">التاريخ</th>
                    <th style="padding:4px 0; font-size:0.9em;">البيان</th>
                    <th style="padding:4px 0; font-size:0.9em;">المبلغ</th>
                    <th style="padding:4px 0; font-size:0.9em;">النوع</th>
                </tr>
    `;

    allMovements.forEach(m => {
        let shortDate = m.date.toLocaleDateString('en-GB', { day:'2-digit', month:'2-digit', year:'2-digit' });
        html += `
            <tr style="border-bottom: 1px dotted #ccc;">
                <td style="padding:6px 0; font-size:0.85em;" dir="ltr">${shortDate}</td>
                <td style="padding:6px 0; font-size:0.85em; max-width:90px; overflow:hidden;">${m.desc}</td>
                <td style="padding:6px 0; font-size:0.9em; font-weight:bold;" dir="ltr">${displayNum(m.amount)}</td>
                <td style="padding:6px 0; font-size:0.8em;">${m.type}</td>
            </tr>
        `;
    });

    html += `</table>
    <div style="text-align:center; margin-top: 20px; font-size: 0.9em; border-top: 1px dashed #000; padding-top: 10px;">
        <p style="margin: 2px 0;">نظام الشرق للمحاسبة</p>
    </div>
    </div>`;

    let invCard = document.getElementById('invoiceCard');
    if(db.settings.invoiceFormat === 'a4') invCard.classList.add('format-a4');
    else invCard.classList.remove('format-a4');

    document.getElementById('receipt-content').innerHTML = html;
    document.getElementById('invoiceContainer').classList.add('active');
}

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
// تعريف المتغيرات عالمياً لتجنب تكرار الرسم عند التحديث
let weeklyChartInstance = null;
let todayChartInstance = null;

function renderDashboardCharts() {
    let now = new Date();
    let todayDateString = now.toLocaleDateString('en-CA'); // صيغة YYYY-MM-DD
    
    // --- 1. تجهيز بيانات آخر 7 أيام (المبيعات والأرباح) ---
    let labels = [];
    let salesData = [];
    let profitData = [];
    
    for(let i=6; i>=0; i--) {
        let d = new Date(); 
        d.setDate(now.getDate() - i);
        let dateStr = d.toLocaleDateString('en-CA');
        let displayStr = d.toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric' });
        
        labels.push(displayStr);
        
        // حساب مبيعات وأرباح هذا اليوم
        let dailySales = db.sales.filter(s => s.date && s.date.startsWith(dateStr) && !s.is_returned);
        let totalSales = dailySales.reduce((sum, s) => sum + s.total, 0);
        let totalProfit = dailySales.reduce((sum, s) => sum + (s.profit || 0), 0);
        
        salesData.push(totalSales);
        profitData.push(totalProfit);
    }

    // --- 2. تجهيز بيانات ملخص اليوم الدائري (وارد منصرف) ---
    let todayIncome = 0;
    let todayExpense = 0;
    
    db.transactions.forEach(tr => {
        if(tr.date && tr.date.startsWith(todayDateString)) {
            if(tr.type === 'income') todayIncome += tr.amount;
            if(tr.type === 'expense') todayExpense += tr.amount;
        }
    });

    // --- 3. رسم مخطط المبيعات والأرباح (الخطي) ---
    const ctxWeekly = document.getElementById('weeklySalesChart');
    if(ctxWeekly) {
        if(weeklyChartInstance) weeklyChartInstance.destroy(); // تدمير القديم لتحديثه
        weeklyChartInstance = new Chart(ctxWeekly, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [
                    {
                        label: 'إجمالي المبيعات',
                        data: salesData,
                        borderColor: '#3498db',
                        backgroundColor: 'rgba(52, 152, 219, 0.1)',
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4 // لجعل الخط منحني بشكل ناعم
                    },
                    {
                        label: 'صافي الربح',
                        data: profitData,
                        borderColor: '#2ecc71',
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        borderDash: [5, 5], // خط متقطع للربح
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'top', labels: { font: { family: 'Tajawal, sans-serif' } } } }
            }
        });
    }

    // --- 4. رسم مخطط ملخص السيولة (الدائري) ---
    const ctxToday = document.getElementById('todayTreasuryChart');
    if(ctxToday) {
        if(todayChartInstance) todayChartInstance.destroy();
        
        // إذا لم يكن هناك حركات اليوم، نضع قيم افتراضية حتى يظهر الرسم
        let hasData = todayIncome > 0 || todayExpense > 0;
        
        todayChartInstance = new Chart(ctxToday, {
            type: 'doughnut', // رسم مجوف
            data: {
                labels: ['الوارد (المقبوضات)', 'المنصرف (المصروفات)'],
                datasets: [{
                    data: hasData ? [todayIncome, todayExpense] : [1, 0],
                    backgroundColor: hasData ? ['#2ecc71', '#e74c3c'] : ['#ecf0f1', '#ecf0f1'],
                    borderWidth: 0,
                    hoverOffset: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: {
                    legend: { position: 'bottom', labels: { font: { family: 'Tajawal, sans-serif' } } },
                    tooltip: { enabled: hasData } // تعطيل التلميحات إذا لم تكن هناك بيانات حقيقية
                }
            }
        });
    }
}
// أضف هذا الاستدعاء لضمان تحديث الرسومات البيانية بأحدث البيانات
renderDashboardCharts();