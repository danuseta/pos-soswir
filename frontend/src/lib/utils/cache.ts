import { browser } from '$app/environment';

interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number;
  accessCount: number;
  lastAccessed: number;
}

interface CacheConfig {
  maxSize: number;
  defaultTTL: number;
  cleanupInterval: number;
  strategy: 'LRU' | 'LFU' | 'FIFO';
}

class AdvancedCache<T> {
  private cache = new Map<string, CacheItem<T>>();
  private config: CacheConfig;
  private cleanupTimer: number | null = null;

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 100,
      defaultTTL: 5 * 60 * 1000,
      cleanupInterval: 60 * 1000,
      strategy: 'LRU',
      ...config
    };

    this.startCleanup();
  }

  set(key: string, data: T, ttl?: number): void {
    const now = Date.now();
    const item: CacheItem<T> = {
      data,
      timestamp: now,
      ttl: ttl || this.config.defaultTTL,
      accessCount: 0,
      lastAccessed: now
    };

    if (this.cache.size >= this.config.maxSize) {
      this.evict();
    }

    this.cache.set(key, item);
  }

  get(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    const now = Date.now();
    
    if (now - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }

    item.accessCount++;
    item.lastAccessed = now;
    
    return item.data;
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  getStats() {
    const items = Array.from(this.cache.values());
    return {
      size: this.cache.size,
      totalAccesses: items.reduce((sum, item) => sum + item.accessCount, 0),
      avgAccessCount: items.length > 0 ? items.reduce((sum, item) => sum + item.accessCount, 0) / items.length : 0,
      oldestItem: items.length > 0 ? Math.min(...items.map(item => item.timestamp)) : 0,
      newestItem: items.length > 0 ? Math.max(...items.map(item => item.timestamp)) : 0
    };
  }

  private evict(): void {
    if (this.cache.size === 0) return;

    let keyToEvict: string;
    const entries = Array.from(this.cache.entries());

    switch (this.config.strategy) {
      case 'LRU':
        keyToEvict = entries.reduce((oldest, [key, item]) => {
          const [oldestKey, oldestItem] = oldest;
          return item.lastAccessed < oldestItem.lastAccessed ? [key, item] : oldest;
        })[0];
        break;

      case 'LFU':
        keyToEvict = entries.reduce((leastUsed, [key, item]) => {
          const [leastUsedKey, leastUsedItem] = leastUsed;
          return item.accessCount < leastUsedItem.accessCount ? [key, item] : leastUsed;
        })[0];
        break;

      case 'FIFO':
      default:
        keyToEvict = entries.reduce((oldest, [key, item]) => {
          const [oldestKey, oldestItem] = oldest;
          return item.timestamp < oldestItem.timestamp ? [key, item] : oldest;
        })[0];
        break;
    }

    this.cache.delete(keyToEvict);
  }

  private startCleanup(): void {
    if (!browser) return;

    this.cleanupTimer = window.setInterval(() => {
      const now = Date.now();
      const keysToDelete: string[] = [];

      this.cache.forEach((item, key) => {
        if (now - item.timestamp > item.ttl) {
          keysToDelete.push(key);
        }
      });

      keysToDelete.forEach(key => this.cache.delete(key));
    }, this.config.cleanupInterval);
  }

  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    this.clear();
  }
}

export const apiCache = new AdvancedCache({
  maxSize: 50,
  defaultTTL: 5 * 60 * 1000,
  strategy: 'LRU'
});

export const imageCache = new AdvancedCache({
  maxSize: 100,
  defaultTTL: 30 * 60 * 1000,
  strategy: 'LFU'
});

export const componentCache = new AdvancedCache({
  maxSize: 25,
  defaultTTL: 10 * 60 * 1000,
  strategy: 'LRU'
});

export function cached(ttl?: number) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;
    const cache = new Map<string, { result: any; timestamp: number }>();

    descriptor.value = function (...args: any[]) {
      const key = `${propertyKey}_${JSON.stringify(args)}`;
      const now = Date.now();
      const cached = cache.get(key);
      const cacheTTL = ttl || 5 * 60 * 1000;

      if (cached && (now - cached.timestamp) < cacheTTL) {
        return cached.result;
      }

      const result = originalMethod.apply(this, args);
      cache.set(key, { result, timestamp: now });

      return result;
    };

    return descriptor;
  };
}

export class LocalStorageCache {
  private prefix: string;

  constructor(prefix: string = 'pos_cache_') {
    this.prefix = prefix;
  }

  set(key: string, data: any, ttl?: number): void {
    if (!browser) return;

    const item = {
      data,
      timestamp: Date.now(),
      ttl: ttl || 24 * 60 * 60 * 1000
    };

    try {
      const compressed = this.compress(JSON.stringify(item));
      localStorage.setItem(this.prefix + key, compressed);
    } catch (error) {
      console.warn('Failed to cache to localStorage:', error);
    }
  }

  get<T>(key: string): T | null {
    if (!browser) return null;

    try {
      const compressed = localStorage.getItem(this.prefix + key);
      if (!compressed) return null;

      const decompressed = this.decompress(compressed);
      const item = JSON.parse(decompressed);
      const now = Date.now();

      if (now - item.timestamp > item.ttl) {
        this.delete(key);
        return null;
      }

      return item.data;
    } catch (error) {
      console.warn('Failed to retrieve from localStorage cache:', error);
      return null;
    }
  }

  delete(key: string): void {
    if (!browser) return;
    localStorage.removeItem(this.prefix + key);
  }

  clear(): void {
    if (!browser) return;
    
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
      if (key.startsWith(this.prefix)) {
        localStorage.removeItem(key);
      }
    });
  }

  private compress(str: string): string {
    return btoa(str);
  }

  private decompress(str: string): string {
    return atob(str);
  }
}

export const localCache = new LocalStorageCache();

export function invalidateCache(pattern?: string): void {
  if (pattern) {
    if (pattern.includes('api')) {
      apiCache.clear();
    }
    if (pattern.includes('image')) {
      imageCache.clear();
    }
    if (pattern.includes('component')) {
      componentCache.clear();
    }
  } else {
    apiCache.clear();
    imageCache.clear();
    componentCache.clear();
    localCache.clear();
  }
}

export function getCacheStats() {
  return {
    api: apiCache.getStats(),
    image: imageCache.getStats(),
    component: componentCache.getStats(),
    total: {
      size: apiCache.size() + imageCache.size() + componentCache.size(),
      memory: browser ? (performance as any).memory?.usedJSHeapSize || 0 : 0
    }
  };
} 