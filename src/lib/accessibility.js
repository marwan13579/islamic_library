/**
 * Accessibility Manager - Centralized accessibility features
 * Handles: font scaling, contrast modes, reduced motion, reading mode, simple mode, etc.
 * @module lib/accessibility
 */

const STORAGE_KEY = 'accessibility-prefs';

const DEFAULT_PREFS = {
  // Visual
  fontSize: 'normal',        // normal, large, extraLarge, huge
  lineHeight: 'normal',      // normal, relaxed, loose
  letterSpacing: 'normal',   // normal, wide, wider
  contrast: 'normal',        // normal, high, maximum, inverted
  colorBlind: 'none',        // none, protanopia, deuteranopia, tritanopia, achromatopsia
  dyslexiaFont: false,
  readingGuide: false,
  
  // Motion
  reduceMotion: false,
  respectSystemMotion: true,
  pauseAnimations: false,
  
  // Reading
  readingMode: 'auto',       // auto, sepia, dark, light
  simpleMode: false,
  
  // Screen Reader
  screenReaderOptimized: false,
  announcements: true,
  liveRegions: true,
  
  // Keyboard
  focusVisible: true,
  skipLinks: true,
  
  // Audio/Video
  captions: true,
  transcripts: true,
  autoPlay: false,
  
  // Persistence
  autoSave: true,
  sync: false
};

let currentPrefs = { ...DEFAULT_PREFS };
let listeners = new Set();

function readPrefs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      currentPrefs = { ...DEFAULT_PREFS, ...saved };
    }
  } catch (e) {
    console.warn('Failed to read accessibility prefs:', e);
  }
  return currentPrefs;
}

function writePrefs() {
  try {
    if (currentPrefs.autoSave) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentPrefs));
    }
  } catch (e) {
    console.warn('Failed to write accessibility prefs:', e);
  }
}

function applyPrefs() {
  const html = document.documentElement;
  if (!html) return;

  const kebab = (value) => String(value).replace(/([A-Z])/g, "-$1").toLowerCase();

  // Font size
  html.classList.remove('font-normal', 'font-large', 'font-extra-large', 'font-huge');
  html.classList.add(`font-${kebab(currentPrefs.fontSize)}`);
  
  // Line height
  html.classList.remove('leading-normal', 'leading-relaxed', 'leading-loose');
  html.classList.add(`leading-${currentPrefs.lineHeight}`);
  
  // Letter spacing
  html.classList.remove('tracking-normal', 'tracking-wide', 'tracking-wider');
  html.classList.add(`tracking-${currentPrefs.letterSpacing}`);
  
  // Contrast
  html.classList.remove('contrast-normal', 'contrast-high', 'contrast-maximum', 'contrast-inverted');
  html.classList.add(`contrast-${currentPrefs.contrast}`);
  
  // Color blind
  html.classList.remove('cb-protanopia', 'cb-deuteranopia', 'cb-tritanopia', 'cb-achromatopsia');
  if (currentPrefs.colorBlind !== 'none') {
    html.classList.add(`cb-${currentPrefs.colorBlind}`);
  }
  
  // Dyslexia font
  html.classList.toggle('dyslexia-font', currentPrefs.dyslexiaFont);
  
  // Reading guide
  html.classList.toggle('reading-guide', currentPrefs.readingGuide);
  
  // Reduced motion
  html.classList.toggle('reduce-motion', currentPrefs.reduceMotion);
  html.classList.toggle('pause-animations', currentPrefs.pauseAnimations);
  
  // Reading mode
  html.classList.remove('reading-sepia', 'reading-dark', 'reading-light');
  if (currentPrefs.readingMode !== 'auto') {
    html.classList.add(`reading-${currentPrefs.readingMode}`);
    html.setAttribute('data-theme', 'reading');
  } else {
    html.removeAttribute('data-theme');
  }
  
  // Simple mode
  html.classList.toggle('simple-mode', currentPrefs.simpleMode);
  
  // Focus visible
  html.classList.toggle('focus-visible', currentPrefs.focusVisible);
  
  // Skip links
  const skipLinks = document.querySelectorAll('.skip-link');
  skipLinks.forEach(link => {
    link.style.display = currentPrefs.skipLinks ? 'block' : 'none';
  });
  
  // Update CSS custom properties for dynamic scaling
  updateCSSVariables();
  
  // Dispatch event for listeners
  dispatchChange();
}

function updateCSSVariables() {
  const root = document.documentElement;
  const baseSize = 16;
  
  const sizeMultipliers = {
    normal: 1,
    large: 1.25,
    extraLarge: 1.5,
    huge: 2
  };
  
  const lineHeightValues = {
    normal: 1.6,
    relaxed: 1.8,
    loose: 2
  };
  
  const letterSpacingValues = {
    normal: '0',
    wide: '0.05em',
    wider: '0.1em'
  };
  
  const multiplier = sizeMultipliers[currentPrefs.fontSize] || 1;
  root.style.setProperty('--accessibility-font-multiplier', multiplier);
  root.style.setProperty('--accessibility-line-height', lineHeightValues[currentPrefs.lineHeight] || 1.6);
  root.style.setProperty('--accessibility-letter-spacing', letterSpacingValues[currentPrefs.letterSpacing] || '0');
  
  // High contrast color overrides
  if (currentPrefs.contrast === 'high' || currentPrefs.contrast === 'maximum') {
    root.style.setProperty('--ink', '#000000');
    root.style.setProperty('--paper', '#ffffff');
    root.style.setProperty('--gold', '#000000');
    root.style.setProperty('--line', '#000000');
  } else if (currentPrefs.contrast === 'inverted') {
    root.style.setProperty('--ink', '#ffffff');
    root.style.setProperty('--paper', '#000000');
    root.style.setProperty('--gold', '#ffff00');
    root.style.setProperty('--line', '#ffffff');
  }
}

function dispatchChange() {
  const event = new CustomEvent('accessibility-change', { 
    detail: { prefs: currentPrefs } 
  });
  window.dispatchEvent(event);
  
  listeners.forEach(callback => {
    try {
      callback(currentPrefs);
    } catch (e) {
      console.warn('Accessibility listener error:', e);
    }
  });
}

export const Accessibility = {
  init() {
    readPrefs();
    applyPrefs();
    
    // Listen for system preference changes
    if (window.matchMedia) {
      const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      motionQuery.addEventListener('change', (e) => {
        if (currentPrefs.respectSystemMotion) {
          this.setPref('reduceMotion', e.matches);
        }
      });
      
      // Initial check
      if (currentPrefs.respectSystemMotion && motionQuery.matches) {
        currentPrefs.reduceMotion = true;
        applyPrefs();
      }
    }
    
    // Add skip link if not present
    this.ensureSkipLink();
    
    return currentPrefs;
  },
  
  getPrefs() {
    return { ...currentPrefs };
  },
  
  getPref(key) {
    return currentPrefs[key];
  },
  
  setPref(key, value) {
    if (!(key in DEFAULT_PREFS)) {
      console.warn(`Unknown accessibility preference: ${key}`);
      return false;
    }
    
    currentPrefs[key] = value;
    writePrefs();
    applyPrefs();
    return true;
  },
  
  setPrefs(newPrefs) {
    Object.entries(newPrefs).forEach(([key, value]) => {
      if (key in DEFAULT_PREFS) {
        currentPrefs[key] = value;
      }
    });
    writePrefs();
    applyPrefs();
  },
  
  reset() {
    currentPrefs = { ...DEFAULT_PREFS };
    writePrefs();
    applyPrefs();
  },
  
  onChange(callback) {
    listeners.add(callback);
    return () => listeners.delete(callback);
  },
  
  // Font size helpers
  increaseFontSize() {
    const sizes = ['normal', 'large', 'extraLarge', 'huge'];
    const currentIndex = sizes.indexOf(currentPrefs.fontSize);
    if (currentIndex < sizes.length - 1) {
      this.setPref('fontSize', sizes[currentIndex + 1]);
    }
  },
  
  decreaseFontSize() {
    const sizes = ['normal', 'large', 'extraLarge', 'huge'];
    const currentIndex = sizes.indexOf(currentPrefs.fontSize);
    if (currentIndex > 0) {
      this.setPref('fontSize', sizes[currentIndex - 1]);
    }
  },
  
  resetFontSize() {
    this.setPref('fontSize', 'normal');
  },
  
  // Contrast helpers
  toggleHighContrast() {
    const modes = ['normal', 'high', 'maximum', 'inverted'];
    const currentIndex = modes.indexOf(currentPrefs.contrast);
    this.setPref('contrast', modes[(currentIndex + 1) % modes.length]);
  },
  
  // Simple mode toggle
  toggleSimpleMode() {
    this.setPref('simpleMode', !currentPrefs.simpleMode);
  },
  
  // Reading mode
  setReadingMode(mode) {
    const validModes = ['auto', 'sepia', 'dark', 'light'];
    if (validModes.includes(mode)) {
      this.setPref('readingMode', mode);
    }
  },
  
  // Reduced motion
  toggleReduceMotion() {
    this.setPref('reduceMotion', !currentPrefs.reduceMotion);
  },
  
  // Dyslexia font
  toggleDyslexiaFont() {
    this.setPref('dyslexiaFont', !currentPrefs.dyslexiaFont);
  },
  
  // Color blind
  setColorBlindMode(mode) {
    const validModes = ['none', 'protanopia', 'deuteranopia', 'tritanopia', 'achromatopsia'];
    if (validModes.includes(mode)) {
      this.setPref('colorBlind', mode);
    }
  },
  
  // Reading guide
  toggleReadingGuide() {
    this.setPref('readingGuide', !currentPrefs.readingGuide);
  },
  
  // Auto-play
  toggleAutoPlay() {
    this.setPref('autoPlay', !currentPrefs.autoPlay);
  },
  
  // Captions
  toggleCaptions() {
    this.setPref('captions', !currentPrefs.captions);
  },
  
  // Focus visible
  toggleFocusVisible() {
    this.setPref('focusVisible', !currentPrefs.focusVisible);
  },
  
  // Skip links
  toggleSkipLinks() {
    this.setPref('skipLinks', !currentPrefs.skipLinks);
  },
  
  // Ensure skip link exists
  ensureSkipLink() {
    if (!document.querySelector('.skip-link')) {
      const skipLink = document.createElement('a');
      skipLink.href = '#mainContent';
      skipLink.className = 'skip-link';
      skipLink.textContent = 'Skip to main content';
      skipLink.style.cssText = `
        position: absolute;
        top: -100%;
        left: 50%;
        transform: translateX(-50%);
        background: var(--ink);
        color: var(--paper);
        padding: 12px 24px;
        border-radius: 0 0 8px 8px;
        z-index: 10000;
        text-decoration: none;
        font-weight: 600;
        transition: top 0.2s;
      `;
      skipLink.addEventListener('focus', () => {
        skipLink.style.top = '0';
      });
      skipLink.addEventListener('blur', () => {
        skipLink.style.top = '-100%';
      });
      document.body.insertBefore(skipLink, document.body.firstChild);
    }
  },
  
  // Announce to screen readers
  announce(message, priority = 'polite') {
    const announcement = document.createElement('div');
    announcement.setAttribute('role', 'status');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.style.cssText = 'position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden;';
    announcement.textContent = message;
    document.body.appendChild(announcement);
    setTimeout(() => announcement.remove(), 1000);
  },
  
  // Get current effective font size in px
  getEffectiveFontSize() {
    const baseSize = 16;
    const multipliers = { normal: 1, large: 1.25, extraLarge: 1.5, huge: 2 };
    return baseSize * (multipliers[currentPrefs.fontSize] || 1);
  },
  
  // Check if high contrast is active
  isHighContrast() {
    return ['high', 'maximum', 'inverted'].includes(currentPrefs.contrast);
  },
  
  // Check if reduced motion is active
  isReduceMotion() {
    return currentPrefs.reduceMotion || currentPrefs.pauseAnimations;
  },
  
  // Export preferences
  exportPrefs() {
    return JSON.stringify(currentPrefs, null, 2);
  },
  
  // Import preferences
  importPrefs(jsonString) {
    try {
      const imported = JSON.parse(jsonString);
      this.setPrefs(imported);
      return true;
    } catch (e) {
      console.error('Failed to import accessibility prefs:', e);
      return false;
    }
  }
};

// Auto-initialize
if (typeof window !== 'undefined') {
  window.Accessibility = Accessibility;
  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => Accessibility.init());
  } else {
    Accessibility.init();
  }
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Accessibility;
}