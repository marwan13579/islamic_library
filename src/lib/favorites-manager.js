/**
 * Unified Favorites Manager - Handles favorites across all content types
 * Uses localStorage/IndexedDB with offline-first approach
 * @module lib/favorites-manager
 */

import { read, write } from './storage.js';

const FAVORITES_KEY = 'encyclopedia-favorites-v1';
const FAVORITES_META_KEY = 'encyclopedia-favorites-meta-v1';

/**
 * @typedef {Object} FavoriteItem
 * @property {string} id - Unique content ID
 * @property {string} type - Content type (content, tool, verse, hadith, dhikr, book, etc.)
 * @property {string} category - Category (quran, hadith, fiqh, etc.)
 * @property {string} title - Display title
 * @property {string} route - URL route
 * @property {string} icon - Emoji icon
 * @property {number} addedAt - Timestamp
 * @property {object} [metadata] - Additional metadata
 */

class FavoritesManager {
  constructor() {
    this.cache = null;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    this.cache = await this.load();
    this.initialized = true;
  }

  async load() {
    try {
      const data = read(FAVORITES_KEY, null);
      if (data && Array.isArray(data)) {
        return new Map(data.map(item => [this.getKey(item.id, item.type), item]));
      }
    } catch (e) {
      console.warn('Failed to load favorites:', e);
    }
    return new Map();
  }

  async save() {
    try {
      const items = Array.from(this.cache.values());
      write(FAVORITES_KEY, items);
      // Update meta
      const meta = {
        total: items.length,
        byType: this.getCountByType(),
        byCategory: this.getCountByCategory(),
        lastUpdated: Date.now()
      };
      write(FAVORITES_META_KEY, meta);
      return true;
    } catch (e) {
      console.error('Failed to save favorites:', e);
      return false;
    }
  }

  getKey(id, type) {
    return `${type}:${id}`;
  }

  parseKey(key) {
    const [type, ...idParts] = key.split(':');
    return { type, id: idParts.join(':') };
  }

  async addFavorite(item) {
    await this.init();
    const key = this.getKey(item.id, item.type);
    
    const favorite = {
      id: item.id,
      type: item.type,
      category: item.category || '',
      title: item.title || '',
      route: item.route || '',
      icon: item.icon || '📄',
      addedAt: Date.now(),
      metadata: item.metadata || {}
    };

    this.cache.set(key, favorite);
    await this.save();
    return favorite;
  }

  async removeFavorite(id, type) {
    await this.init();
    const key = this.getKey(id, type);
    const existed = this.cache.has(key);
    this.cache.delete(key);
    await this.save();
    return existed;
  }

  async toggleFavorite(item) {
    await this.init();
    const key = this.getKey(item.id, item.type);
    const exists = this.cache.has(key);
    
    if (exists) {
      await this.removeFavorite(item.id, item.type);
      return { added: false, item: null };
    } else {
      const favorite = await this.addFavorite(item);
      return { added: true, item: favorite };
    }
  }

  isFavorite(id, type) {
    const key = this.getKey(id, type);
    return this.cache.has(key);
  }

  async getFavorite(id, type) {
    await this.init();
    const key = this.getKey(id, type);
    return this.cache.get(key) || null;
  }

  async getAllFavorites() {
    await this.init();
    return Array.from(this.cache.values())
      .sort((a, b) => b.addedAt - a.addedAt);
  }

  async getFavoritesByType(type) {
    await this.init();
    return Array.from(this.cache.values())
      .filter(f => f.type === type)
      .sort((a, b) => b.addedAt - a.addedAt);
  }

  async getFavoritesByCategory(category) {
    await this.init();
    return Array.from(this.cache.values())
      .filter(f => f.category === category)
      .sort((a, b) => b.addedAt - a.addedAt);
  }

  async searchFavorites(query) {
    await this.init();
    const normalized = query.toLowerCase().trim();
    if (!normalized) return await this.getAllFavorites();

    return Array.from(this.cache.values())
      .filter(f => 
        f.title.toLowerCase().includes(normalized) ||
        f.category.toLowerCase().includes(normalized) ||
        f.type.toLowerCase().includes(normalized)
      )
      .sort((a, b) => b.addedAt - a.addedAt);
  }

  getCountByType() {
    const counts = {};
    this.cache.forEach(f => {
      counts[f.type] = (counts[f.type] || 0) + 1;
    });
    return counts;
  }

  getCountByCategory() {
    const counts = {};
    this.cache.forEach(f => {
      if (f.category) {
        counts[f.category] = (counts[f.category] || 0) + 1;
      }
    });
    return counts;
  }

  async getTotalCount() {
    await this.init();
    return this.cache.size;
  }

  async clearAll() {
    await this.init();
    this.cache.clear();
    await this.save();
  }

  async exportFavorites() {
    await this.init();
    const items = Array.from(this.cache.values());
    return {
      version: 1,
      exportedAt: Date.now(),
      items
    };
  }

  async importFavorites(data) {
    await this.init();
    if (!data || !Array.isArray(data.items)) {
      throw new Error('Invalid favorites data');
    }

    let imported = 0;
    for (const item of data.items) {
      if (item.id && item.type) {
        const key = this.getKey(item.id, item.type);
        if (!this.cache.has(key)) {
          this.cache.set(key, {
            ...item,
            addedAt: item.addedAt || Date.now()
          });
          imported++;
        }
      }
    }
    await this.save();
    return { imported, skipped: data.items.length - imported };
  }

  // Subscribe to changes
  _listeners = new Set();
  
  subscribe(listener) {
    this._listeners.add(listener);
    return () => this._listeners.delete(listener);
  }

  _notify() {
    this._listeners.forEach(l => {
      try { l(this.getAllFavorites()); } catch (e) {}
    });
  }
}

// Singleton instance
export const favoritesManager = new FavoritesManager();

export async function toggleFavorite(item) {
  return favoritesManager.toggleFavorite(item);
}

export async function isFavorite(id, type) {
  return favoritesManager.isFavorite(id, type);
}

export async function getAllFavorites() {
  return favoritesManager.getAllFavorites();
}

export async function getFavoritesByType(type) {
  return favoritesManager.getFavoritesByType(type);
}

export async function getFavoritesByCategory(category) {
  return favoritesManager.getFavoritesByCategory(category);
}

export async function searchFavorites(query) {
  return favoritesManager.searchFavorites(query);
}

// Initialize on first import
favoritesManager.init().catch(console.error);