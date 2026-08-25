// src/utils/cacheManager.ts

export interface CacheConfig {
  maxSize: number; // in bytes
  currentSize: number;
}

class CacheManager {
  private maxSize: number;
  private readonly DB_NAME = "quillCache";
  private readonly STORE_NAME = "translations";

  constructor(maxSizeMB: number = 200) {
    this.maxSize = maxSizeMB * 1024 * 1024; // Convert to bytes
  }

  // Set cache size limit
  setMaxSize(sizeMB: number) {
    this.maxSize = sizeMB * 1024 * 1024;
    this.enforceLimit();
  }

  // Get current cache size
  async getCurrentSize(): Promise<number> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return estimate.usage || 0;
    }
    return 0;
  }

  // Add item to cache
  async setItem(key: string, value: any): Promise<void> {
    const size = new Blob([JSON.stringify(value)]).size;
    
    // Check if adding this item will exceed limit
    const currentSize = await this.getCurrentSize();
    if (currentSize + size > this.maxSize) {
      await this.enforceLimit();
    }

    // Store in localStorage for small items
    if (size < 1024 * 1024) { // Less than 1MB
      localStorage.setItem(`cache_${key}`, JSON.stringify(value));
    } else {
      // Use IndexedDB for larger items
      await this.saveToIndexedDB(key, value);
    }
  }

  // Get item from cache
  async getItem(key: string): Promise<any> {
    // Try localStorage first
    const localItem = localStorage.getItem(`cache_${key}`);
    if (localItem) {
      return JSON.parse(localItem);
    }

    // Try IndexedDB
    return await this.getFromIndexedDB(key);
  }

  // Clear all cache
  async clear(): Promise<void> {
    // Clear localStorage cache items
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith('cache_')) {
        localStorage.removeItem(key);
      }
    });

    // Clear IndexedDB
    await this.clearIndexedDB();
  }

  // Enforce cache limit by removing oldest items
  private async enforceLimit(): Promise<void> {
    const currentSize = await this.getCurrentSize();
    if (currentSize <= this.maxSize) return;

    // Remove oldest localStorage items
    const cacheKeys = Object.keys(localStorage).filter(k => k.startsWith('cache_'));
    if (cacheKeys.length > 0) {
      localStorage.removeItem(cacheKeys[0]); // Remove oldest
    }

    // Clear IndexedDB if still over limit
    if (await this.getCurrentSize() > this.maxSize) {
      await this.clearIndexedDB();
    }
  }

  // IndexedDB helpers
  private async saveToIndexedDB(key: string, value: any): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction([this.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(this.STORE_NAME);
        store.put({ key, value, timestamp: Date.now() });
        transaction.oncomplete = () => resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.STORE_NAME)) {
          db.createObjectStore(this.STORE_NAME, { keyPath: 'key' });
        }
      };
    });
  }

  private async getFromIndexedDB(key: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, 1);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction([this.STORE_NAME], 'readonly');
        const store = transaction.objectStore(this.STORE_NAME);
        const getRequest = store.get(key);

        getRequest.onsuccess = () => resolve(getRequest.result?.value);
        getRequest.onerror = () => reject(getRequest.error);
      };
    });
  }

  private async clearIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, 1);

      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction([this.STORE_NAME], 'readwrite');
        const store = transaction.objectStore(this.STORE_NAME);
        store.clear();
        transaction.oncomplete = () => resolve();
      };

      request.onerror = () => reject(request.error);
    });
  }
}

export default CacheManager;