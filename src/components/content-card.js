/**
 * Content Card Component - Unified card for all encyclopedia content
 * RTL, accessible, consistent styling
 * @module components/content-card
 */

function getDefaultIcon(type) {
  const icons = {
    quran: '📖', ayah: '📖', surah: '📖', verse: '📖',
    hadith: '📜', tafsir: '📚', aqeedah: '🕌', fiqh: '⚖️',
    seerah: '🌙', prophet: '👤', companion: '🌿', dhikr: '🤲',
    dua: '🤲', akhlaq: '❤️', ibadat: '🕋', occasion: '📅',
    history: '📜', book: '📚', article: '📄', lesson: '🎙️',
    video: '🎬', radio: '📻', tool: '🧰', page: '📄',
    scholar: '👤', name: 'ﷲ', saying: '❝', question: '❓',
    channel: '🎬', station: '📻', city: '🏙️', event: '🌙',
    section: '🧭', word: '🪔', quiz: '🧠', fatwa: '⚖️',
    khutbah: '🗣️', hisn: '🛡️', siraj: '🪔', reciter: '🎙️',
    kids: '🧒', manhaj: '📖', qa: '❓', zakat: '🧮',
    inheritance: '⚖️', hajj: '🕋', prayer: '🕐', qibla: '🧭',
    hijri: '🌙', tasbih: '📿', khatma: '📚', daily: '📅',
    noor: '🌿'
  };
  return icons[type] || '📄';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function toArNum(num) {
  const arabic = ['٠','١','٢','٣','٤','٥','٦','٧','٨','٩'];
  return String(num).replace(/[0-9]/g, d => arabic[+d]);
}

export function createContentGrid(items, options = {}) {
  const {
    variant = 'default',
    containerClass = 'content-grid',
    showActions = false,
    onFavorite = null,
    onItemClick = null
  } = options;

  const grid = document.createElement('div');
  grid.className = containerClass;
  grid.setAttribute('role', 'grid');

  if (!items || !items.length) {
    grid.innerHTML = '<p style="color:var(--ink-soft);text-align:center;padding:2rem">لا توجد محتويات متاحة حالياً</p>';
    return grid;
  }

  for (const item of items) {
    const card = document.createElement('a');
    card.className = `encyclopedia-card${variant === 'compact' ? ' compact' : ''}`;
    card.href = item.route || '#';
    card.setAttribute('role', 'link');
    card.setAttribute('aria-label', item.title || item.id);
    card.dataset.contentId = item.id || '';
    card.dataset.contentType = item.type || '';
    card.dataset.category = item.category || '';

    const icon = item.icon || getDefaultIcon(item.type);
    const title = item.title || item.id || '';
    const desc = item.description || '';
    const score = item.score;

    let actionsHtml = '';
    if (showActions && onFavorite && item.id) {
      actionsHtml = `
        <button class="card-action favorite-btn"
                data-fav-id="${item.id}" data-fav-type="${item.type || 'content'}"
                aria-label="إضافة للمفضلة" type="button">
          <span aria-hidden="true">★</span>
        </button>`;
    }

    card.innerHTML = `
      <div class="card-top">
        <span class="card-icon">${icon}</span>
        <span class="card-title">${escapeHtml(title)}</span>
        ${score !== undefined ? `<span class="card-score">${toArNum(score)}</span>` : ''}
      </div>
      ${desc ? `<p class="card-desc">${escapeHtml(desc)}</p>` : ''}
      ${item.category ? `<span class="card-category">${escapeHtml(item.category)}</span>` : ''}
      ${actionsHtml}
    `;

    if (onItemClick) {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.card-action')) { e.preventDefault(); e.stopPropagation(); return; }
        onItemClick(item);
      });
    }

    const favBtn = card.querySelector('.favorite-btn');
    if (favBtn && onFavorite) {
      favBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const id = e.currentTarget.dataset.favId;
        const type = e.currentTarget.dataset.favType;
        const nowFav = e.currentTarget.closest('.encyclopedia-card').classList.contains('is-favorite');
        try {
          await onFavorite(id, !nowFav);
          e.currentTarget.closest('.encyclopedia-card').classList.toggle('is-favorite', !nowFav);
        } catch (err) { console.error(err); }
      });
    }

    grid.appendChild(card);
  }

  return grid;
}
