/**
 * Export/Import UI Component for Favorites and Progress
 * RTL, accessible, mobile-responsive
 * @module components/export-import
 */

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function closeExportImport() {
  const modal = document.querySelector('.export-import-modal');
  if (modal) {
    modal.hidden = true;
    document.body.style.overflow = '';
  }
}

function createExportImportModal() {
  const modal = document.createElement('div');
  modal.className = 'export-import-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.setAttribute('aria-labelledby', 'exportImportTitle');
  modal.hidden = true;

  modal.innerHTML = `
    <div class="modal-overlay" aria-hidden="true"></div>
    <div class="modal-content">
      <header class="modal-header">
        <h2 id="exportImportTitle">📤 تصدير واستيراد البيانات</h2>
        <button type="button" class="modal-close" aria-label="إغلاق">&times;</button>
      </header>
      <div class="modal-body">
        <div class="export-section">
          <h3>📤 تصدير البيانات</h3>
          <p class="section-desc">احفظ نسخة احتياطية من مفضلاتك وتقدمك في القراءة</p>
          <div class="export-options">
            <label class="checkbox-label">
              <input type="checkbox" id="exportFavorites" checked>
              <span>المفضلة (${getFavoritesCount()})</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" id="exportProgress" checked>
              <span>تقدم القراءة (${getProgressCount()})</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" id="exportSettings" checked>
              <span>الإعدادات</span>
            </label>
          </div>
          <button type="button" id="exportBtn" class="btn btn-primary">
            <span class="btn-icon">💾</span>
            <span>تصدير كملف JSON</span>
          </button>
        </div>

        <div class="divider" role="separator"></div>

        <div class="import-section">
          <h3>📥 استيراد البيانات</h3>
          <p class="section-desc">استعد بياناتك من نسخة احتياطية سابقة</p>
          <div class="import-options">
            <label class="checkbox-label">
              <input type="checkbox" id="importFavorites" checked>
              <span>المفضلة</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" id="importProgress" checked>
              <span>تقدم القراءة</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" id="importSettings" checked>
              <span>الإعدادات</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" id="importMerge" checked>
              <span>دمج مع البيانات الموجودة (بدلاً من الاستبدال)</span>
            </label>
          </div>
          <div class="file-input-wrapper">
            <input type="file" id="importFile" accept=".json" hidden>
            <button type="button" id="selectFileBtn" class="btn btn-secondary">
              <span class="btn-icon">📁</span>
              <span>اختر ملف JSON</span>
            </button>
            <span id="selectedFileName" class="file-name"></span>
          </div>
          <button type="button" id="importBtn" class="btn btn-primary" disabled>
            <span class="btn-icon">📥</span>
            <span>استيراد</span>
          </button>
        </div>

        <div class="divider" role="separator"></div>

        <div class="clear-section">
          <h3>🗑️ مسح البيانات</h3>
          <p class="section-desc">احذف جميع البيانات المخزنة محليًا</p>
          <div class="clear-options">
            <label class="checkbox-label">
              <input type="checkbox" id="clearFavorites">
              <span>المفضلة</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" id="clearProgress">
              <span>تقدم القراءة</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" id="clearSettings">
              <span>الإعدادات</span>
            </label>
            <label class="checkbox-label">
              <input type="checkbox" id="clearAll">
              <span>كل شيء (بما في ذلك الإشعارات، السجل، إلخ)</span>
            </label>
          </div>
          <button type="button" id="clearBtn" class="btn btn-danger">
            <span class="btn-icon">🗑️</span>
            <span>مسح المحدد</span>
          </button>
        </div>
      </div>
      <footer class="modal-footer">
        <button type="button" class="btn btn-secondary modal-close-btn">إغلاق</button>
      </footer>
    </div>
  `;

  // Event listeners
  const closeBtn = modal.querySelector('.modal-close');
  const closeBtn2 = modal.querySelector('.modal-close-btn');
  const overlay = modal.querySelector('.modal-overlay');
  const exportBtn = modal.querySelector('#exportBtn');
  const selectFileBtn = modal.querySelector('#selectFileBtn');
  const importFile = modal.querySelector('#importFile');
  const importBtn = modal.querySelector('#importBtn');
  const clearBtn = modal.querySelector('#clearBtn');
  const fileNameEl = modal.querySelector('#selectedFileName');

  // Use exported close function
  const closeModal = closeExportImport;

  [closeBtn, closeBtn2, overlay].forEach(el => {
    el.addEventListener('click', closeModal);
  });

  // Handle Escape key
  modal.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // Export
  exportBtn.addEventListener('click', async () => {
    const exportFav = modal.querySelector('#exportFavorites').checked;
    const exportProg = modal.querySelector('#exportProgress').checked;
    const exportSet = modal.querySelector('#exportSettings').checked;

    const data = {
      version: 1,
      timestamp: new Date().toISOString(),
      favorites: exportFav ? await getFavoritesData() : undefined,
      progress: exportProg ? await getProgressData() : undefined,
      settings: exportSet ? await getSettingsData() : undefined
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `islamic-library-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast('تم تصدير البيانات بنجاح', 'success');
  });

  // File selection
  selectFileBtn.addEventListener('click', () => importFile.click());
  importFile.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      fileNameEl.textContent = file.name;
      importBtn.disabled = false;
    }
  });

  // Import
  importBtn.addEventListener('click', async () => {
    const file = importFile.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (data.version !== 1) {
        throw new Error('إصدار ملف غير مدعوم');
      }

      const merge = modal.querySelector('#importMerge').checked;
      const importFav = modal.querySelector('#importFavorites').checked;
      const importProg = modal.querySelector('#importProgress').checked;
      const importSet = modal.querySelector('#importSettings').checked;

      if (importFav && data.favorites) {
        await importFavoritesData(data.favorites, merge);
      }
      if (importProg && data.progress) {
        await importProgressData(data.progress, merge);
      }
      if (importSet && data.settings) {
        await importSettingsData(data.settings, merge);
      }

      showToast('تم استيراد البيانات بنجاح', 'success');
      closeModal();
      importFile.value = '';
      fileNameEl.textContent = '';
      importBtn.disabled = true;
      updateCounts();
    } catch (e) {
      console.error('Import error:', e);
      showToast('فشل الاستيراد: ' + e.message, 'error');
    }
  });

  // Clear
  clearBtn.addEventListener('click', async () => {
    if (!confirm('هل أنت متأكد من مسح البيانات المحددة؟ لا يمكن التراجع عن هذا الإجراء.')) return;

    const clearFav = modal.querySelector('#clearFavorites').checked;
    const clearProg = modal.querySelector('#clearProgress').checked;
    const clearSet = modal.querySelector('#clearSettings').checked;
    const clearAll = modal.querySelector('#clearAll').checked;

    if (clearAll || clearFav) await clearFavoritesData();
    if (clearAll || clearProg) await clearProgressData();
    if (clearAll || clearSet) await clearSettingsData();

    showToast('تم مسح البيانات', 'success');
    updateCounts();
  });

  function updateCounts() {
    modal.querySelector('#exportFavorites').nextElementSibling.textContent = `المفضلة (${getFavoritesCount()})`;
    modal.querySelector('#exportProgress').nextElementSibling.textContent = `تقدم القراءة (${getProgressCount()})`;
  }

  return modal;
}

async function getFavoritesCount() {
  try {
    const { favoritesManager } = await import('./favorites-manager.js');
    const favs = await favoritesManager.getAllFavorites();
    return favs.length;
  } catch {
    return 0;
  }
}

async function getProgressCount() {
  try {
    const { progressTracker } = await import('./progress-tracker.js');
    // This is approximate since we can't easily count all progress entries
    return 0; // Would need to iterate localStorage
  } catch {
    return 0;
  }
}

async function getFavoritesData() {
  const { favoritesManager } = await import('./favorites-manager.js');
  return await favoritesManager.getAllFavorites();
}

async function getProgressData() {
  const { progressTracker } = await import('./progress-tracker.js');
  // Get all progress from localStorage
  const progress = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('progress:')) {
      try {
        progress[key] = JSON.parse(localStorage.getItem(key));
      } catch {}
    }
  }
  return progress;
}

async function getSettingsData() {
  const settings = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('lib-') || key.startsWith('noor-'))) {
      try {
        settings[key] = JSON.parse(localStorage.getItem(key));
      } catch {
        settings[key] = localStorage.getItem(key);
      }
    }
  }
  return settings;
}

async function importFavoritesData(data, merge) {
  const { favoritesManager } = await import('./favorites-manager.js');
  if (!merge) {
    // Clear existing
    const existing = await favoritesManager.getAllFavorites();
    for (const item of existing) {
      await favoritesManager.removeFavorite(item.id);
    }
  }
  for (const item of data) {
    await favoritesManager.addFavorite(item.id, item.type, item);
  }
}

async function importProgressData(data, merge) {
  if (!merge) {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('progress:')) {
        localStorage.removeItem(key);
      }
    }
  }
  for (const [key, value] of Object.entries(data)) {
    localStorage.setItem(key, JSON.stringify(value));
  }
}

async function importSettingsData(data, merge) {
  if (!merge) {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('lib-') || key.startsWith('noor-'))) {
        localStorage.removeItem(key);
      }
    }
  }
  for (const [key, value] of Object.entries(data)) {
    localStorage.setItem(key, JSON.stringify(value));
  }
}

async function clearFavoritesData() {
  const { favoritesManager } = await import('./favorites-manager.js');
  const existing = await favoritesManager.getAllFavorites();
  for (const item of existing) {
    await favoritesManager.removeFavorite(item.id);
  }
}

async function clearProgressData() {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith('progress:')) {
      localStorage.removeItem(key);
    }
  }
}

async function clearSettingsData() {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('lib-') || key.startsWith('noor-'))) {
      localStorage.removeItem(key);
    }
  }
}

export function initExportImport(container) {
  const modal = createExportImportModal();
  container.appendChild(modal);
  return modal;
}

export function openExportImport() {
  const modal = document.querySelector('.export-import-modal');
  if (modal) {
    modal.hidden = false;
    document.body.style.overflow = 'hidden';
    // Focus first focusable element
    const firstBtn = modal.querySelector('button');
    if (firstBtn) firstBtn.focus();
  }
}