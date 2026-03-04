// --- 1. تهيئة قاعدة البيانات (Database Initialization) ---
let db = {
    products: JSON.parse(localStorage.getItem('sys_products')) || [],
    customers: JSON.parse(localStorage.getItem('sys_customers')) || [],
    sales: JSON.parse(localStorage.getItem('sys_sales')) || [],
    shipments: JSON.parse(localStorage.getItem('sys_shipments')) || []
};

// إصلاح بيانات المنتجات القديمة لضمان وجود الأسعار
db.products = db.products.map(p => {
    p.buy_price_small = formatNum(p.buy_price_small) || formatNum(p.purchase_price) || 0;
    p.buy_price_big = formatNum(p.buy_price_big) || formatNum(p.buy_price_small * (p.convert_factor || 1)) || 0;
    p.sell_price_small = formatNum(p.sell_price_small) || formatNum(p.sell_price) || 0;
    p.sell_price_big = formatNum(p.sell_price_big) || formatNum(p.sell_price_small * (p.convert_factor || 1)) || 0;
    return p;
});

function saveData() {
    localStorage.setItem('sys_products', JSON.stringify(db.products));
    localStorage.setItem('sys_customers', JSON.stringify(db.customers));
    localStorage.setItem('sys_sales', JSON.stringify(db.sales));
    localStorage.setItem('sys_shipments', JSON.stringify(db.shipments));
    if (typeof updateUI === 'function') updateUI(); // تحديث الواجهة إن كانت متوفرة
}
