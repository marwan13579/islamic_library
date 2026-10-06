/**
 * Search Box Component - Main search input for the encyclopedia
 * RTL, accessible, with autocomplete suggestions
 * @module components/search-box
 */

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

export function createSearchBox(options = {}) {
  const {
    placeholder = 'ابحث...',
    ariaLabel = 'بحث',
    showSuggestions = false,
    suggestions = [],
    onSearch = null,
    onSuggestionClick = null
  } = options;

  const wrapper = document.createElement('div');
  wrapper.className = 'search-box';
  wrapper.setAttribute('dir', 'rtl');

  wrapper.innerHTML = `
    <div class="search-input-wrapper">
      <input type="search"
             class="main-search-box"
             placeholder="${escapeHtml(placeholder)}"
             aria-label="${escapeHtml(ariaLabel)}"
             autocomplete="off"
             spellcheck="false"
             dir="rtl">
      <button type="button" class="search-clear" aria-label="مسح البحث" hidden>×</button>
    </div>
    ${showSuggestions ? `<div class="search-suggestions" hidden></div>` : ''}
  `;

  const input = wrapper.querySelector('input');
  const clearBtn = wrapper.querySelector('.search-clear');
  const suggestionsEl = wrapper.querySelector('.search-suggestions');

  let currentSuggestions = suggestions;
  let highlightedIndex = -1;

  function renderSuggestions(items) {
    if (!showSuggestions || !items || !items.length) {
      if (suggestionsEl) suggestionsEl.hidden = true;
      return;
    }
    if (suggestionsEl) {
      suggestionsEl.hidden = false;
      suggestionsEl.innerHTML = items.map((item, i) => `
        <button type="button" class="suggestion-item" data-index="${i}" aria-label="${escapeHtml(item.title || '')}">
          <span class="suggestion-icon">${item.icon || '🔍'}</span>
          <span class="suggestion-text">${escapeHtml(item.title || item.text || '')}</span>
        </button>
      `).join('');
      highlightItem(0);
    }
  }

  function highlightItem(index) {
    highlightedIndex = index;
    const items = suggestionsEl?.querySelectorAll('.suggestion-item') || [];
    items.forEach((item, i) => {
      item.classList.toggle('highlighted', i === index);
    });
  }

  input.addEventListener('input', () => {
    const value = input.value.trim();
    clearBtn.hidden = !value;
    if (onSearch) { onSearch(value); }
    if (showSuggestions && value) {
      const filtered = currentSuggestions.filter(s =>
        (s.title || '').toLowerCase().includes(value.toLowerCase())
      );
      renderSuggestions(filtered);
    }
  });

  input.addEventListener('keydown', (e) => {
    if (!showSuggestions || !suggestionsEl || suggestionsEl.hidden) {
      if (e.key === 'Enter' && onSearch && input.value.trim()) {
        onSearch(input.value.trim());
      }
      return;
    }
    const items = suggestionsEl.querySelectorAll('.suggestion-item');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (highlightedIndex + 1) % items.length;
      highlightItem(next);
      items[next]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (highlightedIndex - 1 + items.length) % items.length;
      highlightItem(prev);
      items[prev]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = items[highlightedIndex];
      if (selected) {
        selected.click();
      } else if (onSearch && input.value.trim()) {
        onSearch(input.value.trim());
      }
    } else if (e.key === 'Escape') {
      suggestionsEl.hidden = true;
      highlightedIndex = -1;
    }
  });

  if (showSuggestions && suggestionsEl) {
    suggestionsEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.suggestion-item');
      if (!btn) return;
      const index = parseInt(btn.dataset.index, 10);
      const item = currentSuggestions.filter(s =>
        (s.title || '').toLowerCase().includes(input.value.trim().toLowerCase())
      )[index];
      if (item && onSuggestionClick) { onSuggestionClick(item); }
      suggestionsEl.hidden = true;
    });

    suggestionsEl.addEventListener('mousemove', (e) => {
      const btn = e.target.closest('.suggestion-item');
      if (!btn) return;
      const index = parseInt(btn.dataset.index, 10);
      highlightItem(index);
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.hidden = true;
      if (suggestionsEl) suggestionsEl.hidden = true;
      input.focus();
    });
  }

  if (currentSuggestions.length) { renderSuggestions(currentSuggestions); }

  return wrapper;
}

export function initSearchBox(container, options = {}) {
  const box = createSearchBox(options);
  container.appendChild(box);
  return box;
}
