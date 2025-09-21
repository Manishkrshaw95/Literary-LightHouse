import { Injectable } from '@angular/core';
import { API_BASE } from './api.config';

@Injectable({ providedIn: 'root' })
export class BookService {
  private storageKey = 'll_books_cache_v1';
  private versionKey = 'll_books_version_v1';
  private books: any[] = [];

  constructor() {}

  // Load books from localStorage if available, else fetch from backend and cache.
  async loadBooks(forceRefresh = false): Promise<any[]> {
    if (!forceRefresh && this.books && this.books.length > 0) return this.books;

    if (!forceRefresh && typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(this.storageKey);
        const cached = raw ? (JSON.parse(raw || '[]') || []) : [];
        // If we have a cache, verify version with server before trusting it
        if (cached && cached.length > 0) {
          const ok = await this.ensureFreshness();
          if (ok) {
            this.books = cached;
            return this.books;
          }
        }
      } catch (e) { /* ignore */ }
    }

    // fetch from backend
    try {
      const res = await fetch(`${API_BASE}/booksData`);
      if (!res.ok) throw new Error('Failed to fetch books');
      const data = await res.json();
      // normalize categories
      this.books = (data || []).map((b: any) => ({ ...b, categories: Array.isArray(b.categories) ? b.categories.map((c: any) => Number(c)) : [] }));
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(this.books));
        const ver = await this.fetchServerVersion();
        if (ver) localStorage.setItem(this.versionKey, String(ver));
      } catch (e) {}
      return this.books;
    } catch (e) {
      this.books = [];
      return this.books;
    }
  }

  // Force reload from backend and update cache
  async refreshFromServer(): Promise<any[]> {
    return this.loadBooks(true).then(async books => {
      try {
        localStorage.setItem(this.storageKey, JSON.stringify(books));
        const ver = await this.fetchServerVersion();
        if (ver) localStorage.setItem(this.versionKey, String(ver));
      } catch (e) {}
      return books;
    });
  }

  // Get in-memory books (may be null until loadBooks is called)
  getCachedBooks(): any[] | null {
    return this.books;
  }

  // Check if local cache version matches server; return true if up-to-date
  async ensureFreshness(): Promise<boolean> {
    try {
      const localVer = Number(localStorage.getItem(this.versionKey) || '0');
      const serverVer = await this.fetchServerVersion();
      if (serverVer && localVer && serverVer === localVer) return true;
      return false;
    } catch {
      return false;
    }
  }

  private async fetchServerVersion(): Promise<number> {
    try {
      const res = await fetch(`${API_BASE}/booksVersion`);
      if (!res.ok) return 0;
      const j = await res.json();
      const v = Number(j && j.booksVersion);
      return Number.isFinite(v) && v > 0 ? v : 0;
    } catch {
      return 0;
    }
  }

  // Invalidate local cache immediately (e.g., after admin toggles stock)
  invalidateCache() {
    try {
      localStorage.removeItem(this.storageKey);
      localStorage.removeItem(this.versionKey);
    } catch {}
    this.books = [];
  }
}
