// src/lib/cache.ts

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();

/**
 * Lightweight caching utility.
 * @param key The unique cache key.
 * @param fetcher Async function to fetch data if cache misses.
 * @param ttlMs Time-to-live in milliseconds. Default 30s.
 */
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs: number = 30000
): Promise<T> {
  const now = Date.now();
  const cached = memoryCache.get(key);

  if (cached && (now - cached.timestamp < ttlMs)) {
    return cached.data;
  }

  const data = await fetcher();
  memoryCache.set(key, { data, timestamp: now });
  return data;
}

/**
 * Clear specific cache key.
 */
export function invalidateCache(key: string) {
  memoryCache.delete(key);
}

/**
 * Clear all cache.
 */
export function clearCache() {
  memoryCache.clear();
}
