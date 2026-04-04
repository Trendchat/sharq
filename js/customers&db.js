// --- 4. إدارة العملاء والديون والرصيد (Customer Management) ---

function renderCustomerList() {
    let term = document.getElementById('customerSearchInput');
    if(!term) return;
    term = term.value.toLowerCase();
    
    let list = document.getElementById('customerSelectionGrid'); 
    if(!list) return;
    list.innerHTML = '';
    
    let filtered = db.customers.filter(c => c.name.toLowerCase().includes(term) || (c.phone && c.phone.includes(term)));
    
    if(filtered.length === 0) { 
        list.innerHTML = '<p style="text-align:center; grid-column: 1/-1; padding:10px;">لا يوجد عميل بهذا الاسم</p>'; 
    } else { 
        filtered.forEach(c => {
            let balanceBadge = (c.balance && c.balance > 0) ? `<div style="font-size:11px; color:var(--success); margin-top:3px;">رصيد: ${displayNum(c.balance)}</div>` : '';
            list.innerHTML += `<div class="unit-btn" onclick="selectCreditCustomer(${c.id}, '${c.name}')">
                <strong>${c.name}</strong>
                ${balanceBadge}
            </div>`; 
        }); 
    }
}

function saveCustomer() {
    let name = document.getElementById('c_name').value.trim();
    let phone = document.getElementById('c_phone').value.trim();
    let balanceInput = document.getElementById('c_balance');
    let balance = balanceInput ? (parseFloat(balanceInput.value) || 0) : 0;
    let creditLimit = parseFloat(document.getElementById('c_credit_limit').value) || 0;

    if(!name) return alert("الاسم مطلوب");
    
    db.customers.push({ 
        id: Date.now(), 
        name: name, 
        phone: phone, 
        total_debt: 0, 
        credit_limit: creditLimit, // حفظ الحد للعميل الجديد
        balance: balance, 
        created_at: new Date().toISOString() 
    });
    
    saveData(); 
    closeModal('addCustomerModal');
    
    document.getElementById('c_credit_limit').value = '';
    document.getElementById('c_name').value = ''; 
    document.getElementById('c_phone').value = '';
    if(balanceInput) balanceInput.value = '0';
    
    if(document.getElementById('selectCustomerModal') && document.getElementById('selectCustomerModal').classList.contains('active')){ 
        renderCustomerList(); 
    }
}

function deleteCustomer(id) {
    let c = db.customers.find(x => x.id === id);
    if(c.total_debt > 0) return openModal('debtErrorModal');
    
    if(c.balance > 0) {
        if(!confirm(`تنبيه: هذا العميل لديه رصيد مودع بقيمة ${displayNum(c.balance)}. هل أنت متأكد من حذفه وضياع الرصيد؟`)) return;
    }
    
    if(confirm(`هل أنت متأكد من حذف العميل "${c.name}" نهائياً؟`)) { 
        db.customers = db.customers.filter(x => x.id !== id); 
        saveData(); 
    }
}

function openPayDebt(id) {
    let c = db.customers.find(c => c.id === id);
    document.getElementById('pay_customerId').value = id;
    document.getElementById('pay_cName').innerText = c.name;
    document.getElementById('pay_cDebt').innerText = displayNum(c.total_debt || 0);
    
    let balEl = document.getElementById('pay_cBalance');
    if(balEl) balEl.innerText = displayNum(c.balance || 0);

    document.getElementById('pay_amount').value = '';
    openModal('payDebtModal');
}

function processPayment() {
    let id = parseInt(document.getElementById('pay_customerId').value);
    let amount = parseFloat(document.getElementById('pay_amount').value);
    let c = db.customers.find(c => c.id === id);
    
    if(amount > 0) {
        // تم استخدام parseFloat لضمان عدم حدوث دمج نصي للأرقام
        let currentDebt = parseFloat(c.total_debt) || 0;
        let currentBalance = parseFloat(c.balance) || 0;
        
        if (amount <= currentDebt) {
            c.total_debt = currentDebt - amount; 
            if(typeof addSystemTransaction === 'function') {
                addSystemTransaction('income', amount, `سداد دفعة من دين العميل: ${c.name}`, `cust_${id}`);
            }
        } else {
            let excess = amount - currentDebt;
            c.total_debt = 0;
            c.balance = currentBalance + excess; // جمع رياضي آمن
            
            let desc = currentDebt > 0 
                ? `تصفية دين (${displayNum(currentDebt)}) وإيداع رصيد (${displayNum(excess)}) للعميل: ${c.name}`
                : `إيداع رصيد مسبق للعميل: ${c.name}`;
                
            if(typeof addSystemTransaction === 'function') {
                addSystemTransaction('income', amount, desc, `cust_${id}`);
            }
        }
        
        saveData(); 
        closeModal('payDebtModal'); 
        showSuccessPopup();
    } else { 
        alert("مبلغ غير صحيح"); 
    }
}

// كشف الحساب الشامل والجديد كلياً
function openCustomerStatement(id) {
    let c = db.customers.find(x => x.id === id);
    document.getElementById('stmt_cName').innerText = c.name;
    document.getElementById('stmt_cDebt').innerText = displayNum(c.total_debt || 0);
    
    // تعديل ترويسة الجدول برمجياً لتناسب الكشف الشامل
    let thead = document.querySelector('#statementModal table thead');
    if(thead) {
        thead.innerHTML = `<tr>
            <th>التاريخ</th>
            <th>البيان</th>
            <th>المبلغ</th>
            <th>نوع الحركة</th>
        </tr>`;
    }

    let tbody = document.getElementById('statementTable'); 
    tbody.innerHTML = '';
    
    let allMovements = [];

    // 1. فواتير السلف (الدين)
    db.sales.filter(s => s.customer_id === id && s.invoice_type === 'credit').forEach(s => {
        let amt = s.debt_amount !== undefined ? s.debt_amount : s.total;
        allMovements.push({ date: new Date(s.date), desc: `فاتورة سلف #${s.id} (${s.product_name})`, amount: amt, type: 'سحب (دين)', color: 'var(--danger)' });
    });

    // 2. فواتير مسحوبة من الرصيد المودع
    db.sales.filter(s => s.customer_id === id && s.paid_from_balance > 0).forEach(s => {
        allMovements.push({ date: new Date(s.date), desc: `مشتريات خصمت من الرصيد #${s.id}`, amount: s.paid_from_balance, type: 'خصم من الرصيد', color: '#e67e22' });
    });

    // 3. الدفعات النقدية (إيداع أو سداد) المسجلة في الصندوق
    db.transactions.filter(t => t.ref_id === `cust_${id}` || (t.desc && t.desc.includes(`للعميل: ${c.name}`))).forEach(t => {
        allMovements.push({ date: new Date(t.date), desc: t.desc, amount: t.amount, type: 'إيداع / سداد', color: 'var(--success)' });
    });

    // ترتيب زمني من الأقدم للأحدث
    allMovements.sort((a, b) => a.date - b.date);

    if(allMovements.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">لا توجد حركات مسجلة لهذا العميل</td></tr>`;
    } else {
        allMovements.forEach(m => {
            tbody.innerHTML += `<tr>
                <td dir="ltr" style="font-size:12px;">${formatDateTime(m.date.toISOString())}</td>
                <td style="font-size:12px; max-width:150px;">${m.desc}</td>
                <td dir="ltr" style="font-weight:bold; color:${m.color}">${displayNum(m.amount)}</td>
                <td><span class="badge-small" style="background:${m.color}">${m.type}</span></td>
            </tr>`;
        });
    }
    
    let printBtn = document.getElementById('btnPrintStatement');
    if(printBtn) printBtn.setAttribute('onclick', `printStatementTemplate(${id})`);
    openModal('statementModal');
}

// --- 1. تهيئة قاعدة البيانات ---
let db = {
	suppliers: JSON.parse(localStorage.getItem('sys_suppliers')) || [],
    products: JSON.parse(localStorage.getItem('sys_products')) || [],
    customers: JSON.parse(localStorage.getItem('sys_customers')) || [],
    sales: JSON.parse(localStorage.getItem('sys_sales')) || [],
    shipments: JSON.parse(localStorage.getItem('sys_shipments')) || [],
    purchases: JSON.parse(localStorage.getItem('sys_purchases')) || [],
    transactions: JSON.parse(localStorage.getItem('sys_transactions')) || [],
    safes: JSON.parse(localStorage.getItem('sys_safes')) || [], 
    shifts: JSON.parse(localStorage.getItem('sys_shifts')) || [], 
    transfers: JSON.parse(localStorage.getItem('sys_transfers')) || [], 
    users: JSON.parse(localStorage.getItem('sys_users')) || [],
    activity_logs: JSON.parse(localStorage.getItem('sys_activity_logs')) || [],
    settings: JSON.parse(localStorage.getItem('sys_settings')) || {
        storeName: "نظام الشرق", currency: "ريال", invoiceFormat: "thermal", theme: "default", taxRate: 0, globalCreditLimit: 50000,
        storeAddress: "", storeContact: "", storeLogo: "", printerSize: "80mm", receiptFontSize: 14, receiptMargin: 10
    }
};

if (db.users.length === 0) {
    db.users.push({
        id: 1, fullName: "مدير النظام", username: "admin", password: "123", role: "admin", status: "active", allowedDevice: "all", createdAt: new Date().toISOString(), lastLogin: null,
        permissions: { sales_create: true, sales_edit: true, sales_delete: true, inv_add: true, inv_edit: true, inv_delete: true, inv_cost: true, cust_add: true, cust_edit: true, cust_delete: true, rep_view: true, rep_export: true, sys_users: true, sys_backup: true }
    });
}

if (db.safes.length === 0) {
    db.safes.push({
        id: 1, name: "صندوق المبيعات الرئيسي", branch: "الفرع الرئيسي", balance: 0, max_limit: 100000, created_at: new Date().toISOString()
    });
}

db.transactions = db.transactions.map(t => { if (!t.safe_id) t.safe_id = 1; return t; });
db.customers = db.customers.map(c => { if (c.balance === undefined) c.balance = 0; return c; });

function saveData() {
    localStorage.setItem('sys_products', JSON.stringify(db.products));
    localStorage.setItem('sys_customers', JSON.stringify(db.customers));
    localStorage.setItem('sys_sales', JSON.stringify(db.sales));
    localStorage.setItem('sys_shipments', JSON.stringify(db.shipments));
    localStorage.setItem('sys_purchases', JSON.stringify(db.purchases)); 
    localStorage.setItem('sys_transactions', JSON.stringify(db.transactions)); 
    localStorage.setItem('sys_safes', JSON.stringify(db.safes)); 
    localStorage.setItem('sys_shifts', JSON.stringify(db.shifts)); 
    localStorage.setItem('sys_transfers', JSON.stringify(db.transfers)); 
    localStorage.setItem('sys_settings', JSON.stringify(db.settings));
    localStorage.setItem('sys_users', JSON.stringify(db.users)); 
    localStorage.setItem('sys_activity_logs', JSON.stringify(db.activity_logs)); 
    localStorage.setItem('sys_suppliers', JSON.stringify(db.suppliers));
    
    if (typeof updateUI === 'function') updateUI(); 
    if (typeof updateTreasuryUI === 'function') updateTreasuryUI();
}