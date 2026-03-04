// --- 4. إدارة العملاء (Customer Management) ---
function saveCustomer() {
    let name = document.getElementById('c_name').value;
    let phone = document.getElementById('c_phone').value;
    if(!name) return alert("الاسم مطلوب");
    db.customers.push({ id: Date.now(), name: name, phone: phone, total_debt: 0, created_at: new Date().toISOString() });
    saveData(); closeModal('addCustomerModal');
    document.getElementById('c_name').value = ''; document.getElementById('c_phone').value = '';
    if(document.getElementById('selectCustomerModal').classList.contains('active')){ renderCustomerList(); }
}

function deleteCustomer(id) {
    let c = db.customers.find(x => x.id === id);
    if(c.total_debt > 0) return openModal('debtErrorModal');
    if(confirm(`هل أنت متأكد من حذف العميل "${c.name}" نهائياً؟`)) { db.customers = db.customers.filter(x => x.id !== id); saveData(); }
}

function openPayDebt(id) {
    let c = db.customers.find(c => c.id === id);
    document.getElementById('pay_customerId').value = id;
    document.getElementById('pay_cName').innerText = c.name;
    document.getElementById('pay_cDebt').innerText = displayNum(c.total_debt);
    document.getElementById('pay_amount').value = formatNum(c.total_debt);
    openModal('payDebtModal');
}

function processPayment() {
    let id = parseInt(document.getElementById('pay_customerId').value);
    let amount = parseFloat(document.getElementById('pay_amount').value);
    let c = db.customers.find(c => c.id === id);
    if(amount > 0 && amount <= c.total_debt) {
        c.total_debt -= amount; saveData(); closeModal('payDebtModal'); showSuccessPopup();
    } else { alert("مبلغ غير صحيح"); }
}

function openCustomerStatement(id) {
    let c = db.customers.find(x => x.id === id);
    document.getElementById('stmt_cName').innerText = c.name;
    document.getElementById('stmt_cDebt').innerText = displayNum(c.total_debt);
    let tbody = document.getElementById('statementTable'); tbody.innerHTML = '';
    let cSales = db.sales.filter(s => s.customer_id === id && s.invoice_type === 'credit').sort((a, b) => a.id - b.id);
    let totalHistoricalDebt = cSales.reduce((sum, s) => sum + (s.debt_amount !== undefined ? s.debt_amount : s.total), 0);
    let totalPaid = totalHistoricalDebt - c.total_debt;

    cSales.forEach(s => {
        let debtForThisSale = s.debt_amount !== undefined ? s.debt_amount : s.total;
        let unpaidForThisSale = 0;
        if (totalPaid >= debtForThisSale) { unpaidForThisSale = 0; totalPaid -= debtForThisSale; } 
        else { unpaidForThisSale = debtForThisSale - totalPaid; totalPaid = 0; }
        tbody.innerHTML += `<tr><td dir="ltr">${formatDateTime(s.date)}</td><td>${s.product_name}</td><td>${displayNum(debtForThisSale)}</td>
        <td style="color: ${unpaidForThisSale > 0 ? 'var(--danger)' : 'var(--success)'}; font-weight: bold;">${unpaidForThisSale > 0 ? displayNum(unpaidForThisSale) : 'مسدد'}</td></tr>`;
    });
    document.getElementById('btnPrintStatement').setAttribute('onclick', `printStatementTemplate(${id})`);
    openModal('statementModal');
}
