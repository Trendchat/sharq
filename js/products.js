// --- 3. إدارة المنتجات (Product Management) ---

document.addEventListener("DOMContentLoaded", () => {
    let addProdModal = document.getElementById('addProductModal');
    if (addProdModal && !document.getElementById('p_deduct_capital')) {
        let formGrid = addProdModal.querySelector('.form-grid');
        let div = document.createElement('div');
        div.className = 'form-group';
        div.style.gridColumn = '1 / -1';
        div.style.background = '#e8f8f5'; div.style.padding = '10px'; div.style.borderRadius = '5px';
        div.innerHTML = `<label style="cursor:pointer; font-weight:bold; color:#16a085;"><input type="checkbox" id="p_deduct_capital" checked style="width:auto; margin-left:10px;"> خصم تكلفة شراء الكمية الافتتاحية من صندوق المبيعات</label>`;
        formGrid.appendChild(div);
    }
});

function openUnitSelect(target) {
    document.getElementById('activeUnitTarget').value = target;
    openModal('unitSelectModal');
}

function selectUnit(unitName) {
    let target = document.getElementById('activeUnitTarget').value;
    if(target === 'small') document.getElementById('p_unitSmall').value = unitName;
    if(target === 'big') document.getElementById('p_unitBig').value = unitName;
    let big = document.getElementById('p_unitBig').value;
    let small = document.getElementById('p_unitSmall').value;
    document.getElementById('lbl_convert').innerText = `الـ ${big} كم ${small}؟`;
    document.querySelectorAll('.lbl_big').forEach(el => el.innerText = big);
    document.querySelectorAll('.lbl_small').forEach(el => el.innerText = small);
    closeModal('unitSelectModal');
}

function calcPrices(source) {
    let conv = parseFloat(document.getElementById('p_convert').value) || 1;
    if(source === 'buy_big') {
        let big = parseFloat(document.getElementById('p_buy_big').value) || 0;
        document.getElementById('p_buy_small').value = formatNum(big / conv);
    } else if(source === 'buy_small') {
        let small = parseFloat(document.getElementById('p_buy_small').value) || 0;
        document.getElementById('p_buy_big').value = formatNum(small * conv);
    }
}

function saveProduct() {
    let name = document.getElementById('p_name').value;
    // التقاط قيمة الباركود
    let barcodeElem = document.getElementById('p_barcode');
    let barcode = barcodeElem ? barcodeElem.value.trim() : ''; 
    
    let uSmall = document.getElementById('p_unitSmall').value;
    let uBig = document.getElementById('p_unitBig').value;
    let conv = parseFloat(document.getElementById('p_convert').value) || 1;
    let pBuyBig = formatNum(document.getElementById('p_buy_big').value);
    let pBuySmall = formatNum(document.getElementById('p_buy_small').value);
    let pSellBig = formatNum(document.getElementById('p_sell_big').value);
    let pSellSmall = formatNum(document.getElementById('p_sell_small').value);
    let initialBig = parseFloat(document.getElementById('p_stock').value) || 0;
    let pExpiry = document.getElementById('p_expiry').value; 

    if(!name || pBuySmall <= 0 || pSellSmall <= 0) return alert("يرجى إكمال البيانات والأسعار بشكل صحيح");

    let initialBatches = [];
    if (initialBig > 0) {
        initialBatches.push({ batch_id: Date.now(), qty_big: initialBig, expiry_date: pExpiry || null, date_added: new Date().toISOString() });
    }

    db.products.push({
        id: Date.now(), name: name, barcode: barcode, unit_small: uSmall, unit_big: uBig, convert_factor: conv,
        buy_price_big: pBuyBig, buy_price_small: pBuySmall, sell_price_big: pSellBig, sell_price_small: pSellSmall,
        stock: initialBig * conv, batches: initialBatches, created_at: new Date().toISOString()
    });

    let isDeductChecked = document.getElementById('p_deduct_capital') ? document.getElementById('p_deduct_capital').checked : false;
    let totalPurchaseCost = initialBig * pBuyBig;
    
    if (isDeductChecked && totalPurchaseCost > 0) {
        db.purchases.push({
            id: Date.now(), type: 'new_product', product_name: name, amount: totalPurchaseCost, date: new Date().toISOString()
        });
        if(typeof addSystemTransaction === 'function') {
            addSystemTransaction('expense', totalPurchaseCost, `تكلفة شراء بضاعة (صنف جديد): ${name}`, Date.now());
        }
    }

    saveData(); closeModal('addProductModal');
    document.querySelectorAll('#addProductModal input[type="text"], #addProductModal input[type="number"], #addProductModal input[type="date"]').forEach(i => i.value = '');
    document.getElementById('p_unitSmall').value = 'حبة'; document.getElementById('p_unitBig').value = 'كرتون';
    document.getElementById('p_convert').value = '12';
}

function promptDeleteProduct(id) {
    let prod = db.products.find(p => p.id === id);
    document.getElementById('deleteProductId').value = id;
    let msg = `هل أنت متأكد من حذف الصنف "${prod.name}"؟`;
    if (prod.stock > 0) {
        msg = `⚠️ انتبه! الصنف "${prod.name}" لا يزال تتوفر منه كمية في المخزون. هل أنت متأكد من رغبتك في حذفه نهائياً؟`;
    }
    document.getElementById('deleteProductMsg').innerText = msg;
    openModal('confirmDeleteProductModal');
}

function confirmDeleteProduct() {
    let id = parseInt(document.getElementById('deleteProductId').value);
    db.products = db.products.filter(p => p.id !== id);
    saveData(); closeModal('confirmDeleteProductModal');
}

function openRestock(id) {
    let prod = db.products.find(p => p.id === id);
    document.getElementById('restock_id').value = id;
    document.getElementById('restock_info').innerText = `الصنف: ${prod.name} | الوحدة الكبرى: ${prod.unit_big}`;
    document.getElementById('restock_qty').value = 1;
    document.getElementById('restock_buy_price').value = prod.buy_price_big || 0;
    document.getElementById('restock_sell_price').value = prod.sell_price_big || 0;
    document.getElementById('restock_expiry').value = ''; 

    let restockModal = document.getElementById('restockModal');
    if (restockModal && !document.getElementById('r_deduct_capital')) {
        let btn = restockModal.querySelector('button.btn-warning.btn-full');
        let div = document.createElement('div');
        div.className = 'form-group';
        div.style.background = '#e8f8f5'; div.style.padding = '10px'; div.style.borderRadius = '5px'; div.style.marginBottom = '15px';
        div.innerHTML = `<label style="cursor:pointer; font-weight:bold; color:#16a085;"><input type="checkbox" id="r_deduct_capital" checked style="width:auto; margin-left:10px;"> خصم تكلفة هذا التوريد من الصندوق</label>`;
        btn.parentNode.insertBefore(div, btn);
    }
    
    openModal('restockModal');
}

function processRestock() {
    let id = parseInt(document.getElementById('restock_id').value);
    let qtyBig = parseFloat(document.getElementById('restock_qty').value);
    let newBuyBig = parseFloat(document.getElementById('restock_buy_price').value) || 0;
    let newSellBig = parseFloat(document.getElementById('restock_sell_price').value) || 0;
    let expiryDate = document.getElementById('restock_expiry').value; 

    let prod = db.products.find(p => p.id === id);
    
    if(qtyBig > 0) {
        prod.stock += (qtyBig * prod.convert_factor);
        
        if (!prod.batches) prod.batches = [];
        prod.batches.push({ batch_id: Date.now(), qty_big: qtyBig, expiry_date: expiryDate || null, date_added: new Date().toISOString() });

        if(newBuyBig > 0) {
            prod.buy_price_big = newBuyBig;
            prod.buy_price_small = formatNum(newBuyBig / prod.convert_factor);
        }
        if(newSellBig > 0) {
            prod.sell_price_big = newSellBig;
            prod.sell_price_small = formatNum(newSellBig / prod.convert_factor);
        }

        let isDeductChecked = document.getElementById('r_deduct_capital') ? document.getElementById('r_deduct_capital').checked : false;
        let totalRestockCost = qtyBig * (newBuyBig > 0 ? newBuyBig : prod.buy_price_big);
        
        if (isDeductChecked && totalRestockCost > 0) {
            db.purchases.push({
                id: Date.now(), type: 'restock', product_name: prod.name, amount: totalRestockCost, date: new Date().toISOString()
            });
            if(typeof addSystemTransaction === 'function') {
                addSystemTransaction('expense', totalRestockCost, `توريد بضاعة للمخزون: ${prod.name}`, Date.now());
            }
        }

        db.shipments.push({ id: Date.now(), product_id: id, quantity_big: qtyBig, batch_expiry: expiryDate, date: new Date().toISOString() });
        saveData(); closeModal('restockModal');
    }
}

// ==========================================
// --- إدارة الموردين وفواتير المشتريات ---
// ==========================================

// --- 1. الموردين (Suppliers) ---
function renderSuppliers() {
    let tbody = document.getElementById('suppliersTable');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    db.suppliers.forEach(s => {
        let balColor = s.balance > 0 ? 'var(--danger)' : (s.balance < 0 ? 'var(--success)' : '#555');
        let balText = s.balance > 0 ? `له ${displayNum(s.balance)}` : (s.balance < 0 ? `لنا ${displayNum(Math.abs(s.balance))}` : '0');
        
        let limitWarning = (s.credit_limit > 0 && s.balance > s.credit_limit) ? '<br><small style="color:red;">⚠️ تجاوز الحد الائتماني</small>' : '';

        tbody.innerHTML += `
            <tr>
                <td><strong>${s.name}</strong></td>
                <td dir="ltr">${s.phone || '-'}</td>
                <td style="color:${balColor}; font-weight:bold;">${balText} ${limitWarning}</td>
                <td>${s.credit_limit > 0 ? displayNum(s.credit_limit) : 'لا يوجد'}</td>
                <td>
                    <button class="btn btn-primary" style="padding:5px 10px; font-size:12px;" onclick="openSupplierStatement(${s.id})">🧾 كشف</button>
                    <button class="btn btn-success" style="padding:5px 10px; font-size:12px;" onclick="openPaySupplier(${s.id})">💰 سداد</button>
                </td>
            </tr>`;
    });
}

function saveSupplier() {
    let name = document.getElementById('sup_name').value.trim();
    if(!name) return alert("يرجى إدخال اسم المورد");
    
    db.suppliers.push({
        id: Date.now(),
        name: name,
        phone: document.getElementById('sup_phone').value,
        balance: parseFloat(document.getElementById('sup_balance').value) || 0,
        credit_limit: parseFloat(document.getElementById('sup_limit').value) || 0,
        created_at: new Date().toISOString()
    });
    
    saveData();
    closeModal('addSupplierModal');
    renderSuppliers();
    showSuccessPopup();
}

// --- 2. سداد الموردين (Payments) ---
function openPaySupplier(id) {
    let sup = db.suppliers.find(s => s.id === id);
    document.getElementById('pay_supId').value = id;
    document.getElementById('pay_supName').innerText = sup.name;
    document.getElementById('pay_supDebt').innerText = displayNum(sup.balance);
    document.getElementById('pay_supAmount').value = '';
    
    let safeSelect = document.getElementById('pay_supSafe');
    safeSelect.innerHTML = '';
    db.safes.forEach(s => safeSelect.innerHTML += `<option value="${s.id}">${s.name} (رصيد: ${displayNum(calculateSafeBalance(s.id))})</option>`);
    
    openModal('paySupplierModal');
}

function processSupplierPayment() {
    let supId = parseInt(document.getElementById('pay_supId').value);
    let amount = parseFloat(document.getElementById('pay_supAmount').value);
    let safeId = parseInt(document.getElementById('pay_supSafe').value);
    
    if(!amount || amount <= 0) return alert("أدخل مبلغاً صحيحاً");
    
    let safeBal = calculateSafeBalance(safeId);
    if(amount > safeBal) return alert("لا يوجد رصيد كافي في هذه الخزانة لسداد المبلغ!");

    let sup = db.suppliers.find(s => s.id === supId);
    sup.balance -= amount; // تقليل الديون التي علينا للمورد
    
    // تسجيل حركة الصندوق (منصرف)
    addSystemTransaction('expense', amount, `سداد دفعة للمورد: ${sup.name}`, `sup_${supId}`, safeId);
    
    saveData();
    closeModal('paySupplierModal');
    renderSuppliers();
    updateTreasuryUI();
    showSuccessPopup();
}

// --- 3. كشف حساب المورد (Statement) ---
function openSupplierStatement(id) {
    let sup = db.suppliers.find(s => s.id === id);
    document.getElementById('stmt_supName').innerText = sup.name;
    document.getElementById('stmt_supBalance').innerText = displayNum(sup.balance);
    
    let tbody = document.getElementById('supplierStatementBody');
    tbody.innerHTML = '';
    
    let movements = [];
    
    // جلب فواتير الآجل
    db.purchases.filter(p => p.supplier_id === id && p.payment_type === 'credit').forEach(p => {
        movements.push({ date: new Date(p.date), desc: `فاتورة مشتريات آجل #${p.id}`, debit: p.final_total, credit: 0 });
    });
    
    // جلب التسديدات
    db.transactions.filter(t => t.ref_id === `sup_${id}`).forEach(t => {
        movements.push({ date: new Date(t.date), desc: t.desc, debit: 0, credit: t.amount });
    });
    
    movements.sort((a,b) => a.date - b.date);
    
    movements.forEach(m => {
        tbody.innerHTML += `
            <tr>
                <td dir="ltr" style="font-size:12px;">${formatDateTime(m.date.toISOString())}</td>
                <td>${m.desc}</td>
                <td style="color:var(--danger); font-weight:bold;">${m.debit > 0 ? displayNum(m.debit) : '-'}</td>
                <td style="color:var(--success); font-weight:bold;">${m.credit > 0 ? displayNum(m.credit) : '-'}</td>
            </tr>`;
    });
    
    openModal('supplierStatementModal');
}

// --- 4. فواتير المشتريات (Purchase Invoices) ---
function togglePurchaseSafe() {
    let type = document.getElementById('pur_paymentType').value;
    document.getElementById('pur_safeGroup').style.display = type === 'cash' ? 'block' : 'none';
}

function openAddPurchaseModal() {
    document.getElementById('pur_supplier_search').value = '';
    document.getElementById('pur_supplier_id').value = '';
    
    let safeSelect = document.getElementById('pur_safe');
    safeSelect.innerHTML = '';
    db.safes.forEach(s => safeSelect.innerHTML += `<option value="${s.id}">${s.name}</option>`);
    
    document.getElementById('purchaseItemsBody').innerHTML = '';
    document.getElementById('pur_discount').value = 0;
    calculatePurchaseTotal();
    togglePurchaseSafe();
    
    openModal('addPurchaseModal');
}

function addPurchaseItemRow() {
    let tbody = document.getElementById('purchaseItemsBody');
    let rowId = Date.now();
    
    let productOptions = '<option value="">-- اختر الصنف --</option>';
    db.products.forEach(p => productOptions += `<option value="${p.id}" data-price="${p.buy_price_big}">${p.name}</option>`);
    
    let tr = document.createElement('tr');
    tr.id = `pur_row_${rowId}`;
    tr.innerHTML = `
        <td><select class="pur-item-select" style="width:100%;" onchange="updatePurchaseRowPrice(${rowId})">${productOptions}</select></td>
        <td><input type="number" class="pur-item-qty" min="1" value="1" style="width:100%;" oninput="calcPurchaseRowTotal(${rowId})"></td>
        <td><input type="number" class="pur-item-price" step="0.01" style="width:100%;" oninput="calcPurchaseRowTotal(${rowId})"></td>
        <td><span class="pur-item-total" style="font-weight:bold;">0</span></td>
        <td><button class="btn btn-danger" style="padding:5px;" onclick="document.getElementById('pur_row_${rowId}').remove(); calculatePurchaseTotal();">🗑</button></td>
    `;
    tbody.appendChild(tr);
}

function updatePurchaseRowPrice(rowId) {
    let row = document.getElementById(`pur_row_${rowId}`);
    let select = row.querySelector('.pur-item-select');
    let priceInput = row.querySelector('.pur-item-price');
    let selectedOption = select.options[select.selectedIndex];
    
    if(selectedOption.value) {
        priceInput.value = selectedOption.getAttribute('data-price');
        calcPurchaseRowTotal(rowId);
    }
}

function calcPurchaseRowTotal(rowId) {
    // تم إصلاح استدعاء الـ ID
    let row = document.getElementById(rowId);
    if (!row) return;

    let qty = parseFloat(row.querySelector('.pur-item-qty').value) || 0;
    let price = parseFloat(row.querySelector('.pur-item-price').value) || 0;
    
    let rowTotal = qty * price;
    
    // تحديث النص المعروض
    row.querySelector('.pur-item-total').innerText = displayNum(rowTotal);
    // تحديث القيمة المخفية لاستخدامها في الإجمالي الكلي
    row.setAttribute('data-total', rowTotal);
    
    // استدعاء تحديث الإجمالي الكلي للفاتورة
    calculatePurchaseTotal();
}

// --- 3. إصلاح دالة الإجمالي الكلي والخصم ---
function calculatePurchaseTotal() {
    let rows = document.querySelectorAll('#purchaseItemsBody tr');
    let subtotal = 0;
    
    rows.forEach(r => {
        subtotal += parseFloat(r.getAttribute('data-total') || 0);
    });
    
    let discount = parseFloat(document.getElementById('pur_discount').value) || 0;
    let grandTotal = subtotal - discount;
    
    // التأكد من عدم وجود إجمالي بالسالب
    if(grandTotal < 0) grandTotal = 0;
    
    document.getElementById('pur_subtotal').innerText = displayNum(subtotal);
    document.getElementById('pur_grandTotal').innerText = displayNum(grandTotal);
}

// --- تحديث: إغلاق قائمة الموردين المنسدلة عند النقر خارجها ---
document.addEventListener('click', function(e) {
    let list = document.getElementById('pur_supplier_list');
    let searchInput = document.getElementById('pur_supplier_search');
    if (list && e.target !== list && e.target !== searchInput) {
        list.style.display = 'none';
    }
});

// --- دوال اختيار المورد المدمجة في الفاتورة ---
function showPurSuppliersList() {
    filterPurSuppliers();
    document.getElementById('pur_supplier_list').style.display = 'block';
}

function filterPurSuppliers() {
    let term = document.getElementById('pur_supplier_search').value.toLowerCase();
    let list = document.getElementById('pur_supplier_list');
    list.innerHTML = '';
    
    let filtered = db.suppliers.filter(s => s.name.toLowerCase().includes(term));
    if(filtered.length === 0) {
        list.innerHTML = '<div style="padding:10px; text-align:center; color:#777;">لا يوجد مورد بهذا الاسم</div>';
        return;
    }
    
    filtered.forEach(s => {
        list.innerHTML += `<div style="padding:10px; border-bottom:1px solid #eee; cursor:pointer;" onmouseover="this.style.background='#f0f0f0'" onmouseout="this.style.background='#fff'" onclick="selectPurSupplier(${s.id}, '${s.name}')">
            <strong>${s.name}</strong> <small style="color:#777;">(رصيد: ${displayNum(s.balance)})</small>
        </div>`;
    });
}

function selectPurSupplier(id, name) {
    document.getElementById('pur_supplier_id').value = id;
    document.getElementById('pur_supplier_search').value = name;
    document.getElementById('pur_supplier_list').style.display = 'none';
}

// --- دوال اختيار الصنف المدمجة في الفاتورة ---
function openPurItemModal() {
    document.getElementById('purItemSearchInput').value = '';
    filterPurItems();
    openModal('purSelectItemModal');
}

// --- دوال اختيار الصنف للفاتورة ---
function filterPurItems() {
    let term = document.getElementById('purItemSearchInput').value.toLowerCase();
    let list = document.getElementById('purItemSelectionList');
    list.innerHTML = '';
    
    let filtered = db.products.filter(p => p.name.toLowerCase().includes(term) || (p.barcode && p.barcode.toLowerCase().includes(term)));
    
    if(filtered.length === 0) {
        list.innerHTML = '<p style="text-align:center; padding:15px; color:#777;">لا يوجد صنف مطابق</p>';
    } else {
        filtered.forEach(p => {
            // نمرر الـ id الخاص بالمنتج للدالة لجلبه بالكامل
            list.innerHTML += `
                <div style="padding:12px; border:1px solid #ddd; margin-bottom:8px; border-radius:6px; cursor:pointer; display:flex; justify-content:space-between; align-items:center;" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='#ddd'" onclick="addPurItemToTable(${p.id})">
                    <strong>${p.name}</strong>
                    <span class="badge-small" style="background:var(--secondary)">تكلفة الكبرى: ${displayNum(p.buy_price_big)}</span>
                </div>`;
        });
    }
}

function addPurItemToTable(prodId) {
    let p = db.products.find(x => x.id === prodId);
    if(!p) return;

    let tbody = document.getElementById('purchaseItemsBody');
    // توليد ID فريد للصف
    let rowId = 'pur_row_' + p.id + '_' + Date.now();
    
    let tr = document.createElement('tr');
    tr.id = rowId;
    tr.setAttribute('data-prod-id', p.id);
    tr.setAttribute('data-is-big', 'true'); // افتراضياً بالوحدة الكبرى
    tr.setAttribute('data-total', p.buy_price_big); // افتراضياً السعر الكبير

    tr.innerHTML = `
        <td style="font-weight:bold; color:var(--primary); padding: 5px; font-size: 12px; max-width: 120px;">${p.name}</td>
        <td style="padding: 5px;"><input type="number" class="pur-item-qty" min="1" value="1" style="width:60px; padding: 5px; text-align:center;" oninput="calcPurchaseRowTotal('${rowId}')"></td>
        <td style="padding: 5px;">
            <button class="btn" id="btn_unit_${rowId}" style="background:var(--secondary); color:#fff; padding:4px 8px; font-size:11px; width: 100%;" onclick="togglePurItemUnit('${rowId}')">🔄 ${p.unit_big}</button>
        </td>
        <td style="padding: 5px;"><input type="number" class="pur-item-price" step="0.01" value="${p.buy_price_big}" style="width:70px; padding: 5px; text-align:center;" oninput="calcPurchaseRowTotal('${rowId}')"></td>
        <td style="padding: 5px;"><span class="pur-item-total" style="font-weight:bold; font-size: 13px;">${displayNum(p.buy_price_big)}</span></td>
        <td style="padding: 5px;"><button class="btn btn-danger" style="padding:4px 8px;" onclick="document.getElementById('${rowId}').remove(); calculatePurchaseTotal();">🗑</button></td>
    `;
    
    tbody.appendChild(tr);
    calculatePurchaseTotal(); // تحديث الإجمالي الكلي فور إضافة الصنف
    closeModal('purSelectItemModal');
}

// دالة التبديل بين الكرتون والحبة (الوحدات)
function togglePurItemUnit(rowId) {
    let row = document.getElementById(rowId);
    if (!row) return;

    let prodId = parseInt(row.getAttribute('data-prod-id'));
    let p = db.products.find(x => x.id === prodId);
    if(!p) return;

    if (p.convert_factor <= 1) {
        alert("هذا الصنف يباع بوحدة واحدة فقط ولا يمتلك تجزئة.");
        return;
    }

    let isBig = row.getAttribute('data-is-big') === 'true';
    let newIsBig = !isBig; // عكس الحالة
    row.setAttribute('data-is-big', newIsBig);

    let btn = document.getElementById(`btn_unit_${rowId}`);
    let priceInput = row.querySelector('.pur-item-price');

    // حساب ذكي للسعر الصغير لتجنب الأخطاء
    let smallPrice = p.buy_price_small ? p.buy_price_small : formatNum(p.buy_price_big / p.convert_factor);

    if(newIsBig) {
        btn.innerText = `🔄 ${p.unit_big}`;
        priceInput.value = p.buy_price_big;
    } else {
        btn.innerText = `🔄 ${p.unit_small}`;
        priceInput.value = smallPrice;
    }

    // إجبار النظام على إعادة حساب الصف والإجمالي بعد تغيير الوحدة والسعر
    calcPurchaseRowTotal(rowId);
}

// تحديث دالة حفظ الفاتورة لتلائم الوحدات الجديدة
function savePurchaseInvoice() {
    let supplierId = document.getElementById('pur_supplier_id').value;
    let paymentType = document.getElementById('pur_paymentType').value;
    let safeId = parseInt(document.getElementById('pur_safe').value);
    let grandTotal = parseFloat(document.getElementById('pur_grandTotal').innerText.replace(/,/g, ''));
    
    if(paymentType === 'credit' && !supplierId) return alert("يجب اختيار مورد في حالة الشراء الآجل من حقل البحث!");
    
    let items = [];
    document.querySelectorAll('#purchaseItemsBody tr').forEach(row => {
        let prodId = parseInt(row.getAttribute('data-prod-id'));
        let isBig = row.getAttribute('data-is-big') === 'true';
        let qty = parseFloat(row.querySelector('.pur-item-qty').value) || 0;
        let price = parseFloat(row.querySelector('.pur-item-price').value) || 0;
        let unitName = row.querySelector(`#btn_unit_${row.id}`).innerText.replace('🔄 ', '');

        if(prodId && qty > 0) items.push({ id: prodId, isBig: isBig, unitName: unitName, qty: qty, price: price });
    });
    
    if(items.length === 0) return alert("يجب إضافة صنف واحد على الأقل");
    
    if(paymentType === 'cash') {
        let safeBal = calculateSafeBalance(safeId);
        if(grandTotal > safeBal) return alert("لا يوجد رصيد كافي في الصندوق لإتمام الشراء النقدي!");
    }

    let invoiceId = Date.now();
    
    // تحديث المخزون والأسعار بناءً على الوحدة التي تم شراؤها
    items.forEach(item => {
        let p = db.products.find(x => x.id === item.id);
        if(p) {
            // إضافة الكمية للمخزون
            let qtyToAdd = item.isBig ? (item.qty * p.convert_factor) : item.qty;
            p.stock += qtyToAdd;

            // تحديث سعر التكلفة
            if (item.isBig) {
                p.buy_price_big = item.price;
                p.buy_price_small = formatNum(item.price / p.convert_factor);
            } else {
                p.buy_price_small = item.price;
                p.buy_price_big = formatNum(item.price * p.convert_factor);
            }
        }
    });

    if(paymentType === 'cash') {
        addSystemTransaction('expense', grandTotal, `مشتريات نقدية فاتورة #${invoiceId}`, invoiceId, safeId);
    } else {
        let sup = db.suppliers.find(s => s.id === parseInt(supplierId));
        if(sup) sup.balance += grandTotal;
    }

    db.purchases.push({
        id: invoiceId,
        supplier_id: supplierId ? parseInt(supplierId) : null,
        payment_type: paymentType,
        total: grandTotal + (parseFloat(document.getElementById('pur_discount').value) || 0),
        discount: parseFloat(document.getElementById('pur_discount').value) || 0,
        final_total: grandTotal,
        items: items,
        date: new Date().toISOString()
    });

    saveData();
    closeModal('addPurchaseModal');
    renderPurchases();
    if (typeof updateUI === 'function') updateUI(); 
    showSuccessPopup();
}

// --- تحديث دالة فتح نافذة المشتريات لتفريغ البيانات القديمة ---
function openAddPurchaseModal() {
    document.getElementById('pur_supplier_search').value = '';
    document.getElementById('pur_supplier_id').value = '';
    
    let safeSelect = document.getElementById('pur_safe');
    safeSelect.innerHTML = '';
    db.safes.forEach(s => safeSelect.innerHTML += `<option value="${s.id}">${s.name}</option>`);
    
    document.getElementById('purchaseItemsBody').innerHTML = '';
    document.getElementById('pur_discount').value = 0;
    calculatePurchaseTotal();
    togglePurchaseSafe();
    
    openModal('addPurchaseModal');
}

// --- تحديث دالة ريندر المشتريات لإضافة زر الطباعة ---
function renderPurchases() {
    let tbody = document.getElementById('purchasesTable');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    let sortedPurchases = [...db.purchases].filter(p => p.items).sort((a,b) => b.id - a.id);
    
    sortedPurchases.forEach(p => {
        let supName = p.supplier_id ? (db.suppliers.find(s => s.id === p.supplier_id)?.name || 'غير محدد') : 'نقدي عام';
        let typeBadge = p.payment_type === 'cash' ? `<span class="badge-small" style="background:var(--success)">نقدي</span>` : `<span class="badge-small" style="background:var(--danger)">آجل</span>`;
        
        // شارات حالة الفاتورة
        let statusBadge = '';
        if (p.is_returned) statusBadge = `<span class="badge-small" style="background:var(--danger); display:block; margin-top:5px;">مسترجعة</span>`;
        else if (p.is_edited) statusBadge = `<span class="badge-small" style="background:var(--warning); color:#000; display:block; margin-top:5px;">معدلة</span>`;

        // إخفاء زر التعديل إذا كانت مسترجعة بالكامل
        let editBtnHTML = p.is_returned ? '' : `<button class="btn btn-warning" style="padding:5px 10px; font-size:12px; margin-right:5px;" onclick="openEditPurchaseModal(${p.id})">✏️ تعديل/استرجاع</button>`;
        let rowStyle = p.is_returned ? 'opacity: 0.7; background: #ffebee;' : '';

        tbody.innerHTML += `
            <tr style="${rowStyle}">
                <td dir="ltr">#${p.id} ${statusBadge}</td>
                <td dir="ltr" style="font-size:12px;">${formatDateTime(p.date)}</td>
                <td><strong>${supName}</strong></td>
                <td>${typeBadge}</td>
                <td style="font-weight:bold; color:var(--primary); text-decoration: ${p.is_returned ? 'line-through' : 'none'};">${displayNum(p.final_total)}</td>
                <td>
                    <button class="btn" style="background:var(--secondary); color:#fff; padding:5px 10px; font-size:12px;" onclick="printPurchaseInvoice(${p.id})">🖨️ عرض</button>
                    ${editBtnHTML}
                </td>
            </tr>`;
    });
}

// ==========================================
// --- دوال الطباعة المتقدمة (للمشتريات وكشف المورد) ---
// ==========================================

function printPurchaseInvoice(id) {
    let p = db.purchases.find(x => x.id === id);
    if(!p) return;

    let supName = p.supplier_id ? (db.suppliers.find(s => s.id === p.supplier_id)?.name || 'غير محدد') : 'نقدي عام';
    let paymentText = p.payment_type === 'cash' ? 'نقدي' : 'آجل (دين)';
    
    let currHTML = `<span style="font-size:0.8em; color:#555;">${db.settings.currency}</span>`;
    let html = `
        <div style="font-family: sans-serif; padding: 10px; max-width: 100%; margin: 0 auto; direction: rtl; text-align: center;">
            <h2 style="margin:0 0 5px 0; font-size:1.4em;">فاتورة مشتريات (موردين)</h2>
            <p style="margin:2px 0;">رقم الفاتورة: #${p.id}</p>
            <p style="margin:2px 0;">التاريخ: <span dir="ltr">${formatDateTime(p.date)}</span></p>
            <p style="margin:2px 0;">المورد: <strong>${supName}</strong></p>
            <p style="margin:2px 0;">طريقة الدفع: <strong>${paymentText}</strong></p>
            
            <table style="width: 100%; border-collapse: collapse; text-align: right; margin-top: 15px; margin-bottom: 15px; font-size: 13px;">
                <tr style="border-bottom: 2px solid #000;">
                    <th style="padding:5px;">الصنف</th>
                    <th style="padding:5px;">الكمية</th>
                    <th style="padding:5px;">السعر</th>
                    <th style="padding:5px;">الإجمالي</th>
                </tr>`;
                
    p.items.forEach(item => {
        let prod = db.products.find(x => x.id === item.id);
        let prodName = prod ? prod.name : 'صنف محذوف';
        html += `<tr style="border-bottom: 1px dotted #ccc;">
            <td style="padding:5px;">${prodName}</td>
            <td style="padding:5px;" dir="ltr">${item.qty}</td>
            <td style="padding:5px;" dir="ltr">${displayNum(item.price)}</td>
            <td style="padding:5px;" dir="ltr">${displayNum(item.qty * item.price)}</td>
        </tr>`;
    });

    html += `</table>
        <div style="border-top: 2px dashed #000; padding-top: 10px; text-align: right;">
            <p style="display:flex; justify-content:space-between; margin:3px 0;"><span>الإجمالي الفرعي:</span> <span>${currHTML} <span dir="ltr">${displayNum(p.total)}</span></span></p>
            ${p.discount > 0 ? `<p style="display:flex; justify-content:space-between; margin:3px 0; color:var(--danger);"><span>الخصم:</span> <span>${currHTML} <span dir="ltr">${displayNum(p.discount)}</span></span></p>` : ''}
            <p style="display:flex; justify-content:space-between; margin:5px 0; font-weight:bold; font-size:1.2em;"><span>الصافي النهائي:</span> <span>${currHTML} <span dir="ltr">${displayNum(p.final_total)}</span></span></p>
        </div>
    </div>`;

    document.getElementById('receipt-content').innerHTML = html;
    document.getElementById('invoiceContainer').classList.add('active');
}

// --- تحديث كشف الحساب ليظهر التفاصيل والأصناف ---
function openSupplierStatement(id) {
    let sup = db.suppliers.find(s => s.id === id);
    document.getElementById('stmt_supName').innerText = sup.name;
    document.getElementById('stmt_supBalance').innerText = displayNum(sup.balance);
    
    document.getElementById('btnPrintSupplierStatement').setAttribute('onclick', `printSupplierStatementTemplate(${id})`);
    
    let tbody = document.getElementById('supplierStatementBody');
    tbody.innerHTML = '';
    
    let movements = [];
    
    // جلب فواتير الآجل مع التفاصيل
    db.purchases.filter(p => p.supplier_id === id && p.payment_type === 'credit').forEach(p => {
        let itemsStr = "أصناف غير محددة";
        if (p.items && p.items.length > 0) {
            itemsStr = p.items.map(i => {
                let prod = db.products.find(x => x.id === i.id);
                return prod ? `${prod.name} (${i.qty} ${i.unitName})` : 'صنف محذوف';
            }).join(' + ');
        }
        movements.push({ 
            date: new Date(p.date), 
            desc: `فاتورة #${p.id} [${itemsStr}]`, // إضافة التفاصيل هنا
            debit: p.final_total, 
            credit: 0 
        });
    });
    
    // جلب التسديدات
    db.transactions.filter(t => t.ref_id === `sup_${id}`).forEach(t => {
        movements.push({ date: new Date(t.date), desc: t.desc, debit: 0, credit: t.amount });
    });
    
    movements.sort((a,b) => a.date - b.date);
    
    movements.forEach(m => {
        tbody.innerHTML += `
            <tr>
                <td dir="ltr" style="font-size:12px;">${formatDateTime(m.date.toISOString())}</td>
                <td style="font-size:12px; line-height:1.4;">${m.desc}</td>
                <td style="color:var(--danger); font-weight:bold;">${m.debit > 0 ? displayNum(m.debit) : '-'}</td>
                <td style="color:var(--success); font-weight:bold;">${m.credit > 0 ? displayNum(m.credit) : '-'}</td>
            </tr>`;
    });
    
    openModal('supplierStatementModal');
}

// --- تحديث الطباعة لتشمل نفس التفاصيل المضافة ---
function printSupplierStatementTemplate(id) {
    let sup = db.suppliers.find(s => s.id === id);
    if(!sup) return;
    
    let movements = [];
    db.purchases.filter(p => p.supplier_id === id && p.payment_type === 'credit').forEach(p => {
        let itemsStr = "أصناف غير محددة";
        if (p.items && p.items.length > 0) {
            itemsStr = p.items.map(i => {
                let prod = db.products.find(x => x.id === i.id);
                return prod ? `${prod.name} (${i.qty})` : 'صنف محذوف';
            }).join(' + ');
        }
        movements.push({ 
            date: new Date(p.date), 
            desc: `فاتورة #${p.id} [${itemsStr}]`, 
            debit: p.final_total, 
            credit: 0 
        });
    });
    
    db.transactions.filter(t => t.ref_id === `sup_${id}`).forEach(t => {
        movements.push({ date: new Date(t.date), desc: t.desc, debit: 0, credit: t.amount });
    });
    
    movements.sort((a,b) => a.date - b.date);
    closeModal('supplierStatementModal');
    
    let html = `
        <div style="font-family: sans-serif; padding: 10px; max-width: 100%; margin: 0 auto; direction: rtl;">
            <div style="text-align:center; border-bottom: 2px dashed #000; padding-bottom: 10px; margin-bottom: 15px;">
                <h2 style="margin:0 0 5px 0;">${db.settings.storeName}</h2>
                <h3 style="margin:10px 0 5px 0; background:#eee; padding:5px; border-radius:5px; border:1px solid #ccc;">📄 كشف حساب مورد تفصيلي</h3>
                <p style="margin:5px 0; font-weight:bold; font-size:1.1em;">المورد: ${sup.name}</p>
                <div style="background:#f9f9f9; padding:5px; border:1px solid #ddd; margin-top:5px;">
                    <span style="color:var(--danger); font-weight:bold;">الرصيد المستحق (للمورد): ${displayNum(sup.balance)}</span>
                </div>
            </div>
            
            <table style="width:100%; border-collapse: collapse; text-align: right; margin-bottom: 15px;">
                <tr style="border-bottom: 2px solid #000;">
                    <th style="padding:4px 0; font-size:0.9em;">التاريخ</th>
                    <th style="padding:4px 0; font-size:0.9em;">البيان</th>
                    <th style="padding:4px 0; font-size:0.9em;">مدين (له)</th>
                    <th style="padding:4px 0; font-size:0.9em;">دائن (تسديد)</th>
                </tr>`;

    movements.forEach(m => {
        let shortDate = m.date.toLocaleDateString('en-GB', { day:'2-digit', month:'2-digit', year:'2-digit' });
        html += `
            <tr style="border-bottom: 1px dotted #ccc;">
                <td style="padding:6px 0; font-size:0.85em;" dir="ltr">${shortDate}</td>
                <td style="padding:6px 0; font-size:0.85em; max-width:150px;">${m.desc}</td>
                <td style="padding:6px 0; font-size:0.9em; font-weight:bold;" dir="ltr">${m.debit > 0 ? displayNum(m.debit) : '-'}</td>
                <td style="padding:6px 0; font-size:0.9em; font-weight:bold;" dir="ltr">${m.credit > 0 ? displayNum(m.credit) : '-'}</td>
            </tr>`;
    });

    html += `</table></div>`;

    document.getElementById('receipt-content').innerHTML = html;
    document.getElementById('invoiceContainer').classList.add('active');
}

// ==========================================
// --- نظام تعديل واسترجاع فواتير المشتريات ---
// ==========================================

let editPurData = null; // متغير لحفظ نسخة مؤقتة من الفاتورة أثناء التعديل

function openEditPurchaseModal(id) {
    let p = db.purchases.find(x => x.id === id);
    if (!p) return;
    if (p.is_returned) return alert("الفاتورة مسترجعة بالفعل ولا يمكن تعديلها.");

    // أخذ نسخة عميقة للفاتورة لتعديلها بحرية دون التأثير على الأصلية حتى نضغط حفظ
    editPurData = JSON.parse(JSON.stringify(p));

    document.getElementById('edit_pur_id_display').innerText = p.id;
    document.getElementById('edit_pur_discount').value = editPurData.discount || 0;

    renderEditPurchaseItems();
    openModal('editPurchaseModal');
}

function renderEditPurchaseItems() {
    let tbody = document.getElementById('editPurchaseItemsBody');
    tbody.innerHTML = '';
    
    editPurData.items.forEach((item, index) => {
        let prod = db.products.find(x => x.id === item.id);
        let pName = prod ? prod.name : 'صنف محذوف';
        
        tbody.innerHTML += `
            <tr>
                <td style="font-weight:bold; color:var(--primary); font-size:12px;">${pName}</td>
                <td><input type="number" class="edit-qty" min="1" value="${item.qty}" style="width:60px; padding:5px; text-align:center;" oninput="calcEditPurchaseRow(this, ${index})"></td>
                <td style="font-size:12px;">${item.unitName}</td>
                <td><input type="number" class="edit-price" step="0.01" value="${item.price}" style="width:70px; padding:5px; text-align:center;" oninput="calcEditPurchaseRow(this, ${index})"></td>
                <td><span class="edit-row-total" style="font-weight:bold; font-size:13px;">${displayNum(item.qty * item.price)}</span></td>
                <td><button class="btn btn-danger" style="padding:4px 8px;" onclick="removeEditPurItem(${index})">🗑</button></td>
            </tr>`;
    });
    calcEditPurchaseTotals();
}

function calcEditPurchaseRow(inputElem, index) {
    let row = inputElem.closest('tr');
    let qty = parseFloat(row.querySelector('.edit-qty').value) || 0;
    let price = parseFloat(row.querySelector('.edit-price').value) || 0;
    
    row.querySelector('.edit-row-total').innerText = displayNum(qty * price);
    
    editPurData.items[index].qty = qty;
    editPurData.items[index].price = price;
    
    calcEditPurchaseTotals();
}

function removeEditPurItem(index) {
    editPurData.items.splice(index, 1);
    renderEditPurchaseItems();
}

function calcEditPurchaseTotals() {
    let subtotal = 0;
    editPurData.items.forEach(i => subtotal += (i.qty * i.price));
    
    let disc = parseFloat(document.getElementById('edit_pur_discount').value) || 0;
    let finalTotal = subtotal - disc;
    if(finalTotal < 0) finalTotal = 0;

    editPurData.total = subtotal;
    editPurData.discount = disc;
    editPurData.final_total = finalTotal;

    document.getElementById('edit_pur_subtotal').innerText = displayNum(subtotal);
    document.getElementById('edit_pur_grandTotal').innerText = displayNum(finalTotal);
}

// 1. حفظ التعديلات (تعديل كميات أو أسعار أو حذف صنف معين)
function savePurchaseModifications() {
    if (editPurData.items.length === 0) {
        return returnAllPurchaseItems(); // إذا حذف كل الأصناف، نعتبرها استرجاع كامل
    }

    let original = db.purchases.find(x => x.id === editPurData.id);
    let diffTotal = editPurData.final_total - original.final_total; // الفارق المالي

    // المعالجة المالية بناءً على طريقة الدفع القديمة
    if (original.payment_type === 'cash') {
        let tr = db.transactions.find(t => t.ref_id === original.id && t.type === 'expense');
        let safeId = tr ? tr.safe_id : 1;
        
        if (diffTotal > 0) { // زادت قيمة الفاتورة، يجب سحب الفارق من الصندوق
            let safeBal = calculateSafeBalance(safeId);
            if (diffTotal > safeBal) return alert("لا يوجد رصيد كافي في الصندوق لتغطية زيادة الفاتورة!");
            addSystemTransaction('expense', diffTotal, `تسوية (زيادة) لتعديل فاتورة مشتريات #${original.id}`, original.id, safeId);
        } else if (diffTotal < 0) { // نقصت قيمة الفاتورة، نعيد الفارق للصندوق
            addSystemTransaction('income', Math.abs(diffTotal), `استرداد فارق تعديل مشتريات #${original.id}`, original.id, safeId);
        }
    } else if (original.payment_type === 'credit') {
        let sup = db.suppliers.find(s => s.id === original.supplier_id);
        if (sup) sup.balance += diffTotal; // نزيد أو ننقص المديونية بالفارق
    }

    // تسوية المخزون: 
    // أ- خصم الكميات القديمة بالكامل
    original.items.forEach(item => {
        let p = db.products.find(x => x.id === item.id);
        if(p) {
            let qtyToRevert = item.isBig ? (item.qty * p.convert_factor) : item.qty;
            p.stock -= qtyToRevert;
        }
    });

    // ب- إضافة الكميات الجديدة بعد التعديل
    editPurData.items.forEach(item => {
        let p = db.products.find(x => x.id === item.id);
        if(p) {
            let qtyToAdd = item.isBig ? (item.qty * p.convert_factor) : item.qty;
            p.stock += qtyToAdd;
            // تحديث سعر التكلفة للسعر الجديد المكتوب
            if (item.isBig) {
                p.buy_price_big = item.price;
                p.buy_price_small = formatNum(item.price / p.convert_factor);
            } else {
                p.buy_price_small = item.price;
                p.buy_price_big = formatNum(item.price * p.convert_factor);
            }
        }
    });

    // تحديث بيانات الفاتورة الأصلية ووسمها بـ "معدلة"
    Object.assign(original, editPurData);
    original.is_edited = true;

    saveData();
    closeModal('editPurchaseModal');
    renderPurchases();
    if (typeof updateUI === 'function') updateUI();
    showSuccessPopup();
}

// 2. الاسترجاع الكامل
function returnAllPurchaseItems() {
    if(!confirm("⚠️ هل أنت متأكد من استرجاع كامل الفاتورة؟\nسيتم خصم الكميات بالكامل من المخزون واسترداد المبالغ.")) return;

    let original = db.purchases.find(x => x.id === editPurData.id);

    // سحب كل الأصناف المشتراة من المخزون
    original.items.forEach(item => {
        let p = db.products.find(x => x.id === item.id);
        if(p) {
            let qtyToRevert = item.isBig ? (item.qty * p.convert_factor) : item.qty;
            p.stock -= qtyToRevert;
            if(p.stock < 0) p.stock = 0; // حماية من الرصيد السالب
        }
    });

    // المعالجة المالية للاسترجاع الشامل
    if (original.payment_type === 'cash') {
        let tr = db.transactions.find(t => t.ref_id === original.id && t.type === 'expense');
        let safeId = tr ? tr.safe_id : 1;
        // إعادة كامل المبلغ للصندوق
        addSystemTransaction('income', original.final_total, `استرجاع فاتورة مشتريات نقدية كاملة #${original.id}`, original.id, safeId);
    } else {
        // إسقاط مديونية المورد
        let sup = db.suppliers.find(s => s.id === original.supplier_id);
        if(sup) sup.balance -= original.final_total;
    }

    // وسم الفاتورة كمسترجعة
    original.is_returned = true;
    original.returned_at = new Date().toISOString();

    saveData();
    closeModal('editPurchaseModal');
    renderPurchases();
    if (typeof updateUI === 'function') updateUI();
    showSuccessPopup();
}