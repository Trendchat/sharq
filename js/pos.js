// --- 5. المبيعات ونقاط البيع السريعة (Fast POS) ---
let cart = []; 
let subTotalBase = 0; 
let cartTaxAmount = 0; 
let grandTotal = 0; 
let totalProfit = 0;

function renderFastProducts() {
    let term = document.getElementById('fastSearch').value.trim().toLowerCase();
    let grid = document.getElementById('fastProductGrid');
    if (!grid) return;
    grid.innerHTML = '';
    
    let availableProducts = db.products.filter(p => {
        if(p.stock <= 0) return false;
        let matchName = p.name.toLowerCase().includes(term);
        let matchBarcode = p.barcode && p.barcode.toLowerCase().includes(term);
        return matchName || matchBarcode;
    });
    
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

document.addEventListener("DOMContentLoaded", () => {
    let fastSearchInput = document.getElementById('fastSearch');
    if (fastSearchInput) {
        fastSearchInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') {
                let term = this.value.trim().toLowerCase();
                if(!term) return;

                let exactMatch = db.products.find(p => p.stock > 0 && p.barcode && p.barcode.toLowerCase() === term);
                
                if (exactMatch) {
                    addToFastCart(exactMatch.id);
                    this.value = ''; 
                    renderFastProducts(); 
                    return; 
                }

                let availableProducts = db.products.filter(p => 
                    p.stock > 0 && 
                    (p.name.toLowerCase().includes(term) || (p.barcode && p.barcode.toLowerCase().includes(term)))
                );
                
                if (availableProducts.length === 1) {
                    addToFastCart(availableProducts[0].id);
                    this.value = ''; 
                    renderFastProducts(); 
                }
            }
        });
    }
});

function addToFastCart(productId) {
    let prod = db.products.find(p => p.id === productId);
    if (!prod || prod.stock <= 0) return alert("المخزون نفد!");

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
            isSmallUnit: true, 
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

function updateCartItemQty(cartId, change) {
    let item = cart.find(i => i.cartId === cartId);
    if (!item) return;
    let prod = db.products.find(p => p.id === item.id);
    
    let newQty = item.qty + change;
    if (newQty <= 0) {
        removeFromCart(cartId);
        return;
    }
    
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
    
    let totalNeeded = 0;
    cart.forEach(c => { if(c.id === prod.id) totalNeeded += (c.qty * c.multiplier); });
    if (prod.stock < totalNeeded) {
        alert("المخزون لا يكفي لتحويله للوحدة الكبرى!");
        toggleCartItemUnit(cartId); 
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
    let optInput = document.getElementById('optionalCashName');
    if(optInput) optInput.value = '';
    updateCartUI(); 
}

function updateCartUI() {
    let container = document.getElementById('fastCartItems');
    container.innerHTML = ''; 
    subTotalBase = 0; 
    totalProfit = 0;
    
    if (cart.length === 0) {
        container.innerHTML = '<p style="text-align:center; padding: 20px; color:#7f8c8d; font-size: 14px;">السلة فارغة، اضغط على الأصناف لإضافتها</p>';
        document.querySelector('.cart-summary').innerHTML = 'الإجمالي: <span id="fastGrandTotal">0</span>';
        grandTotal = 0;
        return;
    }

    cart.forEach(item => {
        subTotalBase += item.total; 
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
    
    let taxRate = parseFloat(db.settings.taxRate) || 0;
    cartTaxAmount = formatNum(subTotalBase * (taxRate / 100));
    grandTotal = formatNum(subTotalBase + cartTaxAmount);

    // --- استبدل الجزء الخاص بـ summaryDiv بهذا الكود ---
    let summaryDiv = document.querySelector('.cart-summary');
    if(taxRate > 0) {
        summaryDiv.innerHTML = `
            <div style="display:flex; flex-direction:column; justify-content: center;">
                <span class="tax-info">بدون ضريبة: ${displayNum(subTotalBase)} | الضريبة: ${displayNum(cartTaxAmount)}</span>
                <span>الإجمالي: <span id="fastGrandTotal" style="color:var(--primary); font-weight:900; font-size: 20px;">${displayNum(grandTotal)}</span></span>
            </div>
        `;
    } else {
        summaryDiv.innerHTML = `<span>الإجمالي:</span> <span id="fastGrandTotal" style="color:var(--primary); font-weight:900; font-size: 22px;">${displayNum(grandTotal)}</span>`;
    }

    // تحديث عداد العناصر في الترويسة العلوية للسلة
    let countBadge = document.getElementById('cartItemCount');
    if(countBadge) {
        let totalItemsCount = cart.reduce((sum, item) => sum + item.qty, 0);
        countBadge.innerText = totalItemsCount;
    }
}

// الكاش السريع مع دعم الرصيد المودع
function fastCashCheckout() {
    if(cart.length === 0) return alert("السلة فارغة!");
    
    if(typeof getActiveShift === 'function') {
        let active = getActiveShift();
        if(!active) {
            alert("⚠️ لا يمكن إتمام البيع: لا توجد وردية مفتوحة حالياً للكاشير. يرجى التوجه للصندوق وفتح وردية.");
            return;
        }
    }

    let cashName = document.getElementById('optionalCashName').value.trim();
    let cartTotal = parseFloat(document.getElementById('fastGrandTotal').innerText.replace(/,/g, ''));
    
    let paidCash = cartTotal;
    let paidFromBalance = 0;
    let customerId = null;

    // الخصم التلقائي من الرصيد في حال كان للعميل رصيد مسبق
    if (cashName !== "") {
        let customer = db.customers.find(c => c.name === cashName);
        if (customer) {
            customerId = customer.id;
            if (customer.balance > 0) {
                if (customer.balance >= cartTotal) {
                    // الرصيد يغطي كامل الفاتورة
                    paidFromBalance = cartTotal;
                    paidCash = 0;
                    customer.balance -= cartTotal;
                } else {
                    // الرصيد يغطي جزء فقط (دفع مختلط)
                    let useBalance = confirm(`العميل ${customer.name} لديه رصيد مسبق الدفع بقيمة ${displayNum(customer.balance)}.\nهل تريد خصم الرصيد المتاح ودفع الباقي نقداً؟`);
                    if (useBalance) {
                        paidFromBalance = customer.balance;
                        paidCash = cartTotal - customer.balance;
                        customer.balance = 0;
                    }
                }
            }
        }
    }

    executeSaleCore('cash', customerId, 0, cashName, paidCash, paidFromBalance);
}

function startCheckoutCredit() {
    if(cart.length === 0) return alert("السلة فارغة!");
    document.getElementById('creditAmount').value = grandTotal; 
    document.getElementById('customerSearchInput').value = '';
    document.getElementById('selectedCreditCustomerId').value = '';
    document.getElementById('creditAmountGroup').style.display = 'none';
    
    if(typeof renderCustomerList === 'function') renderCustomerList(); 
    openModal('selectCustomerModal');
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

function executeSale(type) {
    let customerId = null; 
    let finalDebtAmount = 0; 
    let cashName = "";

    if(type === 'credit') {
        customerId = document.getElementById('selectedCreditCustomerId').value;
        if(!customerId) return alert("يرجى اختيار العميل أولاً من القائمة");
        
        customerId = parseInt(customerId);
        let creditInput = document.getElementById('creditAmount');
        finalDebtAmount = creditInput ? (parseFloat(creditInput.value) || grandTotal) : grandTotal;
        
        if(finalDebtAmount < 0) return alert("قيمة السلف غير صحيحة");
        
        let c = db.customers.find(c => c.id === customerId);
        if(c) c.total_debt += finalDebtAmount;
        
    } else { 
        let cashInput = document.getElementById('optionalCashName');
        cashName = cashInput ? cashInput.value.trim() : ""; 
    }

    // بالنسبة للآجل، النقد والرصيد المخصوم 0 مبدئياً لتسهيل الحسابات
    executeSaleCore(type, customerId, finalDebtAmount, cashName, 0, 0);
    closeModal('selectCustomerModal');
    closeModal('checkoutModal');
}

// الدالة المركزية لتسجيل البيع (مع دعم المبالغ المخصومة من الرصيد)
// الدالة المركزية لتسجيل البيع
function executeSaleCore(type, customerId, debtAmount, cashName, paidCash = null, paidFromBalance = 0) {
    let itemsSummary = []; 
    let soldItems = []; 
    
    if (paidCash === null) {
        paidCash = (type === 'cash') ? grandTotal : 0;
    }

    cart.forEach(item => {
        let prod = db.products.find(p => p.id === item.id);
        prod.stock -= (item.qty * item.multiplier);
        itemsSummary.push(`${item.name} (${item.qty} ${item.unitName})`);
        soldItems.push({...item}); 
    });

    let newSale = {
        id: Date.now(), invoice_type: type, customer_id: customerId, cash_name: cashName,
        sub_total: subTotalBase, tax_rate: db.settings.taxRate, tax_amount: cartTaxAmount, 
        total: grandTotal, debt_amount: debtAmount, profit: totalProfit,
        paid_cash: paidCash, paid_from_balance: paidFromBalance, 
        product_name: itemsSummary.join(' + '), items: soldItems, date: new Date().toISOString()
    };

    db.sales.push(newSale); 

    // تسجيل الأموال النقدية التي دخلت الدرج فعلياً
    if(paidCash > 0) {
        if(typeof addSystemTransaction === 'function') {
            addSystemTransaction('income', paidCash, `مبيعات نقدية - فاتورة #${newSale.id}`, newSale.id);
       
        }
    }

    // الحركة المحاسبية الذكية للمسحوبات من الرصيد (لكي تظهر بدفتر الأستاذ دون تخريب جرد الصندوق)
    if(paidFromBalance > 0) {
        if(typeof addSystemTransaction === 'function') {
            let custNameStr = cashName || "عميل";
            addSystemTransaction('income', paidFromBalance, `مبيعات (مسددة من الرصيد المسبق) - فاتورة #${newSale.id}`, newSale.id);
            addSystemTransaction('expense', paidFromBalance, `تسوية: خصم من رصيد العميل (${custNameStr}) مقابل فاتورة #${newSale.id}`, newSale.id);
        }
    }
    
    saveData(); 
    clearCart(); 
    renderFastProducts(); 
    
    let autoPrint = document.getElementById('autoPrint').checked;
    if(autoPrint) {
        printReceipt(newSale);
        setTimeout(() => { triggerPrint(); }, 400); 
    } else {
        showSuccessPopup();
    }
}

function triggerPrint() {
    if (window.AndroidBridge) { window.AndroidBridge.printPage(); } else { window.print(); }
}

function printReceipt(saleObj) {
    let customerNamePrint = saleObj.invoice_type === 'cash' ? (saleObj.cash_name || "نقد") : "عميل مسجل";
    if(saleObj.customer_id) {
        let c = db.customers.find(x => x.id === saleObj.customer_id);
        if(c) customerNamePrint = c.name;
    }

    // تحديد طريقة الدفع للطباعة
    let paymentMethodText = saleObj.invoice_type === 'cash' ? 'نقدي' : 'سلف (آجل)';
    if (saleObj.paid_from_balance > 0) {
        paymentMethodText = saleObj.paid_cash > 0 ? 'مختلط (رصيد مسبق + نقدي)' : 'خصم من الرصيد المسبق';
    }

    let currHTML = `<span style="font-size:0.8em; margin-left:3px; color:#555;">${db.settings.currency}</span>`;

    let logoHtml = db.settings.storeLogo ? `<img src="${db.settings.storeLogo}" style="max-width: 100px; max-height: 100px; margin: 0 auto 10px auto; display: block; border-radius: 8px;">` : '';
    let addressHtml = db.settings.storeAddress ? `<p style="margin: 3px 0; font-size:0.9em;">📍 ${db.settings.storeAddress}</p>` : '';
    let contactHtml = db.settings.storeContact ? `<p style="margin: 3px 0; font-size:0.9em;">📞 ${db.settings.storeContact}</p>` : '';
    
    let fSize = db.settings.receiptFontSize || 14;
    let margin = db.settings.receiptMargin !== undefined ? db.settings.receiptMargin : 10;
    
    let printWidthClass = db.settings.invoiceFormat === 'a4' ? '100%' : (db.settings.printerSize === '58mm' ? '58mm' : '80mm');
    
    let containerStyle = `font-size: ${fSize}px; padding: ${margin}px; max-width: ${printWidthClass}; margin: 0 auto; background: white; color: black;`;

    let html = `
        <div style="${containerStyle}">
            <div style="text-align:center; margin-bottom: 15px; border-bottom: 2px dashed #000; padding-bottom: 10px;">
                ${logoHtml}
                <h2 style="margin:0 0 5px 0; font-size:1.3em;">${db.settings.storeName}</h2>
                ${addressHtml}
                ${contactHtml}
                <p style="margin:5px 0 2px 0;">رقم الفاتورة: ${saleObj.id}</p>
                <p style="margin:2px 0;">التاريخ: <span dir="ltr">${formatDateTime(saleObj.date)}</span></p>
                <p style="margin:2px 0;">العميل: ${customerNamePrint}</p>
                <p style="margin:2px 0; font-weight:bold;">طريقة الدفع: ${paymentMethodText}</p>
            </div>
            <table style="width: 100%; border-collapse: collapse; text-align: right; margin-bottom: 10px;">
                <tr style="border-bottom: 1px solid #000;">
                    <th style="padding:4px 0;">الصنف</th>
                    <th style="padding:4px 0;">الكمية</th>
                    <th style="padding:4px 0;">السعر</th>
                    <th style="padding:4px 0;">المجموع</th>
                </tr>`;
    
    if(saleObj.items && saleObj.items.length > 0) {
        saleObj.items.forEach(item => {
            html += `<tr style="border-bottom: 1px dotted #ccc;">
                <td style="padding:4px 0;">${item.name}</td>
                <td style="padding:4px 0;" dir="ltr">${item.qty} ${item.unitName}</td>
                <td style="padding:4px 0;" dir="ltr">${displayNum(item.price)}</td>
                <td style="padding:4px 0;" dir="ltr">${displayNum(item.total)}</td>
            </tr>`;
        });
    } else {
        html += `<tr><td colspan="4" style="padding:4px 0;">${saleObj.product_name}</td></tr>`;
    }

    html += `</table><div style="border-top: 2px dashed #000; padding-top: 10px;">`;

    let printSubTotal = saleObj.sub_total || saleObj.total; 
    let printTaxAmt = saleObj.tax_amount || 0;
    
    if(printTaxAmt > 0) {
        html += `<p style="display:flex; justify-content:space-between; margin:3px 0;"><span>بدون ضريبة:</span> <span>${currHTML} <span dir="ltr">${displayNum(printSubTotal)}</span></span></p>`;
        html += `<p style="display:flex; justify-content:space-between; margin:3px 0;"><span>ضريبة (${saleObj.tax_rate}%):</span> <span>${currHTML} <span dir="ltr">${displayNum(printTaxAmt)}</span></span></p>`;
    }

    html += `<p style="display:flex; justify-content:space-between; margin:5px 0; font-weight:bold; font-size:1.2em;"><span>الإجمالي:</span> <span>${currHTML} <span dir="ltr">${displayNum(saleObj.total)}</span></span></p>`;
    
    // تفصيل طرق الدفع في الفاتورة
    if (saleObj.paid_from_balance > 0) {
        html += `<p style="display:flex; justify-content:space-between; margin:3px 0; font-size:0.9em;"><span>مخصوم من الرصيد:</span> <span>${currHTML} <span dir="ltr">${displayNum(saleObj.paid_from_balance)}</span></span></p>`;
    }
    if (saleObj.paid_cash > 0 && saleObj.paid_from_balance > 0) {
         html += `<p style="display:flex; justify-content:space-between; margin:3px 0; font-size:0.9em;"><span>مدفوع نقداً:</span> <span>${currHTML} <span dir="ltr">${displayNum(saleObj.paid_cash)}</span></span></p>`;
    }

    if(saleObj.invoice_type === 'credit') {
        html += `<p style="display:flex; justify-content:space-between; margin:5px 0; color:red;"><span>سلف مسجل:</span> <span>${currHTML} <span dir="ltr">${displayNum(saleObj.debt_amount)}</span></span></p>`;
    }
    
    html += `</div>
        <div style="text-align:center; margin-top: 15px; font-size: 0.9em;">
            <p style="font-weight: bold; margin-bottom: 5px;">شكراً لتسوقكم معنا</p>
            <p style="margin: 2px 0;">نظام الشرق للمحاسبة</p>
        </div>
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
        html2canvas(receiptElement, { 
            scale: 2, 
            backgroundColor: "#ffffff",
            allowTaint: true,       // السماح بقراءة العناصر المحلية
            useCORS: true,          // تفعيل تجاوز سياسة الـ CORS
            ignoreElements: function(node) {
                // إخبار المكتبة بتجاهل المخططات البيانية التي تسبب المشكلة
                return node.id === 'weeklySalesChart' || node.id === 'todayTreasuryChart';
            }
        }).then(canvas => {
            let base64Image = canvas.toDataURL("image/png");
            if (window.AndroidBridge) { 
                window.AndroidBridge.shareImage(base64Image); 
            } else {
                canvas.toBlob(blob => {
                    let file = new File([blob], "invoice.png", { type: "image/png" });
                    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                        navigator.share({ files: [file], title: "فاتورة مبيعات", text: "تفضل فاتورة مشترياتك" })
                        .catch(err => console.error("خطأ:", err));
                    } else {
                        let url = window.URL.createObjectURL(blob); 
                        let a = document.createElement("a");
                        a.style.display = "none"; 
                        a.href = url; 
                        a.download = `فاتورة_${Date.now()}.png`;
                        document.body.appendChild(a); 
                        a.click(); 
                        window.URL.revokeObjectURL(url);
                    }
                }, 'image/png');
            }
        }).catch(err => {
            console.error("حدث خطأ أثناء التقاط الصورة:", err);
            alert("حدث خطأ أثناء معالجة الصورة، يرجى المحاولة مرة أخرى.");
        });
    } else { 
        alert("عذراً، لم يتم تحميل مكتبة تحويل الصور."); 
    }
}


// ==========================================
// --- نظام الدفع السريع من رصيد العميل ---
// ==========================================

function openPayFromBalanceModal() {
    let cartTotal = parseFloat(document.getElementById('fastGrandTotal').innerText.replace(/,/g, ''));
    if (cartTotal <= 0) return alert("السلة فارغة!");

    // التحقق من وجود وردية
    if(typeof getActiveShift === 'function') {
        let active = getActiveShift();
        if(!active) return alert("⚠️ لا يمكن إتمام البيع: لا توجد وردية مفتوحة حالياً للكاشير.");
    }

    // تهيئة النافذة
    document.getElementById('balanceModalTotal').innerText = displayNum(cartTotal);
    document.getElementById('balanceCustomerSearch').value = '';
    document.getElementById('balanceCustomerResults').innerHTML = '';
    document.getElementById('balancePaymentAction').style.display = 'none';

    openModal('payFromBalanceModal');
    setTimeout(() => document.getElementById('balanceCustomerSearch').focus(), 100);
}

function searchBalanceCustomers() {
    let term = document.getElementById('balanceCustomerSearch').value.trim().toLowerCase();
    let resultsContainer = document.getElementById('balanceCustomerResults');
    let cartTotal = parseFloat(document.getElementById('fastGrandTotal').innerText.replace(/,/g, ''));

    // إخفاء زر التأكيد عند بدء كتابة اسم جديد
    document.getElementById('balancePaymentAction').style.display = 'none'; 

    if (term === '') {
        resultsContainer.innerHTML = '';
        return;
    }

    // فلترة العملاء: يطابق الاسم + يمتلك رصيد يغطي قيمة الفاتورة فأكثر
    let matches = db.customers.filter(c => 
        c.name.toLowerCase().includes(term) && 
        (c.balance !== undefined && c.balance >= cartTotal)
    );

    resultsContainer.innerHTML = '';

    if (matches.length === 0) {
        resultsContainer.innerHTML = '<p style="text-align:center; grid-column: 1/-1; padding: 10px; color: #7f8c8d; font-size: 13px;">لا يوجد عميل بهذا الاسم يمتلك رصيداً كافياً لهذه الفاتورة.</p>';
        return;
    }

    // عرض النتائج
    matches.forEach(c => {
        resultsContainer.innerHTML += `
            <div class="unit-btn" onclick="selectBalanceCustomer(${c.id}, '${c.name}', ${c.balance})">
                <strong>${c.name}</strong>
                <div style="font-size:11px; color:var(--success); margin-top:3px; font-weight:bold;">رصيد: ${displayNum(c.balance)}</div>
            </div>
        `;
    });
}

function selectBalanceCustomer(id, name, balance) {
    document.getElementById('balanceSelectedCustomerId').value = id;
    document.getElementById('balanceSelectedCustomerName').innerText = name;
    document.getElementById('balanceSelectedCustomerAvailable').innerText = displayNum(balance);

    // إظهار قسم تأكيد الدفع
    document.getElementById('balancePaymentAction').style.display = 'block';

    // تمييز العميل المختار لونياً
    let btns = document.getElementById('balanceCustomerResults').querySelectorAll('.unit-btn');
    btns.forEach(b => {
        if(b.innerText.includes(name)) b.classList.add('selected');
        else b.classList.remove('selected');
    });
}

function executeBalancePayment() {
    let customerId = parseInt(document.getElementById('balanceSelectedCustomerId').value);
    let cartTotal = parseFloat(document.getElementById('fastGrandTotal').innerText.replace(/,/g, ''));

    let customer = db.customers.find(c => c.id === customerId);
    if (!customer) return alert("حدث خطأ، العميل غير موجود.");

    // تحقق أمان أخير للتأكد من الرصيد
    if (customer.balance < cartTotal) {
        return alert("عفواً، رصيد العميل لم يعد كافياً لهذه العملية!");
    }

    // 1. خصم المبلغ من رصيد العميل
    customer.balance -= cartTotal;

    // 2. إتمام عملية البيع باستخدام الدالة المركزية 
    // ملاحظة: invoice_type = 'cash' (لأنها تعتبر مدفوعة)، paidCash = 0، paidFromBalance = cartTotal
    executeSaleCore('cash', customerId, 0, customer.name, 0, cartTotal);

    // 3. إغلاق النافذة
    closeModal('payFromBalanceModal');
}



function initializeInvoiceCounter(db) {
    db.invoiceCounter = db.invoiceCounter || 0; // If it does not exist, initialize to 0
}

function executeSaleCore(type, ...otherParams) {
    let db = getDatabaseInstance(); // Assuming there's a function to get the database instance
    initializeInvoiceCounter(db);

    let newSale = {
        id: ++db.invoiceCounter, // Use the incrementing invoiceCounter
        invoice_type: type,
        // ... other sale data
    };
    // Save newSale to database or proceed with sale execution
}

function searchInvoicesByNumber(invoiceNumber) {
    let db = getDatabaseInstance();
    return db.invoices.filter(invoice => invoice.id === invoiceNumber);
}

function searchInvoicesByCustomerName(customerName) {
    let db = getDatabaseInstance();
    return db.invoices.filter(invoice => invoice.customerName.toLowerCase() === customerName.toLowerCase());
}

// Assume code for rendering invoices in the reports screen will utilize these search functions.
