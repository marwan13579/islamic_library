/**
 * Main entry point for Islamic Encyclopedia page
 * Initializes all components and loads dynamic content
 * @module app/encyclopedia-main
 */

import { initEncyclopediaNav } from '../components/encyclopedia-nav.js';
import { initSearchBox } from '../components/search-box.js';
import { createContentGrid } from '../components/content-card.js';
import { initBreadcrumbs, generateBreadcrumbsFromUrl } from '../components/breadcrumbs.js';
import { initFavoritesButtons } from '../components/favorites-btn.js';
import { initExportImport, openExportImport } from '../components/export-import.js';
import { favoritesManager } from '../lib/favorites-manager.js';
import { progressTracker } from '../lib/progress-tracker.js';
import { getRelatedContent } from '../lib/content-relationships.js';
import { searchAll, quickSearch, getSmartSuggestions } from '../lib/unified-search.js';
import { registerDataSources } from '../lib/search-content.js';
import { escapeHtml, toArNum } from '../lib/text.js';
import { showToast } from '../components/toast.js';

// Initialize components
document.addEventListener('DOMContentLoaded', async () => {
  // Initialize navigation
  const navContainer = document.getElementById('encyclopediaNavContainer');
  if (navContainer) {
    initEncyclopediaNav(navContainer);
  }

  // Initialize breadcrumbs
  const breadcrumbsContainer = document.getElementById('breadcrumbsContainer');
  if (breadcrumbsContainer) {
    const breadcrumbs = generateBreadcrumbsFromUrl();
    initBreadcrumbs(breadcrumbsContainer, breadcrumbs);
  }

  // Initialize search box
  const searchContainer = document.getElementById('mainSearchBox');
  if (searchContainer) {
    initSearchBox(searchContainer, {
      placeholder: 'ابحث في الموسوعة الإسلامية... (قرآن، حديث، فقه، سيرة، أذكار، تاريخ، مكتبة، أدوات...)',
      ariaLabel: 'البحث الشامل في الموسوعة الإسلامية',
      showSuggestions: true,
      onSearch: handleSearch,
      onSuggestionClick: handleSuggestionClick
    });
  }

  // Initialize favorites buttons
  initFavoritesButtons();

  // Initialize export/import modal
  const exportImportContainer = document.getElementById('exportImportContainer');
  if (exportImportContainer) {
    initExportImport(exportImportContainer);
  }

  // Export/Import button handler
  const exportImportBtn = document.getElementById('exportImportBtn');
  if (exportImportBtn) {
    exportImportBtn.addEventListener('click', () => {
      openExportImport();
    });
  }

  // Load daily content
  await loadDailyContent();

  // Load quick access grid
  loadQuickAccess();

  // Load featured content
  await loadFeaturedContent();

  // Load smart suggestions
  await loadSmartSuggestions();

  // Register search sources
  await registerDataSources();
});

// Handle search
async function handleSearch(query) {
  if (!query.trim()) return;
  const url = new URL('encyclopedia.html', window.location.origin);
  url.searchParams.set('q', query);
  window.location.href = url.toString();
}

// Handle suggestion click
function handleSuggestionClick(item) {
  if (item.route) {
    window.location.href = item.route;
  }
}

// Load daily content (Quran verse, Hadith, Dhikr, Prayer times)
async function loadDailyContent() {
  try {
    // Load daily verse
    const { DAILY_VERSES } = await import('../data/daily.js');
    const today = new Date();
    const dayOfYear = Math.floor((today - new Date(today.getFullYear(), 0, 0)) / 86400000);
    const verseIndex = dayOfYear % (DAILY_VERSES?.length || 1);
    const verse = DAILY_VERSES?.[verseIndex];
    
    const quranEl = document.getElementById('dailyQuranContent');
    if (quranEl && verse) {
      quranEl.innerHTML = `
        <blockquote class="daily-ayah">${escapeHtml(verse.ayah || verse.text || '')}</blockquote>
        <cite class="daily-ref">${escapeHtml(verse.ref || verse.reference || '')}</cite>
      `;
    }

    // Load daily hadith
    const { DAILY_HADITHS } = await import('../data/daily.js');
    const hadithIndex = dayOfYear % (DAILY_HADITHS?.length || 1);
    const hadith = DAILY_HADITHS?.[hadithIndex];
    
    const hadithEl = document.getElementById('dailyHadithContent');
    if (hadithEl && hadith) {
      hadithEl.innerHTML = `
        <blockquote class="daily-hadith-text">${escapeHtml(hadith.text || '')}</blockquote>
        <cite class="daily-ref">${escapeHtml(hadith.src || hadith.ref || '')}</cite>
      `;
    }

    // Load daily dhikr
    const { ADHKAR } = await import('../data/adhkar.js');
    const morningGroup = ADHKAR?.morning?.array?.[0] || ADHKAR?.sabah?.array?.[0];
    const dhikrEl = document.getElementById('dailyDhikrContent');
    if (dhikrEl && morningGroup) {
      dhikrEl.innerHTML = `
        <blockquote class="daily-dhikr-text">${escapeHtml(morningGroup.adhkar || morningGroup.text || '')}</blockquote>
        <cite class="daily-ref">${escapeHtml(morningGroup.description || morningGroup.source || '')}</cite>
      `;
    }

    // Load prayer times (if cached)
    const prayerEl = document.getElementById('dailyPrayerContent');
    if (prayerEl) {
      const timings = read('prayer_timings', null);
      if (timings) {
        const next = getNextPrayer(timings);
        if (next) {
          prayerEl.innerHTML = `
            <div class="next-prayer">
              <span class="next-prayer-name">${next.name}</span>
              <span class="next-prayer-time">${toArNum(next.time)}</span>
              <span class="next-prayer-countdown">${next.countdown}</span>
            </div>
          `;
        } else {
          prayerEl.innerHTML = '<p class="daily-prayer-times">اضغط لعرض المواقيت الكاملة</p>';
        }
      } else {
        prayerEl.innerHTML = '<p class="daily-prayer-times">اختر مدينتك لعرض المواقيت</p>';
      }
    }
  } catch (e) {
    console.warn('Failed to load daily content:', e);
  }
}

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function getNextPrayer(timings) {
  const order = ['Fajr', 'Dhuhr', 'Asr', 'Maghrib', 'Isha'];
  const names = { Fajr: 'الفجر', Dhuhr: 'الظهر', Asr: 'العصر', Maghrib: 'المغرب', Isha: 'العشاء' };
  const now = new Date();
  const minutesNow = now.getHours() * 60 + now.getMinutes();
  
  for (const key of order) {
    const timeStr = timings[key];
    if (!timeStr) continue;
    const match = timeStr.match(/(\d{1,2}):(\d{2})/);
    if (!match) continue;
    const hour = parseInt(match[1], 10);
    const minute = parseInt(match[2], 10);
    const prayerMinutes = hour * 60 + minute;
    
    if (prayerMinutes > minutesNow) {
      const diff = prayerMinutes - minutesNow;
      const hours = Math.floor(diff / 60);
      const mins = diff % 60;
      let countdown = '';
      if (hours > 0) countdown += `${toArNum(hours)} ساعة `;
      countdown += `${toArNum(mins)} دقيقة`;
      
      return {
        name: names[key],
        time: timeStr,
        countdown
      };
    }
  }
  return null;
}

// Load quick access grid
function loadQuickAccess() {
  const container = document.getElementById('quickAccessGrid');
  if (!container) return;

  const quickItems = [
    { id: 'quran', type: 'quran', category: 'قرآن', icon: '📖', title: 'القرآن الكريم', route: 'encyclopedia/quran/', description: 'مصحف، بحث، تلاوة، تفسير، ختمة' },
    { id: 'hadith', type: 'hadith', category: 'حديث', icon: '📜', title: 'الحديث الشريف', route: 'encyclopedia/hadith/', description: 'الكتب الستة، بحث، شرح، درجات' },
    { id: 'tafsir', type: 'tafsir', category: 'تفسير', icon: '📚', title: 'التفسير وعلوم القرآن', route: 'encyclopedia/tafsir/', description: 'تفسير، أسباب نزول، غريب، ناسخ' },
    { id: 'fiqh', type: 'fiqh', category: 'فقه', icon: '⚖️', title: 'الفقه الإسلامي', route: 'encyclopedia/fiqh/', description: 'طهارة، صلاة، زكاة، صيام، حج، معاملات' },
    { id: 'seerah', type: 'seerah', category: 'سيرة', icon: '🌙', title: 'السيرة النبوية', route: 'encyclopedia/seerah/', description: 'خط زمني، غزوات، أحداث، دروس' },
    { id: 'adhkar', type: 'dhikr', category: 'أذكار', icon: '🤲', title: 'الأذكار والأدعية', route: 'encyclopedia/adhkar/', description: 'صباح، مساء، نوم، مناسبات، عداد' },
    { id: 'history', type: 'history', category: 'تاريخ', icon: '📜', title: 'التاريخ الإسلامي', route: 'encyclopedia/history/', description: 'عصور، علماء، مدن، أحداث، حضارة' },
    { id: 'library', type: 'book', category: 'مكتبة', icon: '📚', title: 'المكتبة الإسلامية', route: 'encyclopedia/library/', description: 'كتب، مقالات، فتاوى، خطب، اختبارات' },
    { id: 'tools', type: 'tool', category: 'أدوات', icon: '🧰', title: 'الأدوات الإسلامية', route: 'encyclopedia/tools/', description: 'مواقيت، قبلة، زكاة، مسبحة، تقويم' },
  ];

  const grid = createContentGrid(quickItems, {
    variant: 'default',
    containerClass: 'quick-grid',
    showActions: true,
    onFavorite: async (id, added) => {
      const item = quickItems.find(i => i.id === id);
      if (item) {
        if (added) {
          await favoritesManager.addFavorite(item);
        } else {
          await favoritesManager.removeFavorite(id, item.type);
        }
      }
    }
  });
  
  container.appendChild(grid);
}

// Load featured content
async function loadFeaturedContent() {
  const container = document.getElementById('featuredGrid');
  if (!container) return;

  try {
    // Get some featured items from search
    const results = await searchAll('قرآن', { limit: 6, category: 'قرآن' });
    const featured = results.results.slice(0, 6);
    
    if (featured.length) {
      const grid = createContentGrid(featured.map(f => ({
        id: f.id,
        type: f.type,
        category: f.category,
        icon: f.icon,
        title: f.title,
        description: f.description,
        route: f.route
      })), {
        variant: 'compact',
        containerClass: 'featured-grid',
        showActions: true
      });
      container.appendChild(grid);
    }
  } catch (e) {
    console.warn('Failed to load featured content:', e);
  }
}

// Load smart suggestions
async function loadSmartSuggestions() {
  const section = document.querySelector('.suggestions-section');
  const container = document.getElementById('suggestionsGrid');
  if (!section || !container) return;

  try {
    const suggestions = await getSmartSuggestions();
    if (suggestions.length) {
      const grid = createContentGrid(suggestions.slice(0, 4).map(s => ({
        id: s.id,
        type: s.type,
        category: s.category,
        icon: s.icon,
        title: s.title,
        description: s.description,
        route: s.route
      })), {
        variant: 'compact',
        containerClass: 'suggestions-grid',
        showActions: false
      });
      container.appendChild(grid);
      section.hidden = false;
    }
  } catch (e) {
    console.warn('Failed to load suggestions:', e);
  }
}

// Export for global access
window.encyclopediaApp = {
  handleSearch,
  handleSuggestionClick,
  favoritesManager,
  progressTracker
};