// --- 8. إعدادات النظام المتقدمة (System Settings) ---

function loadSettingsUI() {
    let screen = document.getElementById('settingsScreen');
    
    // بناء واجهة الإعدادات بشكل ديناميكي (نوافذ وبطاقات مدمجة)
    if(!screen.classList.contains('initialized-advanced')) {
        screen.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap;">
                <h2>⚙️ إعدادات النظام المتقدمة</h2>
                <button class="btn btn-success" style="padding:10px 20px; font-size:16px;" onclick="saveSettings()">💾 حفظ التغييرات</button>
            </div><br>
            
            <div class="cards" style="max-width: 1000px; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));">
                
                <div class="card" style="border-top: 4px solid var(--primary);">
                    <h3 style="color:var(--primary); margin-bottom:15px;">🏪 بيانات المحل والشعار</h3>
                    <div class="form-group"><label>اسم المتجر (يظهر بالفاتورة)</label><input type="text" id="set_storeName"></div>
                    <div class="form-group"><label>العنوان الجغرافي</label><input type="text" id="set_address" placeholder="مثال: صنعاء - شارع الستين"></div>
                    <div class="form-group"><label>رقم هاتف آخر / إيميل</label><input type="text" id="set_contact" placeholder="معلومات تواصل إضافية"></div>
                    <div class="form-group" style="background:#f8f9fa; padding:10px; border-radius:8px;">
                        <label>شعار المحل (Logo)</label>
                        <input type="file" id="set_logoFile" accept="image/*" onchange="encodeLogo()" style="margin-bottom:10px;">
                        <input type="hidden" id="set_logoBase64">
                        <img id="logoPreview" style="max-width:120px; max-height:120px; display:none; border-radius:8px; border:1px solid #ddd; padding:5px; background:white;">
                        <button class="btn btn-danger" id="btnRemoveLogo" style="display:none; margin-top:5px; padding:5px 10px; font-size:12px;" onclick="removeLogo()">🗑️ إزالة الشعار</button>
                    </div>
                </div>

                <div class="card" style="border-top: 4px solid #e67e22;">
                    <h3 style="color:#e67e22; margin-bottom:15px;">🖨️ إعدادات الطباعة والفاتورة</h3>
                    <div class="form-group"><label>تنسيق الفاتورة الأساسي</label>
                        <select id="set_invoiceFormat"><option value="thermal">حرارية (طابعات ريسيت)</option><option value="a4">مقاس كبير (A4)</option></select>
                    </div>
                    <div class="form-group"><label>مقاس الطابعة الحرارية (العرض)</label>
                        <select id="set_printerSize"><option value="80mm">80 مللي متر (كبيرة)</option><option value="58mm">58 مللي متر (صغيرة)</option></select>
                    </div>
                    
                    <div style="display:flex; gap:10px;">
                        <div class="form-group" style="flex:1;"><label>حجم خط الفاتورة</label><input type="number" id="set_fontSize" min="10" max="30" title="افتراضي: 14"></div>
                        <div class="form-group" style="flex:1;"><label>الهوامش الجانبية</label><input type="number" id="set_margin" min="0" max="50" title="افتراضي: 10"></div>
                    </div>
                    <div class="form-group" style="background:#eef2f5; padding:10px; border-radius:8px;">
                        <label style="color:#555;">الطابعة الافتراضية</label>
                        <p style="font-size:12px; color:#7f8c8d; margin-bottom:10px;">يعتمد النظام على طابعة المتصفح أو تطبيق الأندرويد الأساسي. للتأكد من اتصالها اضغط فحص:</p>
                        <button class="btn btn-primary btn-full" style="background-color:#34495e;" onclick="testPrint()">🔍 فحص واتصال بالطابعة</button>
                    </div>
                </div>

                <div class="card" style="border-top: 4px solid var(--success);">
                    <h3 style="color:var(--success); margin-bottom:15px;">⚙️ إعدادات عامة ومالية</h3>
                    <div class="form-group"><label>العملة المحلية</label><input type="text" id="set_currency"></div>
                    <div class="form-group">
    <label>حد الدين العام الافتراضي (لكل العملاء)</label>
    <input type="number" id="set_globalCreditLimit" placeholder="مثال: 50000">
</div>
                    <div class="form-group"><label>نسبة الضريبة المضافة (%) <small>خياري</small></label><input type="number" id="set_taxRate" min="0" step="0.5"></div>
                    <div class="form-group"><label>ثيم النظام (الألوان)</label>
                        <select id="set_theme">
                            <option value="default">الافتراضي (أزرق داكن)</option>
                            <option value="green">الأخضر (الطبيعة)</option>
                            <option value="dark">الوضع الليلي (Dark Mode)</option>
                            <option value="royal">الملكي الفاخر (كحلي وذهبي) ✨</option>
                            <option value="burgundy">العنابي الفخم (أحمر وذهبي) ✨</option>
                            <option value="luxury-dark">الأسود والذهبي الفاخر ✨</option>
                        </select>
                    </div>
                </div>
            </div>
        `;
        screen.classList.add('initialized-advanced');
    }

    // تعبئة البيانات من قاعدة البيانات
    document.getElementById('set_storeName').value = db.settings.storeName || "";
    document.getElementById('set_address').value = db.settings.storeAddress || "";
    document.getElementById('set_contact').value = db.settings.storeContact || "";
    document.getElementById('set_currency').value = db.settings.currency || "ريال";
    document.getElementById('set_globalCreditLimit').value = db.settings.globalCreditLimit || 50000;
    document.getElementById('set_taxRate').value = db.settings.taxRate || 0;
    document.getElementById('set_theme').value = db.settings.theme || "default";
    document.getElementById('set_invoiceFormat').value = db.settings.invoiceFormat || "thermal";
    document.getElementById('set_printerSize').value = db.settings.printerSize || "80mm";
    document.getElementById('set_fontSize').value = db.settings.receiptFontSize || 14;
    document.getElementById('set_margin').value = db.settings.receiptMargin !== undefined ? db.settings.receiptMargin : 10;

    if(db.settings.storeLogo) {
        document.getElementById('set_logoBase64').value = db.settings.storeLogo;
        document.getElementById('logoPreview').src = db.settings.storeLogo;
        document.getElementById('logoPreview').style.display = "block";
        document.getElementById('btnRemoveLogo').style.display = "inline-block";
    }
}

// دالة تحويل الصورة إلى نص Base64
function encodeLogo() {
    let file = document.getElementById('set_logoFile').files[0];
    if(!file) return;
    let reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('set_logoBase64').value = e.target.result;
        document.getElementById('logoPreview').src = e.target.result;
        document.getElementById('logoPreview').style.display = "block";
        document.getElementById('btnRemoveLogo').style.display = "inline-block";
    };
    reader.readAsDataURL(file);
}

function removeLogo() {
    document.getElementById('set_logoBase64').value = "";
    document.getElementById('set_logoFile').value = "";
    document.getElementById('logoPreview').src = "";
    document.getElementById('logoPreview').style.display = "none";
    document.getElementById('btnRemoveLogo').style.display = "none";
}

// فحص الطابعة
function testPrint() {
    let size = document.getElementById('set_printerSize').value;
    let pWidth = size === '58mm' ? '58mm' : '80mm';
    let fSize = document.getElementById('set_fontSize').value || 14;
    let sName = document.getElementById('set_storeName').value || "نظام الشرق";
    
    let html = `<div style="width: ${pWidth}; margin: auto; text-align: center; font-family: sans-serif; padding: 10px; font-size: ${fSize}px; direction: rtl;">
        <h3 style="margin-bottom:5px;">${sName}</h3>
        <p style="margin:5px 0; font-weight:bold; border-top:1px dashed #000; border-bottom:1px dashed #000; padding:10px 0;">✔️ اختبار الطابعة بنجاح</p>
        <p style="margin:5px 0;">مقاس الورق: ${size}</p>
        <p style="margin:5px 0; font-size:0.8em;">(إذا رأيت هذه الورقة فالطابعة متصلة تماماً)</p>
    </div>`;
    
    if (window.AndroidBridge) { 
        // إذا كان تطبيق أندرويد
        window.AndroidBridge.printHtml(html); // دالة مقترحة مستقبلاً للجسر
        alert("تم إرسال أمر الفحص للطابعة");
    } else {
        let printWindow = window.open('', '', 'width=400,height=400');
        printWindow.document.write('<html><head><title>فحص الطابعة</title></head><body>' + html + '</body></html>');
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
    }
}

function saveSettings() {
    db.settings.storeName = document.getElementById('set_storeName').value.trim() || "نظام الشرق";
    db.settings.storeAddress = document.getElementById('set_address').value.trim();
    db.settings.storeContact = document.getElementById('set_contact').value.trim();
    db.settings.storeLogo = document.getElementById('set_logoBase64').value;
    
    db.settings.currency = document.getElementById('set_currency').value.trim() || "ريال";
    db.settings.taxRate = parseFloat(document.getElementById('set_taxRate').value) || 0;
    db.settings.theme = document.getElementById('set_theme').value;
    
    db.settings.invoiceFormat = document.getElementById('set_invoiceFormat').value;
    db.settings.printerSize = document.getElementById('set_printerSize').value;
    db.settings.receiptFontSize = parseInt(document.getElementById('set_fontSize').value) || 14;
    db.settings.receiptMargin = parseInt(document.getElementById('set_margin').value) || 10;
    db.settings.globalCreditLimit = parseFloat(document.getElementById('set_globalCreditLimit').value) || 50000;

    saveData();
    applySettings();
    showSuccessPopup();
}

function applySettings() {
    document.body.className = ''; 
    if (db.settings.theme && db.settings.theme !== 'default') {
        document.body.classList.add('theme-' + db.settings.theme);
    }

    document.querySelectorAll('.store-name-display').forEach(el => {
        el.innerText = db.settings.storeName;
    });

    if (typeof updateUI === 'function') {
        updateUI();
    }
}

document.addEventListener("DOMContentLoaded", () => {
    loadSettingsUI();
    applySettings();
});