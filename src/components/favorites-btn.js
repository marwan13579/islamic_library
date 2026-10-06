/**
 * Favorites Button Component - Add to favorites with local storage
 * RTL, accessible, works with unified favorites manager
 * @module components/favorites-btn
 */

import { favoritesManager } from '../lib/favorites-manager.js';

export function createFavoritesButton(contentId, options = {}) {
  const {
    type = 'content', // 'content' | 'tool' | 'verse' | 'hadith' | 'dhikr' | 'book'
    category = '',
    title = '',
    route = '',
    icon = '📄',
    showLabel = false,
    labelAdd = 'إضافة للمفضلة',
    labelRemove = 'إزالة من المفضلة',
    onChange
  } = options;

  const isFav = favoritesManager.isFavorite(contentId, type);
  
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = `favorites-btn${isFav ? ' is-favorite' : ''}`;
  btn.setAttribute('aria-label', isFav ? labelRemove : labelAdd);
  btn.setAttribute('aria-pressed', String(isFav));
  btn.setAttribute('data-content-id', contentId);
  btn.setAttribute('data-content-type', type);
  btn.innerHTML = `
    <span class="favorites-btn-icon" aria-hidden="true">${isFav ? '★' : '☆'}</span>
    ${showLabel ? `<span class="favorites-btn-label">${isFav ? 'محفوظ' : 'حفظ'}</span>` : ''}
  `;

  btn.addEventListener('click', async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    const newState = !btn.classList.contains('is-favorite');
    
    try {
      if (newState) {
        await favoritesManager.addFavorite({
          id: contentId,
          type,
          category,
          title,
          route,
          icon
        });
      } else {
        await favoritesManager.removeFavorite(contentId, type);
      }
      
      btn.classList.toggle('is-favorite', newState);
      btn.setAttribute('aria-label', newState ? labelRemove : labelAdd);
      btn.setAttribute('aria-pressed', String(newState));
      btn.querySelector('.favorites-btn-icon').textContent = newState ? '★' : '☆';
      if (showLabel) {
        btn.querySelector('.favorites-btn-label').textContent = newState ? 'محفوظ' : 'حفظ';
      }
      
      if (onChange) onChange(newState);
      
      // Show toast notification
      showToast(newState ? 'تمت الإضافة للمفضلة' : 'أُزيل من المفضلة');
    } catch (error) {
      console.error('Favorites error:', error);
      showToast('حدث خطأ، حاول مرة أخرى');
    }
  });

  return btn;
}

function showToast(message) {
  // Try to use existing toast system
  if (window.showToast) {
    window.showToast(message);
    return;
  }
  
  // Fallback toast
  const toast = document.createElement('div');
  toast.className = 'toast-fallback';
  toast.textContent = message;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  document.body.appendChild(toast);
  
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

// Initialize all favorites buttons on page
export function initFavoritesButtons() {
  document.querySelectorAll('[data-favorite-id]').forEach(el => {
    const contentId = el.dataset.favoriteId;
    const type = el.dataset.favoriteType || 'content';
    const category = el.dataset.favoriteCategory || '';
    const title = el.dataset.favoriteTitle || '';
    const route = el.dataset.favoriteRoute || '';
    const icon = el.dataset.favoriteIcon || '📄';
    
    const btn = createFavoritesButton(contentId, { type, category, title, route, icon, showLabel: true });
    el.replaceWith(btn);
  });
}

document.addEventListener('DOMContentLoaded', initFavoritesButtons);