/**
 * Navigation component for Islamic Encyclopedia
 * RTL, accessible, mobile-responsive
 * @module components/encyclopedia-nav
 */

export function createEncyclopediaNav() {
  const nav = document.createElement('nav');
  nav.id = 'encyclopediaNav';
  nav.className = 'encyclopedia-nav';
  nav.setAttribute('role', 'navigation');
  nav.setAttribute('aria-label', 'تنقل الموسوعة الإسلامية');

  const categories = [
    { id: 'quran', label: '📖 القرآن الكريم', href: 'encyclopedia/quran/', icon: '📖' },
    { id: 'hadith', label: '📜 الحديث الشريف', href: 'encyclopedia/hadith/', icon: '📜' },
    { id: 'tafsir', label: '📚 التفسير وعلوم القرآن', href: 'encyclopedia/tafsir/', icon: '📚' },
    { id: 'aqeedah', label: '🕌 العقيدة والتوحيد', href: 'encyclopedia/aqeedah/', icon: '🕌' },
    { id: 'fiqh', label: '⚖️ الفقه الإسلامي', href: 'encyclopedia/fiqh/', icon: '⚖️' },
    { id: 'seerah', label: '🌙 السيرة النبوية', href: 'encyclopedia/seerah/', icon: '🌙' },
    { id: 'prophets', label: '👤 الأنبياء', href: 'encyclopedia/prophets/', icon: '👤' },
    { id: 'companions', label: '🌿 الصحابة', href: 'encyclopedia/companions/', icon: '🌿' },
    { id: 'adhkar', label: '🤲 الأذكار والأدعية', href: 'encyclopedia/adhkar/', icon: '🤲' },
    { id: 'akhlaq', label: '❤️ الأخلاق والآداب', href: 'encyclopedia/akhlaq/', icon: '❤️' },
    { id: 'ibadat', label: '🕋 العبادات', href: 'encyclopedia/ibadat/', icon: '🕋' },
    { id: 'occasions', label: '📅 المناسبات والمواسم', href: 'encyclopedia/occasions/', icon: '📅' },
    { id: 'history', label: '📜 التاريخ الإسلامي', href: 'encyclopedia/history/', icon: '📜' },
    { id: 'library', label: '📚 المكتبة الإسلامية', href: 'encyclopedia/library/', icon: '📚' },
    { id: 'lessons', label: '🎙️ الدروس والمحاضرات', href: 'encyclopedia/lessons/', icon: '🎙️' },
    { id: 'media', label: '📻 القنوات والإذاعات', href: 'encyclopedia/media/', icon: '📻' },
    { id: 'tools', label: '🧰 الأدوات الإسلامية', href: 'encyclopedia/tools/', icon: '🧰' },
    { id: 'search', label: '🔎 البحث الشامل', href: '?search=1', icon: '🔎' },
  ];

  const isMobile = window.innerWidth < 768;

  if (isMobile) {
    // Mobile: accordion-style
    nav.innerHTML = `
      <button class="nav-toggle" aria-expanded="false" aria-controls="navMenu" aria-label="فتح قائمة الموسوعة">
        <span class="nav-toggle-icon">📚</span>
        <span class="nav-toggle-text">الموسوعة الإسلامية</span>
        <span class="nav-toggle-chevron">▾</span>
      </button>
      <div id="navMenu" class="nav-menu" hidden>
        <ul class="nav-list" role="list">
          ${categories.map(cat => `
            <li><a href="${cat.href}" class="nav-link" data-category="${cat.id}">${cat.icon} ${cat.label}</a></li>
          `).join('')}
        </ul>
      </div>
    `;

    const toggle = nav.querySelector('.nav-toggle');
    const menu = nav.querySelector('#navMenu');
    toggle.addEventListener('click', () => {
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      menu.hidden = expanded;
    });

    // Close on link click
    nav.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        toggle.setAttribute('aria-expanded', 'false');
        menu.hidden = true;
      });
    });
  } else {
    // Desktop: horizontal scrollable
    nav.innerHTML = `
      <div class="nav-header">
        <span class="nav-title">📚 الموسوعة الإسلامية</span>
      </div>
      <div class="nav-scroller" role="listbox" aria-label="أقسام الموسوعة">
        ${categories.map(cat => `
          <a href="${cat.href}" class="nav-item" role="option" data-category="${cat.id}">
            <span class="nav-item-icon">${cat.icon}</span>
            <span class="nav-item-label">${cat.label.replace(/^[\s\S]*?\s/, '')}</span>
          </a>
        `).join('')}
      </div>
    `;
  }

  return nav;
}

export function initEncyclopediaNav(container) {
  const nav = createEncyclopediaNav();
  container.appendChild(nav);
  return nav;
}

// Auto-initialize if container exists
document.addEventListener('DOMContentLoaded', () => {
  const container = document.getElementById('encyclopediaNavContainer') || document.querySelector('[data-encyclopedia-nav]');
  if (container) initEncyclopediaNav(container);
});