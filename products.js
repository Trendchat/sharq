// --- 3. إدارة المنتجات (Product Management) ---
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
    let uSmall = document.getElementById('p_unitSmall').value;
    let uBig = document.getElementById('p_unitBig').value;
    let conv = parseFloat(document.getElementById('p_convert').value) || 1;
    let pBuyBig = formatNum(document.getElementById('p_buy_big').value);
    let pBuySmall = formatNum(document.getElementById('p_buy_small').value);
    let pSellBig = formatNum(document.getElementById('p_sell_big').value);
    let pSellSmall = formatNum(document.getElementById('p_sell_small').value);
    let initialBig = parseFloat(document.getElementById('p_stock').value) || 0;

    if(!name || pBuySmall <= 0 || pSellSmall <= 0) return alert("يرجى إكمال البيانات والأسعار بشكل صحيح");

    db.products.push({
        id: Date.now(), name: name, unit_small: uSmall, unit_big: uBig, convert_factor: conv,
        buy_price_big: pBuyBig, buy_price_small: pBuySmall, sell_price_big: pSellBig, sell_price_small: pSellSmall,
        stock: initialBig * conv, created_at: new Date().toISOString()
    });

    saveData(); closeModal('addProductModal');
    document.querySelectorAll('#addProductModal input').forEach(i => i.value = '');
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
    openModal('restockModal');
}

function processRestock() {
    let id = parseInt(document.getElementById('restock_id').value);
    let qtyBig = parseFloat(document.getElementById('restock_qty').value);
    let newBuyBig = parseFloat(document.getElementById('restock_buy_price').value) || 0;
    let newSellBig = parseFloat(document.getElementById('restock_sell_price').value) || 0;

    let prod = db.products.find(p => p.id === id);
    
    if(qtyBig > 0) {
        prod.stock += (qtyBig * prod.convert_factor);
        
        if(newBuyBig > 0) {
            prod.buy_price_big = newBuyBig;
            prod.buy_price_small = formatNum(newBuyBig / prod.convert_factor);
        }
        if(newSellBig > 0) {
            prod.sell_price_big = newSellBig;
            prod.sell_price_small = formatNum(newSellBig / prod.convert_factor);
        }

        db.shipments.push({ id: Date.now(), product_id: id, quantity_big: qtyBig, date: new Date().toISOString() });
        saveData(); closeModal('restockModal');
    }
}