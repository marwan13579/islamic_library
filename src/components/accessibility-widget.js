/**
 * Accessibility Settings Widget
 * Provides a floating button + panel for accessibility controls.
 * Fully keyboard accessible, screen-reader friendly, RTL/LTR aware.
 * @module components/accessibility-widget
 */
class AccessibilityWidget {
  constructor(options = {}) {
    this.buttonId = options.buttonId || 'accBtn';
    this.panelId = options.panelId || 'accPanel';
    this.labelId = options.labelId || 'accBtnLabel';
    this.i18n = options.i18n || window.__i18n;
    this.A = options.accessibility || window.Accessibility;

    this.button = null;
    this.panel = null;
    this.label = null;
    this.isOpen = false;
    this.init();
  }

  init() {
    this.button = document.getElementById(this.buttonId);
    this.panel = document.getElementById(this.panelId);
    this.label = document.getElementById(this.labelId);

    if (!this.button || !this.panel || !this.label) {
      console.warn('AccessibilityWidget: Required elements not found');
      return;
    }

    this.setupButton();
    this.setupPanel();
    this.setupEventListeners();
    this.updateLabels();
  }

  setupButton() {
    this.button.setAttribute('type', 'button');
    this.button.setAttribute('aria-haspopup', 'dialog');
    this.button.setAttribute('aria-expanded', 'false');
    this.button.setAttribute('aria-controls', this.panelId);
    this.button.setAttribute('aria-label', this.t('title'));

    this.button.addEventListener('click', (e) => {
      e.stopPropagation();
      this.toggle();
    });
    this.button.addEventListener('keydown', (e) => this.handleButtonKeydown(e));
  }

  setupPanel() {
    this.panel.setAttribute('role', 'dialog');
    this.panel.setAttribute('aria-modal', 'false');
    this.panel.setAttribute('aria-label', this.t('title'));
    this.panel.hidden = true;

    const focusable =
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

    this.panel.addEventListener('keydown', (e) => this.handlePanelKeydown(e, focusable));
  }

  setupEventListeners() {
    document.addEventListener('click', (e) => {
      if (this.isOpen && !this.button.contains(e.target) && !this.panel.contains(e.target)) {
        this.close();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
        this.button.focus();
      }
    });

    if (this.i18n && this.i18n.onLocaleChange) {
      this.i18n.onLocaleChange(() => this.updateLabels());
    }
    if (this.A && this.A.onChange) {
      this.A.onChange(() => this.updateLabels());
    }
  }

  t(key) {
    if (this.i18n && this.i18n.tAccessibility) {
      return this.i18n.tAccessibility(key);
    }
    return key;
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }

  open() {
    this.isOpen = true;
    this.panel.hidden = false;
    this.panel.classList.add('open');
    this.button.setAttribute('aria-expanded', 'true');
    this.announce(this.t('title') + ' ' + this.t('opened'));
    setTimeout(() => {
      const first = this.panel.querySelector(
        'button:not([disabled]), [href], input, select, textarea'
      );
      if (first) first.focus();
    }, 0);
  }

  close() {
    this.isOpen = false;
    this.panel.hidden = true;
    this.panel.classList.remove('open');
    this.button.setAttribute('aria-expanded', 'false');
  }

  updateLabels() {
    if (this.label) this.label.textContent = this.t('title');
    if (this.button) this.button.setAttribute('aria-label', this.t('title'));
  }

  announce(message) {
    const el = document.createElement('div');
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.setAttribute('aria-atomic', 'true');
    el.style.cssText = 'position:absolute;left:-9999px;width:1px;height:1px;overflow:hidden;';
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }

  handleButtonKeydown(e) {
    switch (e.key) {
      case 'Enter':
      case ' ':
        e.preventDefault();
        this.toggle();
        break;
      case 'ArrowDown':
      case 'ArrowUp':
        e.preventDefault();
        this.open();
        break;
    }
  }

  handlePanelKeydown(e, focusable) {
    if (e.key === 'Escape') {
      e.preventDefault();
      this.close();
      this.button.focus();
      return;
    }
    if (e.key !== 'Tab') return;
    const items = this.panel.querySelectorAll(focusable);
    if (items.length === 0) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else {
      if (document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('accBtn') && document.getElementById('accPanel')) {
    window.accessibilityWidget = new AccessibilityWidget({ i18n: window.__i18n });
  }
});

export { AccessibilityWidget };
export default AccessibilityWidget;