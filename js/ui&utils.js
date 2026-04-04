// --- دوال تنسيق الأرقام والتواريخ ---
const formatNum = (num) => {
    let n = parseFloat(num);
    return isNaN(n) ? 0 : parseFloat(n.toFixed(2));
};

const displayNum = (num) => {
    let n = parseFloat(num);
    return isNaN(n) ? "0" : n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

const formatDateTime = (isoString) => {
    if (!isoString) return "";
    let d = new Date(isoString);
    let datePart = d.toLocaleDateString('en-GB', { 
        year: 'numeric', month: '2-digit', day: '2-digit' 
    }).split('/').reverse().join('/'); 
    let hours = d.getHours();
    let minutes = d.getMinutes();
    let ampm = hours >= 12 ? 'م' : 'ص';
    hours = hours % 12;
    hours = hours ? hours : 12; 
    minutes = minutes < 10 ? '0' + minutes : minutes;
    return `${datePart} | ${hours}:${minutes} ${ampm}`;
};

// --- 2. واجهة المستخدم والتنقل (UI Navigation) ---
function toggleSidebar() { 
    document.getElementById('sidebar').classList.toggle('show'); 
    document.getElementById('sidebarOverlay').classList.toggle('show');
}

function showScreen(screenId, btnElement) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
    
    if(btnElement) btnElement.classList.add('active');
    
    if(window.innerWidth <= 768 && document.getElementById('sidebar').classList.contains('show')) {
        toggleSidebar(); 
    }
    
    if (typeof updateUI === 'function') updateUI();
    
    // تحميل الأصناف وتفعيل حقل الباركود تلقائياً عند الدخول للكاشير
    if (screenId === 'salesScreen' && typeof renderFastProducts === 'function') {
        renderFastProducts();
        setTimeout(() => {
            let searchBox = document.getElementById('fastSearch');
            if(searchBox) searchBox.focus(); // التركيز التلقائي لسهولة المسح
        }, 100);
    }
}

function openModal(id) { document.getElementById(id).classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

function showSuccessPopup() {
    let modal = document.getElementById('successModal');
    modal.classList.add('active');
    setTimeout(() => modal.classList.remove('active'), 2000);
}

function confirmClearAllData() { openModal('resetSystemModal'); }
function executeClearAllData() { localStorage.clear(); location.reload(); }

// --- 3. نظام مسح الباركود بالكاميرا (Camera Barcode Scanner) ---
let html5QrCodeScannerInstance = null;

function openCameraScanner(targetInputId, autoSubmit = false) {
    // فتح نافذة الكاميرا
    document.getElementById('cameraScannerModal').classList.add('active');
    
    // تهيئة المكتبة إذا لم تكن مهيأة
    if (!html5QrCodeScannerInstance) {
        html5QrCodeScannerInstance = new Html5Qrcode("qr-reader");
    }

    const config = { fps: 10, qrbox: { width: 250, height: 100 } }; // حجم مربع المسح
    
    // استخدام الكاميرا الخلفية (environment)
    html5QrCodeScannerInstance.start(
        { facingMode: "environment" }, 
        config, 
        (decodedText, decodedResult) => {
            // عند نجاح المسح
            let targetInput = document.getElementById(targetInputId);
            if(targetInput) {
                targetInput.value = decodedText; // وضع الرقم في الحقل المطلوب
                
                if(autoSubmit) {
                    // محاكاة الضغط على زر Enter إذا كان الاستدعاء من الكاشير
                    let event = new KeyboardEvent('keypress', { key: 'Enter' });
                    targetInput.dispatchEvent(event);
                }
            }
            // إغلاق الكاميرا مباشرة بعد المسح بنجاح
            closeCameraScanner();
        },
        (errorMessage) => {
            // تجاهل أخطاء عدم وجود باركود بالصورة لكي تستمر الكاميرا بالعمل
        }
    ).catch((err) => {
        alert("لم نتمكن من الوصول إلى الكاميرا. يرجى التأكد من إعطاء الصلاحيات للمتصفح.");
        closeCameraScanner();
    });
}

function closeCameraScanner() {
    document.getElementById('cameraScannerModal').classList.remove('active');
    // إيقاف تشغيل الكاميرا لتوفير الموارد
    if (html5QrCodeScannerInstance && html5QrCodeScannerInstance.isScanning) {
        html5QrCodeScannerInstance.stop().then(() => {
            html5QrCodeScannerInstance.clear();
        }).catch(err => {
            console.error("Failed to stop scanning.", err);
        });
    }
}

// ==========================================
// 🚀 نظام لوحة التحكم الذكية (Smart Dashboard)
// ==========================================

// --- دالة إخفاء وإظهار الأرقام (Privacy Mode) ---
function togglePrivacyMode() {
    let body = document.body;
    let btn = document.getElementById('btnPrivacyToggle');
    
    body.classList.toggle('privacy-mode');
    
    if (body.classList.contains('privacy-mode')) {
        btn.innerHTML = '👁️‍🗨️ إظهار الأرقام';
        btn.style.background = 'var(--danger)';
        localStorage.setItem('sys_privacy_mode', 'true'); // حفظ حالة الخصوصية
    } else {
        btn.innerHTML = '👁️ إخفاء الأرقام';
        btn.style.background = '#34495e';
        localStorage.setItem('sys_privacy_mode', 'false');
    }
}

// تفعيل وضع الخصوصية تلقائياً عند تحميل الصفحة إذا كان محفوظاً
document.addEventListener("DOMContentLoaded", () => {
    if(localStorage.getItem('sys_privacy_mode') === 'true') {
        togglePrivacyMode();
    }
    
    // تحديث التاريخ في الترويسة
    let dateDisplay = document.getElementById('current_date_display');
    if(dateDisplay) {
        let options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
        dateDisplay.innerText = new Date().toLocaleDateString('ar-EG', options);
    }
});

// --- تحديث لوحة التحكم الذكية (Smart Dashboard) ---
function updateSmartDashboard() {
    if(!document.getElementById('dash_cash_sales')) return;

    let todayDate = new Date().toISOString().split('T')[0];
    
    // جلب مبيعات اليوم غير المسترجعة
    let todaySales = db.sales.filter(s => s.date.startsWith(todayDate) && !s.is_returned);
    
    // حساب المبيعات
    let todayTotalAmount = todaySales.reduce((sum, s) => sum + (s.total || 0), 0); 
    document.getElementById('dash_cash_sales').innerHTML = `${displayNum(todayTotalAmount)} <span style="font-size:14px; color:#7f8c8d;">${db.settings.currency}</span>`;

    // حساب أرباح اليوم
    let todayTotalProfit = todaySales.reduce((sum, s) => sum + (s.profit || 0), 0);
    let profitEl = document.getElementById('dash_today_profit');
    if(profitEl) profitEl.innerHTML = `${displayNum(todayTotalProfit)} <span style="font-size:14px; color:#7f8c8d;">${db.settings.currency}</span>`;

    // رصيد الصندوق
    if(typeof calculateSafeBalance === 'function') {
        let mainSafeBalance = calculateSafeBalance(1); 
        document.getElementById('dash_safe_balance').innerHTML = `${displayNum(mainSafeBalance)} <span style="font-size:14px; color:#7f8c8d;">${db.settings.currency}</span>`;
    }

    // الديون
    let totalDebts = db.customers.reduce((sum, c) => sum + (c.total_debt > 0 ? c.total_debt : 0), 0);
    document.getElementById('dash_total_debts').innerHTML = `${displayNum(totalDebts)} <span style="font-size:14px; color:#7f8c8d;">${db.settings.currency}</span>`;

    updateSystemStatusBar();
    updateDashboardTicker();
    updateDashboardRecentActivity();
    
    if(typeof renderDashboardCharts === 'function') {
        renderDashboardCharts();
    }
}

// 🟢 دالة جديدة لتحديث شريط حالة النظام والوردية
function updateSystemStatusBar() {
    let statusBar = document.getElementById('systemStatusBar');
    if(!statusBar) return;

    let activeShift = typeof getActiveShift === 'function' ? getActiveShift() : null;
    let shiftHtml = activeShift 
        ? `<span style="color:var(--success)">🟢 وردية نشطة (#${activeShift.id})</span>` 
        : `<span style="color:var(--danger)">🔴 مغلق (لا توجد وردية)</span>`;

    let timeNow = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    let itemsCount = db.products.filter(p => p.stock > 0).length;

    statusBar.innerHTML = `
        <div class="status-item">⏱️ تحديث: <span dir="ltr">${timeNow}</span></div>
        <div class="status-item">🕒 الصندوق: ${shiftHtml}</div>
        <div class="status-item">📦 أصناف نشطة: <span style="color:var(--accent)">${itemsCount}</span></div>
    `;
}

function updateDashboardTicker() {
    let ticker = document.getElementById('dashboardTicker');
    if (!ticker) return;
    let alerts = [];

    // تنبيهات المخزون
    let outOfStock = db.products.filter(p => p.stock <= 0).length;
    let lowStock = db.products.filter(p => p.stock > 0 && p.stock <= 5).length;
    if (outOfStock > 0) alerts.push(`❌ ${outOfStock} صنف نفد من المخزون!`);
    if (lowStock > 0) alerts.push(`📦 ${lowStock} أصناف قاربت على الانتهاء.`);

    // تنبيهات الديون والسوق
    // --- تنبيهات الديون المخصصة ---
    const GLOBAL_LIMIT = db.settings.globalCreditLimit || 50000; 
    
    db.customers.forEach(customer => {
        // الأولوية دائماً للحد الخاص بالعميل إذا وُجد، وإلا نستخدم الحد العام
        let limit = (customer.credit_limit && customer.credit_limit > 0) ? customer.credit_limit : GLOBAL_LIMIT;
        
        if (customer.total_debt >= limit) {
            alerts.push(`⚠️ العميل [${customer.name}] تجاوز حد الدين المسموح به (${displayNum(limit)}).`);
        }
    });

    // إحصاءات البيع والشراء اليومية
    let todayDate = new Date().toISOString().split('T')[0];
    let todaySales = db.sales.filter(s => s.date.startsWith(todayDate) && !s.is_returned);
    let todayPurchases = db.purchases.filter(p => p.date.startsWith(todayDate) && !p.is_returned);
    
    if (todaySales.length > 0) {
        let profit = todaySales.reduce((sum, s) => sum + (s.profit || 0), 0);
        alerts.push(`🔥 إنجاز: ${todaySales.length} فاتورة بيع اليوم.`);
        alerts.push(`📈 أرباح اليوم التقديرية: ${displayNum(profit)} ${db.settings.currency}.`);
    }
    if (todayPurchases.length > 0) alerts.push(`🛒 تم تسجيل ${todayPurchases.length} عملية توريد اليوم.`);

    // تذكير الوردية
    let activeShift = typeof getActiveShift === 'function' ? getActiveShift() : null;
    if(!activeShift) alerts.push(`🔔 تذكير: يرجى فتح وردية كاشير لتتمكن من البيع.`);

    if (alerts.length === 0) alerts.push(`✨ النظام مستقر وكل شيء يعمل بشكل ممتاز.. يوم عمل موفّق!`);
    
    ticker.innerHTML = alerts.map(text => `<span style="margin: 0 40px;">${text}</span>`).join(' • ');
}

function updateDashboardRecentActivity() {
    let recentList = document.getElementById('dash_recent_activity');
    if (!recentList) return;
    recentList.innerHTML = '';
    
    // 1. جلب الحركات النقدية من الصندوق
    let allActivities = [...db.transactions];

    // 2. جلب المبيعات الآجلة (السلف) من جدول المبيعات ودمجها
    db.sales.forEach(sale => {
        if (sale.invoice_type === 'credit' && !sale.is_returned) {
            let cName = sale.cash_name || "عميل غير محدد";
            if (sale.customer_id) {
                let c = db.customers.find(x => x.id === sale.customer_id);
                if (c) cName = c.name;
            }
            allActivities.push({
                id: sale.id,
                type: 'credit',
                amount: sale.debt_amount !== undefined ? sale.debt_amount : sale.total,
                desc: `مبيعات آجلة (سلف) للعميل: ${cName} - فاتورة #${sale.id}`,
                date: sale.date,
                safe_id: null // لا ترتبط بصندوق نقدي
            });
        }
    });

    // 3. ترتيب جميع الحركات زمنياً من الأحدث إلى الأقدم
    allActivities.sort((a, b) => new Date(b.date) - new Date(a.date));

    // أخذ أحدث 20 حركة فقط للعرض
    let lastTransactions = allActivities.slice(0, 20);
    
    if (lastTransactions.length === 0) {
        recentList.innerHTML = '<p style="text-align:center; color:#7f8c8d; padding: 20px;">لا توجد حركات مالية مسجلة بعد.</p>';
        return;
    }

    lastTransactions.forEach(tr => {
        // 🟢 تعريف أنواع الحركات
        let isIncome = tr.type === 'income';
        let isCredit = tr.type === 'credit'; // نوع المبيعات الآجلة

        // 🟢 تحديد الأيقونة واللون بناءً على النوع
        let icon = isIncome ? '🟢' : (isCredit ? '⏳' : '🔴');
        let color = isIncome ? 'var(--success)' : (isCredit ? '#e67e22' : 'var(--danger)'); // برتقالي للآجل
        let sign = isIncome ? '+' : (isCredit ? '- ' : '-');
        let timeStr = formatDateTime(tr.date); 

        // 🟢 ملاحظة: إذا كانت الحركة آجل، نكتب (حساب عميل) بدلاً من رقم الصندوق
        let sourceText = isCredit ? '(حساب عميل)' : `(صندوق #${tr.safe_id})`;

        recentList.innerHTML += `
            <div class="activity-item">
                <div style="font-size: 1.05em; flex: 1;">
                    <span>${icon}</span>
                    <strong style="margin-right: 8px;">${tr.desc}</strong>
                    <div style="font-size: 0.8em; color: #7f8c8d; margin-right: 32px; margin-top: 4px;">
                        🕒 ${timeStr} | ${sourceText}
                    </div>
                </div>
                <div style="color: ${color}; font-weight: bold; font-size: 1.3em; margin-right: 15px;" dir="ltr">
                    ${sign}${displayNum(tr.amount)}
                </div>
            </div>
        `;
    });
}

function goToCashier() {
    showScreen('salesScreen');
    setTimeout(() => {
        let fastSearch = document.getElementById('fastSearch');
        if(fastSearch) fastSearch.focus();
    }, 100);
}

function openOverviewPopup() {
    openModal('overviewModal');
    if(typeof updateAnalytics === 'function') {
        updateAnalytics(); // استدعاء دالة الرسم البياني الموجودة في reports.js
    }
}
// ================= إصلاح حجم المخططات عند تدوير الشاشة =================

// مراقبة تغيير حجم النافذة بشكل عام
window.addEventListener('resize', function() {
    if (typeof weeklyChartInstance !== 'undefined' && weeklyChartInstance) {
        weeklyChartInstance.resize();
    }
    if (typeof todayChartInstance !== 'undefined' && todayChartInstance) {
        todayChartInstance.resize();
    }
});

// مراقبة تدوير الشاشة في الهواتف (من أفقي إلى عمودي والعكس)
window.addEventListener('orientationchange', function() {
    // نضع تأخير زمني بسيط (200 ملي ثانية) لكي نعطي المتصفح فرصة لتحديث أبعاد الشاشة الجديدة 
    // قبل أن نطلب من الرسم البياني تحديث حجمه
    setTimeout(function() {
        if (typeof weeklyChartInstance !== 'undefined' && weeklyChartInstance) {
            weeklyChartInstance.resize();
        }
        if (typeof todayChartInstance !== 'undefined' && todayChartInstance) {
            todayChartInstance.resize();
        }
    }, 200); 
});