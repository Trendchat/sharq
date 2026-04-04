// --- إدارة الخزائن والصندوق والورديات الاحترافية (Treasury & Shifts) ---

// حساب رصيد خزانة محددة
function calculateSafeBalance(safeId) {
    let totalIn = 0;
    let totalOut = 0;
    db.transactions.forEach(tr => {
        if (tr.safe_id === safeId) {
            if (tr.type === 'income') totalIn += tr.amount;
            if (tr.type === 'expense') totalOut += tr.amount;
        }
    });
    // إضافة حساب التحويلات
    db.transfers.forEach(tf => {
        if (tf.to_safe === safeId) totalIn += tf.amount;
        if (tf.from_safe === safeId) totalOut += tf.amount;
    });
    
    let safe = db.safes.find(s => s.id === safeId);
    if(safe) safe.balance = totalIn - totalOut; // تحديث الرصيد في الكائن
    return totalIn - totalOut;
}

function updateTreasuryUI() {
    // 1. تحديث قائمة الخزائن
    let safesGrid = document.getElementById('safesGrid');
    if (!safesGrid) return;
    safesGrid.innerHTML = '';
    
    let overallBalance = 0;
    
    db.safes.forEach(safe => {
        let bal = calculateSafeBalance(safe.id);
        overallBalance += bal;
        let alertHTML = (safe.max_limit > 0 && bal > safe.max_limit) ? `<span style="display:block; font-size:11px; color:var(--danger); margin-top:5px;">⚠️ تجاوز الحد الأعلى</span>` : '';
        
        safesGrid.innerHTML += `
            <div class="card" style="border-right: 4px solid var(--primary); text-align:right;">
                <h3 style="color: var(--primary); font-size: 16px; margin-bottom: 5px;">${safe.name}</h3>
                <p style="font-size: 12px; color: #7f8c8d; margin-bottom: 10px;">الفرع: ${safe.branch || 'الرئيسي'}</p>
                <p style="color: var(--success); font-size: 20px;" dir="ltr">${displayNum(bal)}</p>
                ${alertHTML}
            </div>
        `;
    });

    // 2. تحديث لوحة التحكم الرئيسية (إجمالي كل الخزائن)
    let dashBoxBalance = document.getElementById('dashBoxBalance');
    if(dashBoxBalance) dashBoxBalance.innerHTML = `<span class="currency-symbol">${db.settings.currency}</span> <span dir="ltr">${displayNum(overallBalance)}</span>`;

    // 3. تحديث جدول الحركات (دفتر الأستاذ)
    let tbody = document.getElementById('treasuryTable');
    tbody.innerHTML = '';
    
    let sortedTrans = [...db.transactions].sort((a, b) => new Date(b.date) - new Date(a.date));

    sortedTrans.forEach(tr => {
        let safeName = db.safes.find(s => s.id === tr.safe_id)?.name || 'غير محدد';
        let shiftInfo = tr.shift_id ? `<br><small style="color:#7f8c8d;">وردية #${tr.shift_id}</small>` : '';
        
        let isIn = tr.type === 'income';
        let typeBadge = isIn ? `<span class="badge-small" style="background:var(--success)">وارد</span>` : `<span class="badge-small" style="background:var(--danger)">منصرف</span>`;
        let inAmount = isIn ? `<strong style="color:var(--success)">${displayNum(tr.amount)}</strong>` : '-';
        let outAmount = !isIn ? `<strong style="color:var(--danger)">${displayNum(tr.amount)}</strong>` : '-';

        tbody.innerHTML += `
            <tr>
                <td dir="ltr" style="font-size:13px; color:#555;">${formatDateTime(tr.date)}</td>
                <td><strong>${safeName}</strong> ${shiftInfo}</td>
                <td>${typeBadge}</td>
                <td>${tr.desc}</td>
                <td dir="ltr">${inAmount}</td>
                <td dir="ltr">${outAmount}</td>
                <td>
                    <button class="btn btn-danger" style="padding: 5px 10px; font-size: 12px;" onclick="deleteTransaction(${tr.id})">حذف</button>
                </td>
            </tr>
        `;
    });

    checkActiveShift();
}

// --- الخزائن (Safes) ---
function openSafeModal() {
    document.getElementById('safe_id').value = '';
    document.getElementById('safe_name').value = '';
    document.getElementById('safe_branch').value = '';
    openModal('addSafeModal');
}

function saveSafe() {
    let name = document.getElementById('safe_name').value.trim();
    let branch = document.getElementById('safe_branch').value.trim();
    let limit = parseFloat(document.getElementById('safe_limit').value) || 0;

    if (!name) return alert("الرجاء إدخال اسم الخزانة");

    db.safes.push({
        id: Date.now(), name: name, branch: branch, balance: 0, max_limit: limit, created_at: new Date().toISOString()
    });

    saveData();
    closeModal('addSafeModal');
    showSuccessPopup();
}

// --- التحويلات (Transfers) ---
function openTransferModal() {
    let fromSelect = document.getElementById('transfer_from');
    let toSelect = document.getElementById('transfer_to');
    fromSelect.innerHTML = ''; toSelect.innerHTML = '';
    
    db.safes.forEach(s => {
        let opt1 = `<option value="${s.id}">${s.name} (رصيد: ${displayNum(calculateSafeBalance(s.id))})</option>`;
        let opt2 = `<option value="${s.id}">${s.name}</option>`;
        fromSelect.innerHTML += opt1;
        toSelect.innerHTML += opt2;
    });

    document.getElementById('transfer_amount').value = '';
    openModal('transferModal');
}

function executeTransfer() {
    let fromId = parseInt(document.getElementById('transfer_from').value);
    let toId = parseInt(document.getElementById('transfer_to').value);
    let amount = parseFloat(document.getElementById('transfer_amount').value);

    if (fromId === toId) return alert("لا يمكن التحويل لنفس الخزانة!");
    if (!amount || amount <= 0) return alert("أدخل مبلغاً صحيحاً");

    let fromBal = calculateSafeBalance(fromId);
    if (amount > fromBal) return alert("الرصيد في الخزانة المسحوب منها غير كافٍ!");

    db.transfers.push({ id: Date.now(), from_safe: fromId, to_safe: toId, amount: amount, date: new Date().toISOString() });
    
    // إنشاء حركات دفترية لتظهر في التقرير
    addSystemTransaction('expense', amount, `تحويل صادر إلى خزانة #${toId}`, Date.now(), fromId);
    addSystemTransaction('income', amount, `تحويل وارد من خزانة #${fromId}`, Date.now(), toId);

    saveData();
    closeModal('transferModal');
    showSuccessPopup();
}

// --- الورديات (Shifts) ---
function getActiveShift() {
    // جلب الوردية المفتوحة للمستخدم الحالي
    let activeUserId = currentUser ? currentUser.id : 1;
    return db.shifts.find(s => s.user_id === activeUserId && s.status === 'open');
}

function checkActiveShift() {
    let active = getActiveShift();
    let notice = document.getElementById('activeShiftNotice');
    if(active && notice) {
        let safe = db.safes.find(s => s.id === active.safe_id);
        document.getElementById('activeShiftDetails').innerHTML = `
            رقم الوردية: <strong>#${active.id}</strong> | الخزانة: <strong>${safe ? safe.name : '-'}</strong> | 
            وقت البدء: <span dir="ltr">${formatDateTime(active.start_time)}</span>
        `;
        notice.style.display = 'block';
    } else if(notice) {
        notice.style.display = 'none';
    }
}

function openShiftModal() {
    let active = getActiveShift();
    
    if (active) {
        // وردية مفتوحة -> عرض واجهة الجرد والإغلاق
        document.getElementById('openShiftSection').style.display = 'none';
        document.getElementById('closeShiftSection').style.display = 'block';
        document.getElementById('shiftModalTitle').innerText = 'إغلاق الوردية وجرد الصندوق';
        
        let safeBal = calculateSafeBalance(active.safe_id);
        
        // حساب حركات الوردية فقط
        let sIn = 0, sOut = 0;
        db.transactions.forEach(t => {
            if(t.shift_id === active.id) {
                if(t.type === 'income') sIn += t.amount;
                if(t.type === 'expense') sOut += t.amount;
            }
        });

        let expected = active.open_balance + sIn - sOut;

        document.getElementById('lbl_open_bal').innerText = displayNum(active.open_balance);
        document.getElementById('lbl_shift_in').innerText = displayNum(sIn);
        document.getElementById('lbl_shift_out').innerText = displayNum(sOut);
        document.getElementById('lbl_expected_bal').innerText = displayNum(expected);
        
        // حفظ الرصيد المتوقع في حقل مخفي للمقارنة
        document.getElementById('lbl_expected_bal').setAttribute('data-val', expected);
        document.getElementById('shift_actual_balance').value = '';
        document.getElementById('shift_diff_text').innerText = '';

    } else {
        // لا توجد وردية -> عرض واجهة الفتح
        document.getElementById('openShiftSection').style.display = 'block';
        document.getElementById('closeShiftSection').style.display = 'none';
        document.getElementById('shiftModalTitle').innerText = 'بدء وردية جديدة';
        
        let sel = document.getElementById('shift_safe_select');
        sel.innerHTML = '';
        db.safes.forEach(s => {
            sel.innerHTML += `<option value="${s.id}">${s.name}</option>`;
        });
    }
    openModal('shiftModal');
}

function calcShiftDiff() {
    let expected = parseFloat(document.getElementById('lbl_expected_bal').getAttribute('data-val')) || 0;
    let actual = parseFloat(document.getElementById('shift_actual_balance').value) || 0;
    let diff = actual - expected;
    
    let txtObj = document.getElementById('shift_diff_text');
    if (diff === 0) {
        txtObj.innerText = "مطابق تماماً ✅"; txtObj.style.color = "var(--success)";
    } else if (diff > 0) {
        txtObj.innerText = `زيادة في الصندوق: +${displayNum(diff)} ⚠️`; txtObj.style.color = "var(--warning)";
    } else {
        txtObj.innerText = `عجز (نقص) في الصندوق: ${displayNum(diff)} ❌`; txtObj.style.color = "var(--danger)";
    }
}

function startShift() {
    let safeId = parseInt(document.getElementById('shift_safe_select').value);
    let openBal = parseFloat(document.getElementById('shift_open_balance').value) || 0;
    let userId = currentUser ? currentUser.id : 1;

    db.shifts.push({
        id: Date.now(), user_id: userId, safe_id: safeId, start_time: new Date().toISOString(),
        end_time: null, open_balance: openBal, close_balance: null, expected_balance: null, status: 'open'
    });

    saveData();
    closeModal('shiftModal');
    showSuccessPopup();
}

function closeShift() {
    let active = getActiveShift();
    if(!active) return;

    let actual = parseFloat(document.getElementById('shift_actual_balance').value);
    if(isNaN(actual)) return alert("يرجى إدخال الرصيد الفعلي الموجود بالدرج");

    let expected = parseFloat(document.getElementById('lbl_expected_bal').getAttribute('data-val')) || 0;
    let diff = actual - expected;

    if (diff !== 0) {
        if(!confirm(`يوجد ${diff > 0 ? 'زيادة' : 'عجز'} بقيمة ${displayNum(Math.abs(diff))}. هل أنت متأكد من إنهاء الوردية؟ (سيتم تسجيل الفارق كحركة تسوية)`)) return;
        
        // تسجيل التسوية
        if(diff > 0) addSystemTransaction('income', diff, `تسوية جرد وردية #${active.id} (زيادة)`, active.id, active.safe_id, active.id);
        if(diff < 0) addSystemTransaction('expense', Math.abs(diff), `تسوية جرد وردية #${active.id} (عجز)`, active.id, active.safe_id, active.id);
    }

    active.status = 'closed';
    active.end_time = new Date().toISOString();
    active.close_balance = actual;
    active.expected_balance = expected;

    saveData();
    closeModal('shiftModal');
    showSuccessPopup();
}

// دالة وسيطة للأنظمة الأخرى (تم تعديلها لتدعم الوردية والخزانة)
function addSystemTransaction(type, amount, desc, ref_id, specific_safe_id = null, specific_shift_id = null) {
    if (amount <= 0) return;
    
    // محاولة جلب الوردية المفتوحة إذا لم يتم تحديد خزانة معينة
    let activeShift = getActiveShift();
    let finalSafeId = specific_safe_id || (activeShift ? activeShift.safe_id : (db.safes[0] ? db.safes[0].id : 1));
    let finalShiftId = specific_shift_id || (activeShift ? activeShift.id : null);

    db.transactions.push({
        id: Date.now(), type: type, amount: parseFloat(amount), desc: desc,
        ref_id: ref_id || Date.now(), date: new Date().toISOString(),
        safe_id: finalSafeId, shift_id: finalShiftId
    });
    saveData();
}

function openTransactionModal(type) {
    let active = getActiveShift();
    if(!active) {
        alert("⚠️ لا توجد وردية مفتوحة. يرجى فتح وردية أولاً لتسجيل الحركات.");
        return;
    }

    document.getElementById('trans_type').value = type;
    document.getElementById('trans_amount').value = '';
    document.getElementById('trans_desc').value = '';
    
    let title = type === 'income' ? 'إضافة سند قبض (إيداع/وارد)' : 'إضافة سند صرف (مصروف/مسحوبات)';
    let btnClass = type === 'income' ? 'btn-success' : 'btn-danger';
    
    document.getElementById('transModalTitle').innerText = title;
    document.getElementById('btnSaveTrans').className = `btn btn-full ${btnClass}`;
    
    openModal('transactionModal');
}

function saveManualTransaction() {
    let type = document.getElementById('trans_type').value;
    let amount = parseFloat(document.getElementById('trans_amount').value);
    let desc = document.getElementById('trans_desc').value.trim();

    if (!amount || amount <= 0 || !desc) return alert("يرجى إدخال المبلغ والبيان بشكل صحيح");

    addSystemTransaction(type, amount, desc, 'يدوي');
    closeModal('transactionModal');
    showSuccessPopup();
}

function deleteTransaction(id) {
    if(confirm("هل أنت متأكد من حذف هذه الحركة؟ (سيؤثر على رصيد الخزانة والجرد)")) {
        db.transactions = db.transactions.filter(t => t.id !== id);
        saveData();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    updateTreasuryUI();
});