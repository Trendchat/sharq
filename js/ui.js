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
    
    // سطر جديد: تحميل الأصناف فور فتح شاشة الكاشير
    if (screenId === 'salesScreen' && typeof renderFastProducts === 'function') {
        renderFastProducts();
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
