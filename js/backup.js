// === نظام النسخ الاحتياطي المحلي المتقدم (Advanced Local Backup System) ===
// يعتمد على IndexedDB لتخزين آمن وبمساحات كبيرة بعيداً عن قيود localStorage

const BACKUP_DB_NAME = 'SharqBackupSystem';
const BACKUP_DB_VERSION = 1;
const ENCRYPTION_KEY = 'SHARQ_SECURE_KEY_2026'; // مفتاح التشفير المحلي

let backupDB;

// 1. تهيئة قاعدة البيانات المحلية للنسخ الاحتياطي
function initBackupSystem() {
    return new Promise((resolve, reject) => {
        let request = indexedDB.open(BACKUP_DB_NAME, BACKUP_DB_VERSION);

        request.onupgradeneeded = function(e) {
            let db = e.target.result;
            // جدول النسخ الاحتياطية
            if (!db.objectStoreNames.contains('backups')) {
                db.createObjectStore('backups', { keyPath: 'id' });
            }
            // جدول سجلات العمليات Logs
            if (!db.objectStoreNames.contains('logs')) {
                db.createObjectStore('logs', { keyPath: 'id' });
            }
            // جدول الإعدادات
            if (!db.objectStoreNames.contains('settings')) {
                db.createObjectStore('settings', { keyPath: 'id' });
            }
        };

        request.onsuccess = function(e) {
            backupDB = e.target.result;
            loadBackupSettings();
            startBackupScheduler();
            renderBackupList();
            renderBackupLogs();
            resolve();
        };

        request.onerror = function(e) {
            console.error("خطأ في تهيئة نظام النسخ الاحتياطي", e);
            reject(e);
        };
    });
}

// 2. دوال التشفير والضغط الوهمي (تأمين البيانات)
function encryptData(text) {
    // تشفير مبسط (XOR + Base64) لبيئة المتصفح لتجنب البطء
    let result = '';
    for(let i = 0; i < text.length; i++) {
        result += String.fromCharCode(text.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length));
    }
    return btoa(unescape(encodeURIComponent(result)));
}

function decryptData(encoded) {
    let text = decodeURIComponent(escape(atob(encoded)));
    let result = '';
    for(let i = 0; i < text.length; i++) {
        result += String.fromCharCode(text.charCodeAt(i) ^ ENCRYPTION_KEY.charCodeAt(i % ENCRYPTION_KEY.length));
    }
    return result;
}

// إنشاء بصمة للتحقق من سلامة البيانات (Checksum)
function generateChecksum(str) {
    let hash = 0;
    for (let i = 0, len = str.length; i < len; i++) {
        let chr = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + chr;
        hash |= 0;
    }
    return hash.toString();
}

// 3. إنشاء النسخة الاحتياطية
function createBackup(type = 'Manual', customName = '') {
    return new Promise((resolve, reject) => {
        try {
            // جلب كل البيانات الحالية من النظام
            let currentData = {
                products: db.products, customers: db.customers, sales: db.sales,
                shipments: db.shipments, purchases: db.purchases, transactions: db.transactions,
                users: db.users, activity_logs: db.activity_logs, settings: db.settings
            };

            let jsonData = JSON.stringify(currentData);
            let checksum = generateChecksum(jsonData);
            
            // تطبيق التشفير إذا كان مفعلاً في الإعدادات
            let isEncrypted = document.getElementById('chk_encrypt_backup') ? document.getElementById('chk_encrypt_backup').checked : true;
            let finalData = isEncrypted ? encryptData(jsonData) : jsonData;

            // حساب الحجم التقريبي بالميجابايت
            let sizeMB = (new Blob([finalData]).size / (1024 * 1024)).toFixed(2);

            let backupObj = {
                id: Date.now(),
                name: customName || `Backup_${type}_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}`,
                type: type, // Full, Hourly, Emergency
                date: new Date().toISOString(),
                data: finalData,
                checksum: checksum,
                isEncrypted: isEncrypted,
                size: sizeMB + ' MB'
            };

            let transaction = backupDB.transaction(['backups'], 'readwrite');
            let store = transaction.objectStore('backups');
            store.add(backupObj);

            transaction.oncomplete = function() {
                addBackupLog(type, sizeMB + ' MB', 'ناجح');
                renderBackupList();
                applyRetentionPolicy(); // تنظيف النسخ القديمة
                if(type === 'Manual') showSuccessPopup();
                resolve(backupObj);
            };
            
            transaction.onerror = function(e) {
                addBackupLog(type, '-', 'فشل');
                reject(e);
            };
        } catch(err) {
            addBackupLog(type, '-', 'فشل (خطأ تقني)');
            reject(err);
        }
    });
}

// 4. استعادة النسخة الاحتياطية (الاستعادة الذكية)
function restoreBackup(id) {
    if(!confirm("⚠️ سيتم استبدال قاعدة البيانات الحالية بهذه النسخة.\nالبرنامج سيقوم بأخذ (نسخة طوارئ) قبل الاستعادة.\nهل أنت متأكد؟")) return;

    // أخذ نسخة طوارئ أولاً
    createBackup('Emergency', 'نسخة ما قبل الاستعادة').then(() => {
        let transaction = backupDB.transaction(['backups'], 'readonly');
        let store = transaction.objectStore('backups');
        let request = store.get(id);

        request.onsuccess = function(e) {
            let backup = e.target.result;
            if(!backup) return alert("النسخة غير موجودة!");

            try {
                // فك التشفير
                let rawData = backup.isEncrypted ? decryptData(backup.data) : backup.data;
                
                // فحص السلامة Checksum
                let currentChecksum = generateChecksum(rawData);
                if(currentChecksum !== backup.checksum) {
                    addBackupLog('Restore', backup.size, 'فشل (تلف في البيانات)');
                    return alert("❌ فشل التحقق من سلامة النسخة! البيانات قد تكون تالفة.");
                }

                let parsedData = JSON.parse(rawData);

                // استبدال البيانات في localStorage
                localStorage.setItem('sys_products', JSON.stringify(parsedData.products || []));
                localStorage.setItem('sys_customers', JSON.stringify(parsedData.customers || []));
                localStorage.setItem('sys_sales', JSON.stringify(parsedData.sales || []));
                localStorage.setItem('sys_shipments', JSON.stringify(parsedData.shipments || []));
                localStorage.setItem('sys_purchases', JSON.stringify(parsedData.purchases || []));
                localStorage.setItem('sys_transactions', JSON.stringify(parsedData.transactions || []));
                localStorage.setItem('sys_users', JSON.stringify(parsedData.users || []));
                localStorage.setItem('sys_activity_logs', JSON.stringify(parsedData.activity_logs || []));
                localStorage.setItem('sys_settings', JSON.stringify(parsedData.settings || {}));

                addBackupLog('Restore', backup.size, 'ناجح');
                alert("✅ تمت استعادة النسخة بنجاح وتم التحقق من سلامتها. سيتم إعادة تشغيل النظام.");
                location.reload();

            } catch(err) {
                console.error(err);
                alert("حدث خطأ أثناء فك تشفير أو استخراج البيانات.");
            }
        };
    });
}

// 5. إدارة سجلات النسخ (Logs)
function addBackupLog(type, size, status) {
    let logObj = { id: Date.now(), date: new Date().toISOString(), type: type, size: size, status: status };
    let transaction = backupDB.transaction(['logs'], 'readwrite');
    transaction.objectStore('logs').add(logObj);
    
    // الاحتفاظ بآخر 50 سجل فقط
    let req = transaction.objectStore('logs').getAll();
    req.onsuccess = function() {
        let allLogs = req.result;
        if(allLogs.length > 50) {
            let sorted = allLogs.sort((a,b) => a.id - b.id);
            let toDelete = sorted.slice(0, allLogs.length - 50);
            let delTrans = backupDB.transaction(['logs'], 'readwrite');
            toDelete.forEach(l => delTrans.objectStore('logs').delete(l.id));
        }
    };
    renderBackupLogs();
}

// 6. سياسة الاحتفاظ (Retention Policy) والتنظيف التلقائي
function applyRetentionPolicy() {
    let daysToKeep = parseInt(document.getElementById('set_retention_days').value) || 7;
    let cutoffTime = Date.now() - (daysToKeep * 24 * 60 * 60 * 1000);

    let transaction = backupDB.transaction(['backups'], 'readwrite');
    let store = transaction.objectStore('backups');
    let request = store.getAll();

    request.onsuccess = function(e) {
        let allBackups = e.target.result;
        allBackups.forEach(b => {
            // لا نحذف نسخ الطوارئ تلقائياً
            if (b.type !== 'Emergency' && b.id < cutoffTime) {
                store.delete(b.id);
                console.log("Deleted old backup:", b.name);
            }
        });
        renderBackupList();
    };
}

// 7. الجدولة التلقائية (Scheduler)
let schedulerInterval;
function startBackupScheduler() {
    if(schedulerInterval) clearInterval(schedulerInterval);
    
    schedulerInterval = setInterval(() => {
        let isHourlyEnabled = document.getElementById('chk_hourly_backup').checked;
        let isDailyEnabled = document.getElementById('chk_daily_backup').checked;
        
        let lastBackupTime = localStorage.getItem('last_auto_backup') || 0;
        let now = Date.now();
        
        // النسخ الساعي (Incremental Concept)
        if(isHourlyEnabled && (now - lastBackupTime >= 3600000)) { // 1 ساعة
            createBackup('Hourly (Auto)', `Auto_${new Date().getHours()}:00`);
            localStorage.setItem('last_auto_backup', now);
        }
        
        // النسخ اليومي
        let lastDailyTime = localStorage.getItem('last_daily_backup') || 0;
        if(isDailyEnabled && (now - lastDailyTime >= 86400000)) { // 24 ساعة
            createBackup('Daily Full', `Daily_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}`);
            localStorage.setItem('last_daily_backup', now);
        }
        
    }, 60000); // فحص كل دقيقة
}

// 8. تصدير النسخة لملف خارجي (External File)
function exportBackupToFile(id) {
    let transaction = backupDB.transaction(['backups'], 'readonly');
    let request = transaction.objectStore('backups').get(id);
    
    request.onsuccess = function(e) {
        let backup = e.target.result;
        if(!backup) return;
        
        let blob = new Blob([JSON.stringify(backup)], { type: "application/json" });
        let url = URL.createObjectURL(blob);
        let a = document.createElement('a');
        let ext = backup.isEncrypted ? '.bak' : '.json';
        a.href = url;
        a.download = `${backup.name}${ext}`;
        a.click();
        URL.revokeObjectURL(url);
    };
}

// 9. استيراد نسخة من ملف
function importBackupFromFile() {
    let fileInput = document.getElementById('import_backup_file');
    let file = fileInput.files[0];
    if(!file) return alert("يرجى اختيار ملف أولاً");

    let reader = new FileReader();
    reader.onload = function(e) {
        try {
            let importedBackup = JSON.parse(e.target.result);
            if(!importedBackup.data || !importedBackup.checksum) {
                return alert("الملف غير صالح أو ليس نسخة احتياطية لنظام الشرق.");
            }
            
            importedBackup.id = Date.now(); // إعطاء ID جديد محلي
            importedBackup.name = "مستورد: " + importedBackup.name;
            
            let transaction = backupDB.transaction(['backups'], 'readwrite');
            transaction.objectStore('backups').add(importedBackup);
            
            transaction.oncomplete = function() {
                addBackupLog('Import', importedBackup.size, 'ناجح');
                renderBackupList();
                alert("تم استيراد النسخة بنجاح للقائمة. يمكنك الآن استعادتها.");
                fileInput.value = '';
            };
        } catch(err) {
            alert("خطأ في قراءة الملف. تأكد أنه ملف نسخة صالح.");
        }
    };
    reader.readAsText(file);
}

// 10. واجهة المستخدم (الريندر)
function renderBackupList() {
    let tbody = document.getElementById('localBackupsTable');
    if(!tbody) return;
    
    let transaction = backupDB.transaction(['backups'], 'readonly');
    let request = transaction.objectStore('backups').getAll();
    
    request.onsuccess = function(e) {
        let backups = e.target.result.sort((a,b) => b.id - a.id);
        tbody.innerHTML = '';
        if(backups.length === 0) tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;">لا توجد نسخ احتياطية</td></tr>';
        
        backups.forEach(b => {
            let typeColor = b.type.includes('Full') || b.type === 'Manual' ? 'var(--primary)' : (b.type === 'Emergency' ? 'var(--danger)' : 'var(--accent)');
            let encBadge = b.isEncrypted ? '🔒 مشفر' : '🔓 غير مشفر';
            
            tbody.innerHTML += `
                <tr>
                    <td dir="ltr" style="font-size:12px;">${formatDateTime(b.date)}</td>
                    <td style="font-weight:bold;">${b.name}</td>
                    <td><span class="badge-small" style="background:${typeColor}">${b.type}</span></td>
                    <td dir="ltr">${b.size} <br><small style="color:#7f8c8d;">${encBadge}</small></td>
                    <td>
                        <button class="btn btn-primary" style="padding:5px 8px; font-size:12px;" onclick="restoreBackup(${b.id})">↩️ استعادة</button>
                        <button class="btn btn-success" style="padding:5px 8px; font-size:12px;" onclick="exportBackupToFile(${b.id})">⬇️ تحميل</button>
                        <button class="btn btn-danger" style="padding:5px 8px; font-size:12px;" onclick="deleteBackup(${b.id})">🗑️</button>
                    </td>
                </tr>
            `;
        });
    };
}

function renderBackupLogs() {
    let tbody = document.getElementById('backupLogsTable');
    if(!tbody) return;
    
    let transaction = backupDB.transaction(['logs'], 'readonly');
    let request = transaction.objectStore('logs').getAll();
    
    request.onsuccess = function(e) {
        let logs = e.target.result.sort((a,b) => b.id - a.id).slice(0, 10); // آخر 10
        tbody.innerHTML = '';
        logs.forEach(l => {
            let statusColor = l.status.includes('ناجح') ? 'green' : 'red';
            tbody.innerHTML += `
                <tr>
                    <td dir="ltr" style="font-size:11px;">${formatDateTime(l.date)}</td>
                    <td>${l.type}</td>
                    <td dir="ltr">${l.size}</td>
                    <td style="color:${statusColor}; font-weight:bold;">${l.status}</td>
                </tr>
            `;
        });
    };
}

function deleteBackup(id) {
    if(confirm("هل أنت متأكد من حذف هذه النسخة؟")) {
        let transaction = backupDB.transaction(['backups'], 'readwrite');
        transaction.objectStore('backups').delete(id);
        transaction.oncomplete = () => renderBackupList();
    }
}

// حفظ الإعدادات وتحميلها
function saveBackupSettings() {
    let settings = {
        id: 'main',
        daily: document.getElementById('chk_daily_backup').checked,
        hourly: document.getElementById('chk_hourly_backup').checked,
        encrypt: document.getElementById('chk_encrypt_backup').checked,
        retention: document.getElementById('set_retention_days').value
    };
    
    let transaction = backupDB.transaction(['settings'], 'readwrite');
    transaction.objectStore('settings').put(settings);
    transaction.oncomplete = () => {
        showSuccessPopup();
        startBackupScheduler();
    };
}

function loadBackupSettings() {
    let transaction = backupDB.transaction(['settings'], 'readonly');
    let request = transaction.objectStore('settings').get('main');
    request.onsuccess = function(e) {
        let s = e.target.result;
        if(s) {
            if(document.getElementById('chk_daily_backup')) document.getElementById('chk_daily_backup').checked = s.daily;
            if(document.getElementById('chk_hourly_backup')) document.getElementById('chk_hourly_backup').checked = s.hourly;
            if(document.getElementById('chk_encrypt_backup')) document.getElementById('chk_encrypt_backup').checked = s.encrypt;
            if(document.getElementById('set_retention_days')) document.getElementById('set_retention_days').value = s.retention;
        }
    };
}

// تشغيل النظام عند تحميل الصفحة
document.addEventListener("DOMContentLoaded", () => {
    initBackupSystem();
});