/* === نظام النسخ الاحتياطي (Supabase Cloud Backup) === */

let _supabase = null;
const _supaConfig = {
    url: "https://brdsujcmwzlloliblpfs.supabase.co",
    key: "sb_publishable_mKxgVwWd2APVkmMrGH20Mw_FMS8glZ5" 
};

// --- دوال مساعدة للنوافذ الجديدة ---
function showLoader(msg) {
    let loaderText = document.getElementById('cloudLoadingText');
    if(loaderText) loaderText.innerText = msg || "جاري المعالجة...";
    openModal('cloudLoadingModal');
}

function hideLoader() {
    closeModal('cloudLoadingModal');
}

function showCloudAlert(title, msg, type = 'accent') {
    let tEl = document.getElementById('cloudAlertTitle');
    let mEl = document.getElementById('cloudAlertMsg');
    if(tEl && mEl) {
        tEl.innerText = title;
        tEl.style.color = `var(--${type})`;
        mEl.innerText = msg;
        openModal('cloudAlertModal');
    } else {
        alert(msg); // Fallback logic
    }
}

let confirmCallback = null;
function showCloudConfirm(msg, callback) {
    let msgEl = document.getElementById('cloudConfirmMsg');
    if(msgEl) {
        msgEl.innerHTML = msg;
        confirmCallback = callback;
        openModal('cloudConfirmModal');
    } else {
        if(confirm(msg.replace(/<br>/g, "\n"))) callback();
    }
}

// ربط زر التأكيد في النافذة المنبثقة
document.addEventListener("DOMContentLoaded", () => {
    let btnYes = document.getElementById('btnConfirmYes');
    if(btnYes) {
        btnYes.onclick = function() {
            if (confirmCallback) confirmCallback();
            closeModal('cloudConfirmModal');
        };
    }
});

// 1. التهيئة والعزل (Isolation)
function initCloudSystem() {
    if (typeof window.supabase !== 'undefined') {
        _supabase = window.supabase.createClient(_supaConfig.url, _supaConfig.key);
        return;
    }
    
    showLoader("جاري الاتصال بالسيرفر...");
    let script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2";
    script.onload = () => {
        _supabase = window.supabase.createClient(_supaConfig.url, _supaConfig.key);
        hideLoader();
        console.log("Supabase Loaded Isolatedly.");
        checkLoginState();
    };
    script.onerror = () => {
        hideLoader();
        showCloudAlert("خطأ", "فشل الاتصال بالخادم. تأكد من اتصال الإنترنت.", "danger");
    };
    document.body.appendChild(script);
}

// 2. التحقق من حالة تسجيل الدخول
function checkLoginState() {
    let savedUser = localStorage.getItem('cloud_username');
    if(savedUser) {
        document.getElementById('authSection').style.display = 'none';
        document.getElementById('cloudDashboard').style.display = 'block';
        document.getElementById('cloud_current_user').innerText = savedUser;
        updateLimitUI();
    } else {
        document.getElementById('authSection').style.display = 'block';
        document.getElementById('cloudDashboard').style.display = 'none';
    }
}

// 3. التسجيل (Sign Up)
async function cloudSignup() {
    if(!_supabase) return showCloudAlert("خطأ", "النظام غير متصل", "danger");
    let u = document.getElementById('cloud_user').value.trim();
    let p = document.getElementById('cloud_pass').value.trim();
    if(!u || !p) return showCloudAlert("بيانات ناقصة", "أدخل اسم مستخدم وكلمة مرور", "warning");

    showLoader("جاري إنشاء الحساب...");
    
    let { data: exist } = await _supabase.from('system_users').select('username').eq('username', u).single();
    if(exist) {
        hideLoader();
        return showCloudAlert("مستخدم موجود", "اسم المستخدم موجود بالفعل، حاول تسجيل الدخول.", "warning");
    }

    let { error } = await _supabase.from('system_users').insert([{ username: u, password: p }]);
    hideLoader();

    if(error) return showCloudAlert("خطأ", "خطأ في الإنشاء: " + error.message, "danger");
    
    showCloudAlert("نجاح", "تم إنشاء الحساب بنجاح! يمكنك الآن تسجيل الدخول.", "success");
}

// 4. تسجيل الدخول (Login)
async function cloudLogin() {
    if(!_supabase) return showCloudAlert("خطأ", "انتظر تحميل النظام...", "danger");
    let u = document.getElementById('cloud_user').value.trim();
    let p = document.getElementById('cloud_pass').value.trim();
    
    showLoader("جاري التحقق...");
    
    let { data, error } = await _supabase.from('system_users')
        .select('*').eq('username', u).eq('password', p).single();

    hideLoader();

    if(error || !data) {
        showCloudAlert("فشل الدخول", "بيانات الدخول غير صحيحة", "danger");
        return;
    }

    localStorage.setItem('cloud_username', u);
    checkLoginState();
    
    // محاولة التنزيل التلقائي عند الدخول (فحص فقط)
    checkForBackupAuto(u);
}

async function checkForBackupAuto(user) {
    let { data, error } = await _supabase.from('backups').select('updated_at').eq('username', user).single();
    if(data) {
        showCloudConfirm(
            `مرحباً <b>${user}</b>،<br>يوجد نسخة احتياطية بتاريخ: <span dir="ltr">${formatDateTime(data.updated_at)}</span><br><br>هل ترغب في تنزيلها الآن؟`, 
            () => doRestore(true) // إذا وافق نفذ التنزيل
        );
    }
}

// 5. الخروج (Logout)
function cloudLogout() {
    showCloudConfirm("هل تريد تسجيل الخروج؟<br><small>ستبقى البيانات محفوظة محلياً.</small>", function(){
        localStorage.removeItem('cloud_username');
        location.reload();
    });
}

// 6. التحقق من حد الرفع اليومي (3 مرات)
function checkUploadLimit() {
    let today = new Date().toDateString();
    let record = JSON.parse(localStorage.getItem('cloud_limit')) || { date: today, count: 0 };
    if(record.date !== today) { record = { date: today, count: 0 }; }
    if(record.count >= 3) return false;
    return record;
}

function incrementUploadLimit(record) {
    record.count++;
    localStorage.setItem('cloud_limit', JSON.stringify(record));
    updateLimitUI();
}

function updateLimitUI() {
    let record = JSON.parse(localStorage.getItem('cloud_limit')) || { count: 0 };
    let left = 3 - record.count;
    if(left < 0) left = 0;
    document.getElementById('backupLimit').innerText = left;
}

// 7. الرفع (Backup)
async function doBackup() {
    let user = localStorage.getItem('cloud_username');
    if(!user) return;

    let limitRecord = checkUploadLimit();
    if(!limitRecord) return showCloudAlert("تنبيه", "عذراً، لقد استهلكت حد الرفع اليومي (3 مرات).", "warning");

    showLoader("جاري رفع البيانات...");

    let oneWeekAgo = new Date(); oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    let filteredSales = db.sales.filter(s => new Date(s.date) >= oneWeekAgo);

    let payload = {
        username: user,
        products: db.products,
        customers: db.customers,
        sales: filteredSales, 
        shipments: db.shipments,
        updated_at: new Date().toISOString()
    };

    let { error } = await _supabase.from('backups').upsert(payload, { onConflict: 'username' });
    hideLoader();

    if(error) {
        showCloudAlert("فشل", "حدث خطأ أثناء الرفع: " + error.message, "danger");
    } else {
        incrementUploadLimit(limitRecord);
        showCloudAlert("تم بنجاح", "تم حفظ النسخة الاحتياطية بنجاح.", "success");
    }
}

// 8. التنزيل (Restore)
async function doRestore(isManual) {
    let user = localStorage.getItem('cloud_username');
    if(!user) return;

    // إذا كان الاستدعاء يدوياً، نعرض تأكيداً أولاً
    if(isManual && !confirmCallback) { 
         showCloudConfirm(
            "⚠️ <b>تحذير هام:</b><br>تنزيل النسخة سيقوم باستبدال كافة البيانات الحالية ببيانات السحابة.<br><br>هل أنت متأكد؟",
            () => executeRestoreLogic()
        );
        return;
    } else if (isManual) {
        executeRestoreLogic();
    }
}

async function executeRestoreLogic() {
    let user = localStorage.getItem('cloud_username');
    showLoader("جاري جلب البيانات من السحابة...");

    let { data, error } = await _supabase.from('backups').select('*').eq('username', user).single();
    hideLoader();

    if(error || !data) {
        showCloudAlert("لا توجد نسخة", "لا توجد نسخة احتياطية محفوظة لهذا الحساب.", "warning");
        return;
    }

    localStorage.setItem('sys_products', JSON.stringify(data.products || []));
    localStorage.setItem('sys_customers', JSON.stringify(data.customers || []));
    localStorage.setItem('sys_sales', JSON.stringify(data.sales || []));
    localStorage.setItem('sys_shipments', JSON.stringify(data.shipments || []));
    
    showCloudAlert("تم الاستعادة", "تم استعادة البيانات بنجاح! سيتم إعادة تحميل النظام.", "success");
    setTimeout(() => location.reload(), 1500);

}
