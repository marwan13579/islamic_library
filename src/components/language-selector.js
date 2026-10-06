/**
 * Accessible Language Selector Component
 * Features:
 * - Full keyboard navigation
 * - Screen reader support with ARIA
 * - Search/filter functionality
 * - RTL/LTR aware
 * - Persists selection
 * @module components/language-selector
 */

class LanguageSelector {
  constructor(options = {}) {
    this.buttonId = options.buttonId || 'langBtn';
    this.menuId = options.menuId || 'langMenu';
    this.labelId = options.labelId || 'langBtnLabel';
    this.onChange = options.onChange || (() => {});
    this.i18n = options.i18n || window.__i18n;
    
    this.button = null;
    this.menu = null;
    this.label = null;
    this.isOpen = false;
    this.searchInput = null;
    this.filteredLanguages = [];
    this.focusedIndex = -1;
    
    this.init();
  }
  
  init() {
    this.button = document.getElementById(this.buttonId);
    this.menu = document.getElementById(this.menuId);
    this.label = document.getElementById(this.labelId);
    
    if (!this.button || !this.menu || !this.label) {
      console.warn('LanguageSelector: Required elements not found');
      return;
    }
    
    this.setupButton();
    this.setupMenu();
    this.renderLanguages();
    this.setupEventListeners();
    this.updateCurrentLanguage();
  }
  
  setupButton() {
    this.button.setAttribute('type', 'button');
    this.button.setAttribute('aria-haspopup', 'listbox');
    this.button.setAttribute('aria-expanded', 'false');
    this.button.setAttribute('aria-controls', this.menuId);
    this.button.setAttribute('aria-label', this.i18n?.tCommon?.('language') || 'Language');
    
    // Add keyboard event listeners
    this.button.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });
    
    this.button.addEventListener('keydown', (e) => this.handleButtonKeydown(e));
  }
  
  setupMenu() {
    this.menu.setAttribute('role', 'listbox');
    this.menu.setAttribute('aria-label', this.i18n?.tCommon?.('language') || 'Language');
    this.menu.setAttribute('aria-orientation', 'vertical');
    this.menu.hidden = true;
    
    // Create search input
    this.searchInput = document.createElement('input');
    this.searchInput.type = 'search';
    this.searchInput.className = 'lang-search';
    this.searchInput.placeholder = this.i18n?.tCommon?.('searchPlaceholder') || 'Search languages...';
    this.searchInput.setAttribute('aria-label', this.i18n?.tCommon?.('searchPlaceholder') || 'Search languages');
    this.searchInput.setAttribute('autocomplete', 'off');
    this.searchInput.style.cssText = `
      width: 100%;
      padding: 8px 12px;
      margin-bottom: 6px;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--card);
      color: var(--ink);
      font-family: inherit;
      font-size: 0.85rem;
    `;
    this.menu.insertBefore(this.searchInput, this.menu.firstChild);
    
    this.searchInput.addEventListener('input', (e) => this.filterLanguages(e.target.value));
    this.searchInput.addEventListener('keydown', (e) => this.handleSearchKeydown(e));
  }
  
  renderLanguages() {
    if (!this.i18n || !this.i18n.localeList) return;
    
    const languages = this.i18n.localeList();
    this.filteredLanguages = languages;
    
    // Clear existing language buttons (keep search input)
    const existingButtons = this.menu.querySelectorAll('.lang-option');
    existingButtons.forEach(btn => btn.remove());
    
    languages.forEach((lang, index) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lang-option';
      btn.setAttribute('role', 'option');
      btn.setAttribute('data-lang', lang.code);
      btn.setAttribute('data-index', index);
      btn.setAttribute('aria-selected', lang.code === this.i18n.lang() ? 'true' : 'false');
      btn.tabIndex = -1;
      
      // Flag/emoji for language
      const flag = this.getLanguageFlag(lang.code);
      
      btn.innerHTML = `
        <span class="lang-flag" aria-hidden="true">${flag}</span>
        <span class="lang-native">${lang.label}</span>
        <span class="lang-english" style="opacity: 0.7; font-size: 0.75rem;">${lang.name}</span>
        ${lang.dir === 'rtl' ? '<span class="lang-dir" aria-hidden="true">↘️</span>' : ''}
      `;
      
      btn.style.cssText = `
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        text-align: ${lang.dir === 'rtl' ? 'right' : 'left'};
        background: none;
        border: 0;
        color: var(--ink);
        padding: 10px 12px;
        border-radius: 8px;
        cursor: pointer;
        font-family: inherit;
        font-size: 0.85rem;
        direction: ${lang.dir};
      `;
      
      btn.addEventListener('click', () => this.selectLanguage(lang.code));
      btn.addEventListener('mouseenter', () => this.setFocusedIndex(index));
      btn.addEventListener('keydown', (e) => this.handleOptionKeydown(e, index));
      
      this.menu.appendChild(btn);
    });
    
    // Update current language indicator
    this.updateCurrentLanguage();
  }
  
  getLanguageFlag(code) {
    const flags = {
      'ar': '🇸🇦', 'en': '🇺🇸', 'fr': '🇫🇷', 'es': '🇪🇸', 'de': '🇩🇪',
      'it': '🇮🇹', 'pt': '🇵🇹', 'nl': '🇳🇱', 'pl': '🇵🇱', 'sv': '🇸🇪',
      'no': '🇳🇴', 'da': '🇩🇰', 'fi': '🇫🇮', 'el': '🇬🇷', 'cs': '🇨🇿',
      'ro': '🇷🇴', 'hu': '🇭🇺', 'uk': '🇺🇦', 'ru': '🇷🇺', 'tr': '🇹🇷',
      'fa': '🇮🇷', 'ur': '🇵🇰', 'bn': '🇧🇩', 'hi': '🇮🇳', 'id': '🇮🇩',
      'ms': '🇲🇾', 'zh-CN': '🇨🇳', 'zh-TW': '🇹🇼', 'ja': '🇯🇵', 'ko': '🇰🇷',
      'th': '🇹🇭', 'vi': '🇻🇳', 'sw': '🇹🇿', 'ha': '🇳🇬', 'am': '🇪🇹'
    };
    return flags[code] || '🌐';
  }
  
  filterLanguages(query) {
    const normalizedQuery = query.toLowerCase().trim();
    
    this.filteredLanguages = this.i18n.localeList().filter(lang => 
      lang.label.toLowerCase().includes(normalizedQuery) ||
      lang.name.toLowerCase().includes(normalizedQuery) ||
      lang.code.toLowerCase().includes(normalizedQuery)
    );
    
    // Re-render with filtered languages
    const existingButtons = this.menu.querySelectorAll('.lang-option');
    existingButtons.forEach(btn => btn.remove());
    
    this.filteredLanguages.forEach((lang, index) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lang-option';
      btn.setAttribute('role', 'option');
      btn.setAttribute('data-lang', lang.code);
      btn.setAttribute('data-index', index);
      btn.setAttribute('aria-selected', lang.code === this.i18n.lang() ? 'true' : 'false');
      btn.tabIndex = -1;
      
      const flag = this.getLanguageFlag(lang.code);
      
      btn.innerHTML = `
        <span class="lang-flag" aria-hidden="true">${flag}</span>
        <span class="lang-native">${lang.label}</span>
        <span class="lang-english" style="opacity: 0.7; font-size: 0.75rem;">${lang.name}</span>
        ${lang.dir === 'rtl' ? '<span class="lang-dir" aria-hidden="true">↘️</span>' : ''}
      `;
      
      btn.style.cssText = `
        display: flex;
        align-items: center;
        gap: 10px;
        width: 100%;
        text-align: ${lang.dir === 'rtl' ? 'right' : 'left'};
        background: none;
        border: 0;
        color: var(--ink);
        padding: 10px 12px;
        border-radius: 8px;
        cursor: pointer;
        font-family: inherit;
        font-size: 0.85rem;
        direction: ${lang.dir};
      `;
      
      btn.addEventListener('click', () => this.selectLanguage(lang.code));
      btn.addEventListener('mouseenter', () => this.setFocusedIndex(index));
      btn.addEventListener('keydown', (e) => this.handleOptionKeydown(e, index));
      
      this.menu.appendChild(btn);
    });
    
    this.focusedIndex = -1;
    this.updateFocusedOption();
  }
  
  setupEventListeners() {
    // Close on outside click
    document.addEventListener('click', (e) => {
      if (this.isOpen && !this.button.contains(e.target) && !this.menu.contains(e.target)) {
        this.close();
      }
    });
    
    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
        this.button.focus();
      }
    });
    
    // Listen for locale changes
    if (this.i18n && this.i18n.onLocaleChange) {
      this.i18n.onLocaleChange(() => {
        this.updateCurrentLanguage();
        this.renderLanguages();
      });
    }
  }
  
  toggle() {
    if (this.isOpen) {
      this.close();
    } else {
      this.open();
    }
  }
  
  open() {
    this.isOpen = true;
    this.menu.hidden = false;
    this.button.setAttribute('aria-expanded', 'true');
    this.menu.classList.add('open');
    
    // Focus search input
    setTimeout(() => {
      this.searchInput?.focus();
    }, 0);
    
    // Announce to screen readers
    this.announce(this.i18n?.tCommon?.('language') || 'Language menu opened');
  }
  
  close() {
    this.isOpen = false;
    this.menu.hidden = true;
    this.button.setAttribute('aria-expanded', 'false');
    this.menu.classList.remove('open');
    this.searchInput.value = '';
    this.filterLanguages('');
  }
  
  selectLanguage(langCode) {
    if (!this.i18n || !this.i18n.setLocale) return;
    
    const lang = this.i18n.localeList().find(l => l.code === langCode);
    if (!lang) return;
    
    this.announce(`${this.i18n.tCommon?.('language') || 'Language'} changed to ${lang.label}`);
    
    this.i18n.setLocale(langCode).then(() => {
      this.close();
      this.button.focus();
      this.onChange(langCode);
    });
  }
  
  updateCurrentLanguage() {
    if (!this.i18n) return;
    
    const currentLang = this.i18n.lang();
    const langInfo = this.i18n.localeList().find(l => l.code === currentLang);
    
    if (langInfo && this.label) {
      this.label.textContent = langInfo.label;
    }
    
    // Update aria-selected on options
    const options = this.menu.querySelectorAll('.lang-option');
    options.forEach(opt => {
      const isSelected = opt.getAttribute('data-lang') === currentLang;
      opt.setAttribute('aria-selected', isSelected.toString());
      if (isSelected) {
        opt.style.background = 'var(--paper-2)';
        opt.style.fontWeight = '600';
      } else {
        opt.style.background = 'none';
        opt.style.fontWeight = 'normal';
      }
    });
  }
  
  setFocusedIndex(index) {
    this.focusedIndex = index;
    this.updateFocusedOption();
  }
  
  updateFocusedOption() {
    const options = this.menu.querySelectorAll('.lang-option');
    options.forEach((opt, index) => {
      if (index === this.focusedIndex) {
        opt.style.background = 'var(--paper-2)';
        opt.style.outline = '2px solid var(--gold)';
        opt.style.outlineOffset = '-2px';
        opt.scrollIntoView({ block: 'nearest' });
      } else {
        opt.style.outline = 'none';
        if (opt.getAttribute('data-lang') !== this.i18n?.lang()) {
          opt.style.background = 'none';
        }
      }
    });
  }
  
  handleButtonKeydown(e) {
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        this.toggle();
        break;
      case 'ArrowDown':
        e.preventDefault();
        this.open();
        this.setFocusedIndex(0);
        break;
      case 'ArrowUp':
        e.preventDefault();
        this.open();
        this.setFocusedIndex(this.filteredLanguages.length - 1);
        break;
    }
  }
  
  handleSearchKeydown(e) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        this.setFocusedIndex(0);
        const firstOption = this.menu.querySelector('.lang-option');
        firstOption?.focus();
        break;
      case 'Escape':
        this.close();
        this.button.focus();
        break;
    }
  }
  
  handleOptionKeydown(e, index) {
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        this.selectLanguage(this.filteredLanguages[index].code);
        break;
      case 'ArrowDown':
        e.preventDefault();
        const nextIndex = Math.min(index + 1, this.filteredLanguages.length - 1);
        this.setFocusedIndex(nextIndex);
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (index > 0) {
          this.setFocusedIndex(index - 1);
        } else {
          this.searchInput.focus();
        }
        break;
      case 'Home':
        e.preventDefault();
        this.setFocusedIndex(0);
        break;
      case 'End':
        e.preventDefault();
        this.setFocusedIndex(this.filteredLanguages.length - 1);
        break;
      case 'Escape':
        this.close();
        this.button.focus();
        break;
      case 'Tab':
        // Allow natural tab behavior
        break;
      default:
        // Type-ahead: jump to language starting with typed character
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          this.typeAhead(e.key.toLowerCase(), index);
        }
    }
  }
  
  typeAhead(char, currentIndex) {
    for (let i = 1; i <= this.filteredLanguages.length; i++) {
      const checkIndex = (currentIndex + i) % this.filteredLanguages.length;
      const lang = this.filteredLanguages[checkIndex];
      if (lang.label.toLowerCase().startsWith(char) || lang.name.toLowerCase().startsWith(char)) {
        this.setFocusedIndex(checkIndex);
        break;
      }
    }
  }
  
  announce(message) {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', 'polite');
    announcement.setAttribute('aria-atomic', 'true');
    announcement.style.cssText = 'position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden;';
    announcement.textContent = message;
    document.body.appendChild(announcement);
    setTimeout(() => announcement.remove(), 1000);
  }
  
  destroy() {
    // Clean up event listeners
    document.removeEventListener('click', this.handleOutsideClick);
    document.removeEventListener('keydown', this.handleGlobalKeydown);
    this.button?.removeEventListener('click', this.handleButtonClick);
    this.button?.removeEventListener('keydown', this.handleButtonKeydown);
    this.searchInput?.removeEventListener('input', this.handleSearchInput);
    this.searchInput?.removeEventListener('keydown', this.handleSearchKeydown);
  }
}

// Auto-initialize if elements exist
document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('langBtn') && document.getElementById('langMenu')) {
    window.languageSelector = new LanguageSelector({
      i18n: window.__i18n
    });
  }
});

export { LanguageSelector };
export default LanguageSelector;