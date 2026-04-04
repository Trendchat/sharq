// === إدارة المستخدمين والصلاحيات (User Management) ===

// ترجمة الأدوار
const roleNames = { 'admin': 'مدير', 'cashier': 'كاشير', 'employee': 'موظف مخزن' };
const deviceNames = { 'all': 'أي جهاز', 'pos_only': 'الكاشير فقط' };

// 1. عرض المستخدمين في الجدول
function renderUsers() {
    let tbody = document.getElementById('usersTableBody');
    if(!tbody) return;
    
    let searchTerm = document.getElementById('userSearch').value.toLowerCase();
    let roleFilter = document.getElementById('userRoleFilter').value;
    
    tbody.innerHTML = '';
    
    let filteredUsers = db.users.filter(u => {
        let matchName = u.fullName.toLowerCase().includes(searchTerm) || u.username.toLowerCase().includes(searchTerm);
        let matchRole = roleFilter === 'all' || u.role === roleFilter;
        return matchName && matchRole;
    });

    filteredUsers.forEach(u => {
        let statusBadge = u.status === 'active' 
            ? '<span class="status-badge active">نشط</span>' 
            : '<span class="status-badge inactive">موقوف</span>';
            
        let lastLog = u.lastLogin ? formatDateTime(u.lastLogin) : 'لم يسجل دخول';
        let isMainAdmin = u.id === 1;

        // أزرار العمليات (أيقونات)
        let actions = `
            <button class="action-btn" title="تعديل البيانات" onclick="openUserModal(${u.id})">✏️</button>
            <button class="action-btn" title="الصلاحيات" onclick="openPermissionsModal(${u.id})">🛡️</button>
            <button class="action-btn" title="تغيير كلمة المرور" onclick="openChangePasswordModal(${u.id})">🔒</button>
            ${!isMainAdmin ? `<button class="action-btn" title="${u.status === 'active' ? 'إيقاف' : 'تفعيل'}" onclick="toggleUserStatus(${u.id})">${u.status === 'active' ? '⛔' : '✅'}</button>` : ''}
            ${!isMainAdmin ? `<button class="action-btn" title="حذف نهائي" onclick="deleteUser(${u.id})">🗑️</button>` : ''}
        `;

        tbody.innerHTML += `
            <tr style="${u.status !== 'active' ? 'opacity: 0.6;' : ''}">
                <td style="font-weight:bold; color:var(--primary);">${u.username}</td>
                <td>${u.fullName}</td>
                <td><span class="badge-small">${roleNames[u.role] || u.role}</span></td>
                <td>${statusBadge}</td>
                <td style="font-size:12px; color:#7f8c8d;">${deviceNames[u.allowedDevice]}</td>
                <td dir="ltr" style="font-size:12px;">${lastLog}</td>
                <td>${actions}</td>
            </tr>
        `;
    });
}

// 2. نافذة الإضافة / التعديل
function openUserModal(id = null) {
    document.querySelectorAll('#userModal input').forEach(inp => inp.value = '');
    document.getElementById('u_role').value = 'cashier';
    document.getElementById('u_status').value = 'active';
    document.getElementById('u_device').value = 'all';

    if (id) {
        let u = db.users.find(x => x.id === id);
        document.getElementById('u_id').value = u.id;
        document.getElementById('u_fullName').value = u.fullName;
        document.getElementById('u_username').value = u.username;
        document.getElementById('u_role').value = u.role;
        document.getElementById('u_status').value = u.status;
        document.getElementById('u_device').value = u.allowedDevice || 'all';
        document.getElementById('u_pass_group').style.display = 'none'; // لا نعدل الباسورد من هنا
        document.getElementById('userModalTitle').innerText = 'تعديل بيانات المستخدم';
        
        if(u.id === 1) {
            document.getElementById('u_role').disabled = true;
            document.getElementById('u_status').disabled = true;
        } else {
            document.getElementById('u_role').disabled = false;
            document.getElementById('u_status').disabled = false;
        }
    } else {
        document.getElementById('u_id').value = '';
        document.getElementById('u_pass_group').style.display = 'block';
        document.getElementById('userModalTitle').innerText = 'إضافة مستخدم جديد';
        document.getElementById('u_role').disabled = false;
        document.getElementById('u_status').disabled = false;
    }
    openModal('userModal');
}

function saveUser() {
    let id = document.getElementById('u_id').value;
    let fullName = document.getElementById('u_fullName').value.trim();
    let username = document.getElementById('u_username').value.trim();
    let role = document.getElementById('u_role').value;
    let status = document.getElementById('u_status').value;
    let device = document.getElementById('u_device').value;
    let password = document.getElementById('u_password').value;

    if (!fullName || !username) return alert("يرجى إدخال الاسم واسم المستخدم.");

    // التحقق من تكرار اسم المستخدم
    let existing = db.users.find(u => u.username.toLowerCase() === username.toLowerCase() && u.id != id);
    if(existing) return alert("اسم المستخدم (للدخول) مستخدم مسبقاً، اختر اسماً آخر.");

    if (id) { // تعديل
        let u = db.users.find(x => x.id == id);
        u.fullName = fullName;
        u.username = username;
        if(u.id !== 1) { // حماية المدير
            u.role = role;
            u.status = status;
        }
        u.allowedDevice = device;
        logActivity(`تعديل بيانات المستخدم: ${username}`);
    } else { // إضافة
        if (!password) return alert("يرجى إدخال كلمة المرور للمستخدم الجديد.");
        
        // إعطاء صلاحيات افتراضية حسب الدور
        let defaultPerms = {};
        if(role === 'admin') {
            defaultPerms = { sales_create:true, sales_edit:true, sales_delete:true, inv_add:true, inv_edit:true, inv_delete:true, inv_cost:true, cust_add:true, cust_edit:true, cust_delete:true, rep_view:true, rep_export:true, sys_users:true, sys_backup:true };
        } else if (role === 'cashier') {
            defaultPerms = { sales_create:true, cust_add:true }; // الكاشير يبيع ويضيف عملاء فقط
        } else {
            defaultPerms = { inv_add:true, inv_edit:true }; // الموظف يدير المخزن
        }

        db.users.push({
            id: Date.now(),
            fullName: fullName,
            username: username,
            password: password,
            role: role,
            status: status,
            allowedDevice: device,
            createdAt: new Date().toISOString(),
            lastLogin: null,
            permissions: defaultPerms
        });
        logActivity(`إضافة مستخدم جديد: ${username}`);
    }

    saveData();
    closeModal('userModal');
    renderUsers();
    showSuccessPopup();
}

// 3. إيقاف وحذف المستخدمين
function toggleUserStatus(id) {
    if(id === 1) return alert("لا يمكن إيقاف مدير النظام الرئيسي!");
    let u = db.users.find(x => x.id === id);
    u.status = u.status === 'active' ? 'inactive' : 'active';
    logActivity(`تغيير حالة المستخدم ${u.username} إلى ${u.status}`);
    saveData();
    renderUsers();
}

function deleteUser(id) {
    if(id === 1) return alert("لا يمكن حذف مدير النظام الرئيسي!");
    let u = db.users.find(x => x.id === id);
    if(confirm(`هل أنت متأكد من حذف المستخدم "${u.fullName}" نهائياً؟`)) {
        db.users = db.users.filter(x => x.id !== id);
        logActivity(`حذف المستخدم: ${u.username}`);
        saveData();
        renderUsers();
    }
}

// 4. تغيير كلمة المرور
function openChangePasswordModal(id) {
    document.getElementById('pwd_userId').value = id;
    document.getElementById('pwd_new').value = '';
    document.getElementById('pwd_confirm').value = '';
    openModal('passwordModal');
}

function saveNewPassword() {
    let id = document.getElementById('pwd_userId').value;
    let p1 = document.getElementById('pwd_new').value;
    let p2 = document.getElementById('pwd_confirm').value;

    if(!p1) return alert("الرجاء إدخال كلمة المرور");
    if(p1 !== p2) return alert("كلمتا المرور غير متطابقتين!");

    let u = db.users.find(x => x.id == id);
    u.password = p1;
    logActivity(`تغيير كلمة مرور المستخدم: ${u.username}`);
    saveData();
    closeModal('passwordModal');
    showSuccessPopup();
}

// 5. إدارة الصلاحيات (الذكية)
const permissionMap = {
    'المبيعات والكاشير': { sales_create: 'إنشاء فاتورة', sales_edit: 'تعديل الفواتير', sales_delete: 'حذف/استرجاع فاتورة' },
    'المخزون والأصناف': { inv_add: 'إضافة صنف', inv_edit: 'تعديل صنف', inv_delete: 'حذف صنف', inv_cost: 'رؤية التكلفة ورأس المال' },
    'العملاء والديون': { cust_add: 'إضافة عميل', cust_edit: 'تعديل بيانات وتسديد', cust_delete: 'حذف عميل' },
    'التقارير المالية': { rep_view: 'عرض التقارير والأرباح', rep_export: 'طباعة وتصدير التقارير' },
    'إعدادات النظام': { sys_users: 'إدارة المستخدمين', sys_backup: 'النسخ الاحتياطي والإعدادات' }
};

function openPermissionsModal(id) {
    let u = db.users.find(x => x.id === id);
    document.getElementById('perm_userId').value = id;
    document.getElementById('perm_userName').innerText = u.fullName;
    
    let container = document.getElementById('permissionsForm');
    container.innerHTML = '';

    let userPerms = u.permissions || {};

    for (const [groupName, perms] of Object.entries(permissionMap)) {
        let groupHtml = `<div class="perm-group"><h4>${groupName}</h4><div class="perm-grid">`;
        for (const [permKey, permLabel] of Object.entries(perms)) {
            let isChecked = userPerms[permKey] ? 'checked' : '';
            let disabled = (u.id === 1) ? 'disabled' : ''; // المدير دائماً مفعل
            if(u.id===1) isChecked = 'checked';

            groupHtml += `
                <label class="perm-label">
                    <input type="checkbox" id="perm_${permKey}" value="${permKey}" ${isChecked} ${disabled}>
                    ${permLabel}
                </label>
            `;
        }
        groupHtml += `</div></div>`;
        container.innerHTML += groupHtml;
    }

    openModal('permissionsModal');
}

function savePermissions() {
    let id = parseInt(document.getElementById('perm_userId').value);
    if(id === 1) return closeModal('permissionsModal'); // لا نعدل صلاحيات المدير

    let u = db.users.find(x => x.id === id);
    let newPerms = {};
    
    document.querySelectorAll('#permissionsForm input[type="checkbox"]').forEach(chk => {
        newPerms[chk.value] = chk.checked;
    });

    u.permissions = newPerms;
    logActivity(`تعديل صلاحيات المستخدم: ${u.username}`);
    saveData();
    closeModal('permissionsModal');
    showSuccessPopup();
}

// 6. سجل النشاط (Activity Log)
function logActivity(actionDesc) {
    // في النظام الحقيقي نأخذ اسم المستخدم الذي سجل دخوله، هنا نفترض أنه المدير حالياً
    let activeUser = "admin"; 
    
    db.activity_logs.unshift({ // إضافة في البداية
        id: Date.now(),
        username: activeUser,
        action: actionDesc,
        time: new Date().toISOString(),
        device: navigator.userAgent.includes("Mobile") ? "جوال" : "كمبيوتر"
    });

    // الاحتفاظ بآخر 100 حركة فقط لعدم ثقل النظام
    if(db.activity_logs.length > 100) db.activity_logs.pop();
}

function showActivityLogs() {
    let tbody = document.getElementById('activityLogTable');
    tbody.innerHTML = '';
    
    if(db.activity_logs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">لا توجد نشاطات مسجلة بعد</td></tr>';
    } else {
        db.activity_logs.forEach(log => {
            tbody.innerHTML += `
                <tr>
                    <td dir="ltr" style="font-size:12px; color:#555;">${formatDateTime(log.time)}</td>
                    <td style="font-weight:bold; color:var(--primary);">${log.username}</td>
                    <td>${log.action}</td>
                    <td style="font-size:11px; color:#7f8c8d;">${log.device}</td>
                </tr>
            `;
        });
    }
    openModal('activityLogModal');
}

// تشغيل الواجهة عند فتح الشاشة
document.addEventListener("DOMContentLoaded", () => {
    // مراقبة فتح شاشة المستخدمين لتحديث الجدول
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.target.id === 'usersScreen' && mutation.target.classList.contains('active')) {
                renderUsers();
            }
        });
    });
    let usersScreen = document.getElementById('usersScreen');
    if(usersScreen) observer.observe(usersScreen, { attributes: true, attributeFilter: ['class'] });
});

//ملف شاشة تسجيل الدخول
// --- نظام المصادقة والصلاحيات (Authentication & Authorization) ---

let currentUser = null;

document.addEventListener("DOMContentLoaded", () => {
    checkLoginStatus();
});

function checkLoginStatus() {
    let savedUser = localStorage.getItem('sys_currentUser');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        unlockSystem();
    } else {
        lockSystem();
    }
}

function lockSystem() {
    document.body.classList.add('logged-out');
    document.getElementById('loginScreen').classList.add('active');
    
    // فحص هل النظام يفتح لأول مرة (لا يوجد مستخدمين أو يوجد admin فقط بكلمة المرور الافتراضية)
    const isFirstRun = !db.users || db.users.length === 0 || 
                      (db.users.length === 1 && db.users[0].username === 'admin' && db.users[0].password === '123');

    // إضافة تلميح للمستخدم الجديد
    let loginBox = document.querySelector('.login-box');
    let existingHint = document.getElementById('firstRunHint');
    
    if (isFirstRun && !existingHint) {
        let hint = document.createElement('div');
        hint.id = 'firstRunHint';
        hint.innerHTML = `
            <div style="background: #fff3cd; border: 1px dashed #ffeeba; color: #856404; padding: 10px; border-radius: 8px; margin-bottom: 20px; font-size: 14px; text-align: center; line-height: 1.6;">
                <strong>👋 مرحباً بك في نظام الشرق!</strong><br>
                للدخول أول مرة، استخدم البيانات الافتراضية:<br>
                المستخدم: <code style="background:#fff; padding:2px 5px; border-radius:3px;">admin</code> | 
                الكلمة: <code style="background:#fff; padding:2px 5px; border-radius:3px;">123</code>
            </div>
        `;
        // إدراج التلميح قبل حقول الإدخال
        loginBox.insertBefore(hint, loginBox.querySelector('.form-group'));
    } else if (!isFirstRun && existingHint) {
        existingHint.remove(); // إزالة التلميح إذا تم تغيير البيانات
    }

    document.getElementById('login_username').focus();
}

function unlockSystem() {
    document.body.classList.remove('logged-out');
    document.getElementById('loginScreen').classList.remove('active');
    
    // إظهار اسم المستخدم الحالي في الشريط العلوي
    let topNavTitle = document.querySelector('.top-nav h2');
    if (topNavTitle) topNavTitle.innerHTML = `نظام الشرق <span style="font-size:12px; color:#bdc3c7;">(مرحباً: ${currentUser.fullName})</span>`;
    
    applyUserPermissions();
}

function handleLoginEnter(event) {
    if (event.key === 'Enter') performLogin();
}

function performLogin() {
    let userBox = document.getElementById('login_username');
    let passBox = document.getElementById('login_password');
    let username = userBox.value.trim();
    let password = passBox.value;
    let remember = document.getElementById('login_remember').checked;

    if (!username || !password) {
        shakeInput(userBox); shakeInput(passBox);
        return alert("يرجى إدخال اسم المستخدم وكلمة المرور.");
    }

    if (!db.users || db.users.length === 0) {
        db.users = [{
            id: 1, username: 'admin', password: '123', fullName: 'مدير النظام', 
            role: 'admin', status: 'active', allowedDevice: 'all', permissions: {}
        }];
        localStorage.setItem('sys_users', JSON.stringify(db.users));
    }

    let user = db.users.find(u => u.username === username && u.password === password);

    if (user) {
        if (user.status !== 'active') {
            return alert("عفواً، هذا الحساب موقوف. يرجى مراجعة الإدارة.");
        }
        
        currentUser = user;
        
        if (remember) {
            localStorage.setItem('sys_currentUser', JSON.stringify(user));
        } else {
            sessionStorage.setItem('sys_currentUser', JSON.stringify(user));
        }

        userBox.value = ''; passBox.value = '';
        
        if(typeof logActivity === 'function') logActivity(`تسجيل دخول للنظام`);
        
        unlockSystem();
    } else {
        shakeInput(userBox); shakeInput(passBox);
        alert("اسم المستخدم أو كلمة المرور غير صحيحة!");
    }
}

function performLogout() {
    if(confirm("هل تريد تأكيد تسجيل الخروج؟")) {
        if(typeof logActivity === 'function' && currentUser) {
            logActivity(`تسجيل خروج من النظام`);
        }
        localStorage.removeItem('sys_currentUser');
        sessionStorage.removeItem('sys_currentUser');
        currentUser = null;
        location.reload(); 
    }
}

function shakeInput(element) {
    element.classList.add('shake-error');
    setTimeout(() => element.classList.remove('shake-error'), 400);
}

// --- تطبيق الصلاحيات على القائمة الجانبية وتوجيه المستخدم الشاشة الصحيحة ---
function applyUserPermissions() {
    if (!currentUser) return;
    
    let isManager = currentUser.role === 'admin';
    let perms = currentUser.permissions || {};

    // ربط كل شاشة بالصلاحيات الفعلية المحفوظة للمستخدم
    const screenPermissions = {
        'dashboardScreen': perms.rep_view || perms.inv_cost, 
        'salesScreen': perms.sales_create || perms.sales_edit, 
        'treasuryScreen': perms.rep_view || isManager, 
        'customersScreen': perms.cust_add || perms.cust_edit, 
        'inventoryScreen': perms.inv_add || perms.inv_edit || perms.inv_cost, 
        'reportsScreen': perms.rep_view, 
        'analyticsScreen': perms.rep_view, 
        'cloudScreen': isManager, 
        'localBackupScreen': isManager, // <--- الإضافة الجديدة (للمدير فقط)
        'settingsScreen': isManager, 
        'usersScreen': isManager 
    };

    let navButtons = document.querySelectorAll('.sidebar .nav-btn');
    let firstAllowedBtn = null; // لحفظ أول شاشة مسموحة للمستخدم

    navButtons.forEach(btn => {
        let onclickAttr = btn.getAttribute('onclick');
        if (!onclickAttr) return;

        // استخراج اسم الشاشة (ID) المربوطة بالزر
        let match = onclickAttr.match(/showScreen\('([^']+)'/);
        if (match) {
            let screenId = match[1];
            
            // المدير له كل الصلاحيات، غير المدير تُفحص صلاحياته
            let hasAccess = isManager ? true : !!screenPermissions[screenId];
            
            if (hasAccess) {
                btn.style.display = 'block';
                if (!firstAllowedBtn) firstAllowedBtn = btn; // نحفظ أول زر متاح
            } else {
                btn.style.display = 'none';
            }
        }
    });

    // --- توجيه المستخدم الذكي ---
    // إذا لم يكن مديراً، والشاشة المفتوحة حالياً ليس لديه صلاحية لها، نوجهه لأول شاشة يملكها
    if (!isManager) {
        let activeScreen = document.querySelector('.screen.active');
        let activeScreenId = activeScreen ? activeScreen.id : 'dashboardScreen';
        
        if (!screenPermissions[activeScreenId] && firstAllowedBtn) {
            firstAllowedBtn.click(); // يفتح شاشة الكاشير (أو غيرها) تلقائياً
        }
    }
}
 
// استدعاء تحديث اللوحة الذكية
updateSmartDashboard();