/**
 * Progress Tracker - Tracks user progress across encyclopedia sections
 * Reading progress, khatma, adhkar completion, daily habits
 * @module lib/progress-tracker
 */

import { read, write } from './storage.js';

const PROGRESS_KEY = 'encyclopedia-progress-v1';

/**
 * @typedef {Object} ProgressEntry
 * @property {string} id - Unique entry ID
 * @property {string} type - Progress type (reading, khatma, adhkar, lesson, tool, daily)
 * @property {string} category - Category (quran, hadith, fiqh, etc.)
 * @property {string} title - Display title
 * @property {string} route - URL route
 * @property {number} progress - Progress percentage (0-100)
 * @property {number} current - Current position
 * @property {number} total - Total items
 * @property {number} updatedAt - Last update timestamp
 * @property {object} [metadata] - Additional metadata (surah, ayah, section, etc.)
 */

class ProgressTracker {
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
      const data = read(PROGRESS_KEY, null);
      if (data && Array.isArray(data)) {
        return new Map(data.map(item => [this.getKey(item.id, item.type), item]));
      }
    } catch (e) {
      console.warn('Failed to load progress:', e);
    }
    return new Map();
  }

  async save() {
    try {
      const items = Array.from(this.cache.values());
      write(PROGRESS_KEY, items);
      return true;
    } catch (e) {
      console.error('Failed to save progress:', e);
      return false;
    }
  }

  getKey(id, type) {
    return `${type}:${id}`;
  }

  async updateProgress(entry) {
    await this.init();
    const key = this.getKey(entry.id, entry.type);
    const existing = this.cache.get(key) || {};
    
    const updated = {
      id: entry.id,
      type: entry.type,
      category: entry.category || existing.category || '',
      title: entry.title || existing.title || '',
      route: entry.route || existing.route || '',
      progress: Math.max(0, Math.min(100, entry.progress || existing.progress || 0)),
      current: entry.current !== undefined ? entry.current : (existing.current || 0),
      total: entry.total !== undefined ? entry.total : (existing.total || 0),
      updatedAt: Date.now(),
      metadata: { ...existing.metadata, ...entry.metadata }
    };

    this.cache.set(key, updated);
    await this.save();
    return updated;
  }

  async incrementProgress(id, type, amount = 1) {
    await this.init();
    const key = this.getKey(id, type);
    const existing = this.cache.get(key);
    
    if (!existing) return null;
    
    const newCurrent = Math.min(existing.total, (existing.current || 0) + amount);
    const newProgress = existing.total > 0 ? Math.round((newCurrent / existing.total) * 100) : 0;
    
    return this.updateProgress({
      ...existing,
      current: newCurrent,
      progress: newProgress
    });
  }

  async completeEntry(id, type) {
    return this.updateProgress({ id, type, progress: 100 });
  }

  async resetProgress(id, type) {
    await this.init();
    const key = this.getKey(id, type);
    const existing = this.cache.get(key);
    
    if (!existing) return null;
    
    return this.updateProgress({
      ...existing,
      current: 0,
      progress: 0
    });
  }

  async getProgress(id, type) {
    await this.init();
    const key = this.getKey(id, type);
    return this.cache.get(key) || null;
  }

  async getAllProgress() {
    await this.init();
    return Array.from(this.cache.values())
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async getProgressByType(type) {
    await this.init();
    return Array.from(this.cache.values())
      .filter(p => p.type === type)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async getProgressByCategory(category) {
    await this.init();
    return Array.from(this.cache.values())
      .filter(p => p.category === category)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  // Quran-specific helpers
  async updateQuranReading(surah, ayah, totalAyahs, surahName) {
    return this.updateProgress({
      id: `surah-${surah}`,
      type: 'reading',
      category: 'quran',
      title: `سورة ${surahName} - الآية ${ayah}`,
      route: `30-quran-full.html?s=${surah}&a=${ayah}`,
      current: ayah,
      total: totalAyahs,
      metadata: { surah, ayah, surahName }
    });
  }

  async updateKhatma(juzCompleted, totalJuz = 30) {
    return this.updateProgress({
      id: 'khatma',
      type: 'khatma',
      category: 'quran',
      title: 'ختمة القرآن الكريم',
      route: '34-khatma.html',
      current: juzCompleted,
      total: totalJuz,
      metadata: { juzCompleted }
    });
  }

  async updateAdhkar(section, completed, total, sectionName) {
    return this.updateProgress({
      id: `adhkar-${section}`,
      type: 'adhkar',
      category: 'adhkar',
      title: `أذكار ${sectionName}`,
      route: '25-azkar-shamila.html',
      current: completed,
      total,
      metadata: { section, sectionName }
    });
  }

  async updateLesson(lessonId, lessonTitle, completed, total, category) {
    return this.updateProgress({
      id: `lesson-${lessonId}`,
      type: 'lesson',
      category: category || 'learn',
      title: lessonTitle,
      route: `src/site/noor.html#lesson/${lessonId}`,
      current: completed ? total : 0,
      total,
      metadata: { lessonId, completed }
    });
  }

  async updateDailyHabit(habitId, habitTitle, completed, category = 'daily') {
    const today = new Date().toISOString().split('T')[0];
    return this.updateProgress({
      id: `daily-${habitId}-${today}`,
      type: 'daily',
      category,
      title: habitTitle,
      route: '',
      current: completed ? 1 : 0,
      total: 1,
      metadata: { habitId, date: today, completed }
    });
  }

  async getDailyHabits(date = new Date().toISOString().split('T')[0]) {
    await this.init();
    return Array.from(this.cache.values())
      .filter(p => p.type === 'daily' && p.metadata?.date === date)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async getStreak(type, category) {
    await this.init();
    const entries = Array.from(this.cache.values())
      .filter(p => p.type === type && (!category || p.category === category))
      .filter(p => p.progress === 100 || p.current === p.total)
      .sort((a, b) => b.updatedAt - a.updatedAt);

    // Calculate consecutive days
    const dates = new Set(entries.map(e => 
      new Date(e.updatedAt).toISOString().split('T')[0]
    ));
    
    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < 365; i++) {
      const checkDate = new Date(today);
      checkDate.setDate(today.getDate() - i);
      const dateStr = checkDate.toISOString().split('T')[0];
      
      if (dates.has(dateStr)) {
        streak++;
      } else if (i > 0) {
        break;
      }
    }
    
    return streak;
  }

  async getStats() {
    await this.init();
    const all = Array.from(this.cache.values());
    
    return {
      totalEntries: all.length,
      byType: all.reduce((acc, p) => {
        acc[p.type] = (acc[p.type] || 0) + 1;
        return acc;
      }, {}),
      byCategory: all.reduce((acc, p) => {
        if (p.category) acc[p.category] = (acc[p.category] || 0) + 1;
        return acc;
      }, {}),
      completed: all.filter(p => p.progress === 100).length,
      inProgress: all.filter(p => p.progress > 0 && p.progress < 100).length,
      lastUpdated: all.length ? Math.max(...all.map(p => p.updatedAt)) : 0
    };
  }

  async exportProgress() {
    await this.init();
    return {
      version: 1,
      exportedAt: Date.now(),
      items: Array.from(this.cache.values())
    };
  }

  async importProgress(data) {
    await this.init();
    if (!data || !Array.isArray(data.items)) {
      throw new Error('Invalid progress data');
    }

    let imported = 0;
    for (const item of data.items) {
      if (item.id && item.type) {
        const key = this.getKey(item.id, item.type);
        if (!this.cache.has(key) || (item.updatedAt > (this.cache.get(key)?.updatedAt || 0))) {
          this.cache.set(key, item);
          imported++;
        }
      }
    }
    await this.save();
    return { imported };
  }
}

export const progressTracker = new ProgressTracker();

export async function updateProgress(entry) {
  return progressTracker.updateProgress(entry);
}

export async function getProgress(id, type) {
  return progressTracker.getProgress(id, type);
}

export async function getAllProgress() {
  return progressTracker.getAllProgress();
}

export async function getProgressByType(type) {
  return progressTracker.getProgressByType(type);
}





export async function getStreak(type, category) {
  return progressTracker.getStreak(type, category);
}


progressTracker.init().catch(console.error);