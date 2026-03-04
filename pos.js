// --- 5. المبيعات ونقاط البيع السريعة (Fast POS) ---
let cart = []; 
let grandTotal = 0; 
let totalProfit = 0;

// 1. عرض الأصناف كبطاقات تفاعلية
function renderFastProducts() {
    let term = document.getElementById('fastSearch').value.toLowerCase();
    let grid = document.getElementById('fastProductGrid');
    if (!grid) return;
    grid.innerHTML = '';
    
    let availableProducts = db.products.filter(p => p.stock > 0 && p.name.toLowerCase().includes(term));
    
    if(availableProducts.length === 0) { 
        grid.innerHTML = '<p style="text-align:center; grid-column: 1/-1; color:#7f8c8d; padding: 20px;">لا يوجد صنف أو المخزون فارغ.</p>'; 
        return;
    }
    
    availableProducts.forEach(p => {
        let packs = Math.floor(p.stock / p.convert_factor); 
        let bases = p.stock % p.convert_factor;
        let stockText = `${packs} ${p.unit_big} و ${bases} ${p.unit_small}`;
        
        grid.innerHTML += `
            <div class="pos-product-card" onclick="addToFastCart(${p.id})">
                <div class="pos-product-name">${p.name}</div>
                <div class="pos-product-price">${displayNum(p.sell_price_small)}</div>
                <div class="pos-product-stock">متبقي:<br>${stockText}</div>
            </div>
        `;
    });
}

// إضافة ميزة الإضافة السريعة بالباركود (إذا كان البحث يطابق صنفاً واحداً فقط وضغطت Enter)
document.addEventListener("DOMContentLoaded", () => {
    let fastSearchInput = document.getElementById('fastSearch');
    if (fastSearchInput) {
        fastSearchInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                let term = this.value.toLowerCase();
                let availableProducts = db.products.filter(p => p.stock > 0 && p.name.toLowerCase().includes(term));
                if (availableProducts.length === 1) {
                    addToFastCart(availableProducts[0].id);
                    this.value = ''; // تفريغ الحقل بعد قراءة الباركود
                    renderFastProducts(); // تحديث القائمة
                }
            }
        });
    }
});

// 2. إضافة الصنف للسلة بضغطة واحدة (الافتراضي: الوحدة الصغرى)
function addToFastCart(productId) {
    let prod = db.products.find(p => p.id === productId);
    if (!prod || prod.stock <= 0) return alert("المخزون نفد!");

    // تحقق إذا كان موجود بالسلة مسبقاً بنفس الوحدة الصغرى
    let existingItem = cart.find(item => item.id === productId && item.isSmallUnit === true);
    
    if (existingItem) {
        if (prod.stock >= ((existingItem.qty + 1) * existingItem.multiplier)) {
            existingItem.qty += 1;
            recalcCartItem(existingItem);
        } else {
            alert("الكمية المطلوبة تتجاوز المخزون!");
        }
    } else {
        let newItem = {
            cartId: Date.now() + Math.random(),
            id: prod.id,
            name: prod.name,
            isSmallUnit: true, // افتراضياً الوحدة الصغرى
            qty: 1,
            multiplier: 1,
            unitName: prod.unit_small,
            price: prod.sell_price_small,
            buyPrice: prod.buy_price_small,
            total: prod.sell_price_small,
            profit: prod.sell_price_small - prod.buy_price_small
        };
        cart.push(newItem);
    }
    updateCartUI();
}

// 3. التعديل المباشر داخل السلة
function updateCartItemQty(cartId, change) {
    let item = cart.find(i => i.cartId === cartId);
    if (!item) return;
    let prod = db.products.find(p => p.id === item.id);
    
    let newQty = item.qty + change;
    if (newQty <= 0) {
        removeFromCart(cartId);
        return;
    }
    
    // التحقق من المخزون الإجمالي في السلة لهذا الصنف
    let totalNeeded = 0;
    cart.forEach(c => { if(c.id === prod.id) totalNeeded += (c.cartId === cartId ? newQty * c.multiplier : c.qty * c.multiplier); });
    
    if (prod.stock < totalNeeded) return alert("المخزون المتوفر لا يكفي!");
    
    item.qty = newQty;
    recalcCartItem(item);
    updateCartUI();
}

function toggleCartItemUnit(cartId) {
    let item = cart.find(i => i.cartId === cartId);
    let prod = db.products.find(p => p.id === item.id);
    
    if (prod.convert_factor <= 1) return alert("هذا الصنف ليس له وحدة كبرى");

    item.isSmallUnit = !item.isSmallUnit;
    
    if (item.isSmallUnit) {
        item.multiplier = 1;
        item.unitName = prod.unit_small;
        item.price = prod.sell_price_small;
        item.buyPrice = prod.buy_price_small;
    } else {
        item.multiplier = prod.convert_factor;
        item.unitName = prod.unit_big;
        item.price = prod.sell_price_big;
        item.buyPrice = prod.buy_price_big;
    }
    
    // تأكد أن المخزون يكفي للتحويل
    let totalNeeded = 0;
    cart.forEach(c => { if(c.id === prod.id) totalNeeded += (c.qty * c.multiplier); });
    if (prod.stock < totalNeeded) {
        alert("المخزون لا يكفي لتحويله للوحدة الكبرى!");
        toggleCartItemUnit(cartId); // تراجع
        return;
    }

    recalcCartItem(item);
    updateCartUI();
}

function recalcCartItem(item) {
    item.total = item.price * item.qty;
    item.profit = (item.price - item.buyPrice) * item.qty;
}

function removeFromCart(cartId) { 
    cart = cart.filter(item => item.cartId !== cartId); 
    updateCartUI(); 
}

function clearCart() { 
    cart = []; 
    document.getElementById('optionalCashName').value = '';
    updateCartUI(); 
}

// 4. رسم وتحديث السلة
function updateCartUI() {
    let container = document.getElementById('fastCartItems');
    container.innerHTML = ''; 
    grandTotal = 0; 
    totalProfit = 0;
    
    if (cart.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding: 20px; color:#7f8c8d; font-size: 14px;">السلة فارغة، اضغط على الأصناف لإضافتها</p>';
        document.getElementById('fastGrandTotal').innerText = "0";
        return;
    }

    cart.forEach(item => {
        grandTotal += item.total; 
        totalProfit += item.profit;
        
        let prod = db.products.find(p => p.id === item.id);
        let unitBtnHTML = prod.convert_factor > 1 ? 
            `<button class="unit-toggle-btn ${!item.isSmallUnit ? 'is-big' : ''}" onclick="toggleCartItemUnit(${item.cartId})">🔄 تبديل لـ ${item.isSmallUnit ? prod.unit_big : prod.unit_small}</button>` : '';

        container.innerHTML += `
            <div class="cart-item-row">
                <div class="cart-item-top">
                    <span style="color: var(--primary);">${item.name} (${item.unitName})</span>
                    <button class="remove-item-btn" onclick="removeFromCart(${item.cartId})">✖</button>
                </div>
                <div class="cart-item-controls">
                    <div class="qty-controls">
                        <button class="qty-btn" onclick="updateCartItemQty(${item.cartId}, 1)">+</button>
                        <div class="qty-display">${item.qty}</div>
                        <button class="qty-btn" onclick="updateCartItemQty(${item.cartId}, -1)">-</button>
                    </div>
                    ${unitBtnHTML}
                    <div class="cart-item-total">${displayNum(item.total)}</div>
                </div>
            </div>`;
    });
    
    document.getElementById('fastGrandTotal').innerText = displayNum(grandTotal);
}

// 5. إتمام الدفع (كاش سريع)
function fastCashCheckout() {
    if(cart.length === 0) return alert("السلة فارغة!");
    
    let cashName = document.getElementById('optionalCashName').value.trim();
    executeSaleCore('cash', null, 0, cashName);
}

// 6. إتمام الدفع (آجل / سلف)
function startCheckoutCredit() {
    if(cart.length === 0) return alert("السلة فارغة!");
    document.getElementById('creditAmount').value = grandTotal; 
    document.getElementById('customerSearchInput').value = '';
    document.getElementById('selectedCreditCustomerId').value = '';
    document.getElementById('creditAmountGroup').style.display = 'none';
    renderCustomerList(); // تم استدعاء الدالة هنا
    openModal('selectCustomerModal');
}

// الدالة التي كانت مفقودة (تمت إضافتها)
function renderCustomerList() {
    let term = document.getElementById('customerSearchInput').value.toLowerCase();
    let list = document.getElementById('customerSelectionGrid'); 
    list.innerHTML = '';
    let filtered = db.customers.filter(c => c.name.toLowerCase().includes(term));
    
    if(filtered.length === 0) { 
        list.innerHTML = '<p style="text-align:center; grid-column: 1/-1; padding:10px;">لا يوجد عميل بهذا الاسم</p>'; 
    } else { 
        filtered.forEach(c => { 
            list.innerHTML += `<div class="unit-btn" onclick="selectCreditCustomer(${c.id}, '${c.name}')">${c.name}</div>`; 
        }); 
    }
}

function selectCreditCustomer(id, name) {
    document.getElementById('selectedCreditCustomerId').value = id;
    document.getElementById('selectedCustomerNameText').innerText = name;
    document.getElementById('creditAmountGroup').style.display = 'block';
    
    let btns = document.getElementById('customerSelectionGrid').querySelectorAll('.unit-btn');
    btns.forEach(b => { 
        if(b.innerText === name) { b.classList.add('selected'); } 
        else { b.classList.remove('selected'); } 
    });
}

function executeCreditSale() {
    let customerId = document.getElementById('selectedCreditCustomerId').value;
    if(!customerId) return alert("يرجى اختيار العميل أولاً من القائمة");
    customerId = parseInt(customerId);
    
    let c = db.customers.find(c => c.id === customerId);
    c.total_debt += grandTotal;
    
    executeSaleCore('credit', customerId, grandTotal, "");
    closeModal('selectCustomerModal');
}

// قلب عملية خصم المخزون وحفظ الفاتورة
function executeSaleCore(type, customerId, debtAmount, cashName) {
    let itemsSummary = []; 
    let soldItems = []; 
    
    cart.forEach(item => {
        let prod = db.products.find(p => p.id === item.id);
        prod.stock -= (item.qty * item.multiplier);
        itemsSummary.push(`${item.name} (${item.qty} ${item.unitName})`);
        soldItems.push({...item}); 
    });

    let newSale = {
        id: Date.now(), invoice_type: type, customer_id: customerId, cash_name: cashName,
        total: grandTotal, debt_amount: debtAmount, profit: totalProfit,
        product_name: itemsSummary.join(' + '), items: soldItems, date: new Date().toISOString()
    };

    db.sales.push(newSale); 
    saveData(); 
    clearCart(); 
    renderFastProducts(); // تحديث أرقام المخزون المعروضة
    
    // فحص خيار الطباعة التلقائية
    let autoPrint = document.getElementById('autoPrint').checked;
    if(autoPrint) {
        printReceipt(newSale);
        setTimeout(() => { triggerPrint(); }, 400); // إظهار مربع حوار الطباعة فوراً
    } else {
        showSuccessPopup();
    }
}

// --- نظام الطباعة ---
function triggerPrint() {
    if (window.AndroidBridge) { window.AndroidBridge.printPage(); } else { window.print(); }
}

function printReceipt(saleObj) {
    let customerNamePrint = saleObj.invoice_type === 'cash' ? (saleObj.cash_name || "نقد") : "عميل مسجل";
    if(saleObj.invoice_type === 'credit' && saleObj.customer_id) {
        let c = db.customers.find(x => x.id === saleObj.customer_id);
        customerNamePrint = c ? c.name : "عميل مسجل";
    }

    let html = `
        <div class="header">
            <h2>نظام الشرق</h2>
            <p>رقم الفاتورة: ${saleObj.id}</p>
            <p>التاريخ: <span dir="ltr">${formatDateTime(saleObj.date)}</span></p>
            <p>العميل: ${customerNamePrint}</p>
            <p>الدفع: ${saleObj.invoice_type === 'cash' ? 'نقدي' : 'سلف (آجل)'}</p>
        </div>
        <table>
            <tr><th>الصنف</th><th>الكمية</th><th>السعر</th><th>المجموع</th></tr>`;
    
    if(saleObj.items && saleObj.items.length > 0) {
        saleObj.items.forEach(item => {
            html += `<tr>
                <td>${item.name}</td>
                <td dir="ltr">${item.qty} ${item.unitName}</td>
                <td dir="ltr">${displayNum(item.price)}</td>
                <td dir="ltr">${displayNum(item.total)}</td>
            </tr>`;
        });
    } else {
        html += `<tr><td colspan="4">${saleObj.product_name}</td></tr>`;
    }

    html += `
        </table>
        <div class="total-area">
            <p style="display:flex; justify-content:space-between; margin:5px 0;"><span>الإجمالي:</span> <span dir="ltr">${displayNum(saleObj.total)} ريال</span></p>
            ${saleObj.invoice_type === 'credit' ? `<p style="display:flex; justify-content:space-between; font-size:15px; color:var(--danger); margin:5px 0;"><span>سلف مسجل:</span> <span dir="ltr">${displayNum(saleObj.debt_amount)} ريال</span></p>` : ''}
        </div>
        <div class="footer">
            <p style="font-size: 15px; font-weight: bold;">شكراً لتسوقكم معنا</p>
            <p style="font-size: 11px;">نظام الشرق - نقطة البيع</p>
        </div>`;
    
    document.getElementById('receipt-content').innerHTML = html;
    document.getElementById('invoiceContainer').classList.add('active');
}

function closeInvoice() { document.getElementById('invoiceContainer').classList.remove('active'); }

function reprintInvoice(saleId) {
    let sale = db.sales.find(s => s.id === saleId);
    if(sale) printReceipt(sale);
}

function shareInvoiceImage() {
    let receiptElement = document.getElementById('receipt-content');
    if (typeof html2canvas !== 'undefined') {
        html2canvas(receiptElement, { scale: 2, backgroundColor: "#ffffff" }).then(canvas => {
            let base64Image = canvas.toDataURL("image/png");
            if (window.AndroidBridge) { window.AndroidBridge.shareImage(base64Image); } 
            else {
                canvas.toBlob(blob => {
                    let file = new File([blob], "invoice.png", { type: "image/png" });
                    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                        navigator.share({ files: [file], title: "فاتورة مبيعات", text: "تفضل فاتورة مشترياتك" }).catch(err => console.error("خطأ:", err));
                    } else {
                        let url = window.URL.createObjectURL(blob); let a = document.createElement("a");
                        a.style.display = "none"; a.href = url; a.download = `فاتورة_${Date.now()}.png`;
                        document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url);
                    }
                }, 'image/png');
            }
        });
    } else { alert("عذراً، لم يتم تحميل مكتبة تحويل الصور."); }
}
// --- دالة التوافق لإتمام البيع (تعالج مشكلة الزر القديم executeSale) ---
function executeSale(type) {
    let customerId = null; 
    let finalDebtAmount = 0; 
    let cashName = "";

    // إذا كان البيع آجل (سلف)
    if(type === 'credit') {
        customerId = document.getElementById('selectedCreditCustomerId').value;
        if(!customerId) return alert("يرجى اختيار العميل أولاً من القائمة");
        
        customerId = parseInt(customerId);
        let creditInput = document.getElementById('creditAmount');
        finalDebtAmount = creditInput ? (parseFloat(creditInput.value) || grandTotal) : grandTotal;
        
        if(finalDebtAmount < 0) return alert("قيمة السلف غير صحيحة");
        
        // إضافة المديونية لحساب العميل
        let c = db.customers.find(c => c.id === customerId);
        if(c) c.total_debt += finalDebtAmount;
        
    } else { 
        // إذا كان البيع كاش
        let cashInput = document.getElementById('optionalCashName');
        cashName = cashInput ? cashInput.value.trim() : ""; 
    }

    // استدعاء دالة الحفظ والخصم الأساسية
    executeSaleCore(type, customerId, finalDebtAmount, cashName);
    
    // إغلاق النوافذ
    closeModal('selectCustomerModal');
    closeModal('checkoutModal');
}