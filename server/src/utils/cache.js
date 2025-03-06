/**
 * Cache Utility
 * 
 * This utility provides a simple in-memory cache with TTL (Time To Live) support.
 * It's used to cache frequently accessed data to improve performance.
 */

// Cache configuration
const DEFAULT_TTL = 3600; // Default TTL in seconds (1 hour)
const MAX_CACHE_SIZE = parseInt(process.env.MAX_CACHE_SIZE || '1000', 10); // Maximum number of items in cache
const CACHE_ENABLED = process.env.CACHE_ENABLED !== 'false'; // Cache enabled by default

// Cache storage
const cacheStore = new Map();
const cacheStats = {
  hits: 0,
  misses: 0,
  sets: 0,
  evictions: 0,
  expired: 0
};

// LRU tracking
const lruList = [];

/**
 * Set a value in the cache
 * 
 * @param {string} key - Cache key
 * @param {any} value - Value to cache
 * @param {number} ttl - Time to live in seconds
 * @returns {boolean} Success status
 */
const set = (key, value, ttl = DEFAULT_TTL) => {
  if (!CACHE_ENABLED) {
    return false;
  }
  
  // Check if we need to evict items
  if (cacheStore.size >= MAX_CACHE_SIZE && !cacheStore.has(key)) {
    evictOldest();
  }
  
  // Calculate expiration time
  const expiresAt = Date.now() + (ttl * 1000);
  
  // Store in cache
  cacheStore.set(key, {
    value,
    expiresAt
  });
  
  // Update LRU list
  updateLRU(key);
  
  // Update stats
  cacheStats.sets++;
  
  return true;
};

/**
 * Get a value from the cache
 * 
 * @param {string} key - Cache key
 * @returns {any} Cached value or undefined if not found
 */
const get = (key) => {
  if (!CACHE_ENABLED || !cacheStore.has(key)) {
    cacheStats.misses++;
    return undefined;
  }
  
  const cacheItem = cacheStore.get(key);
  
  // Check if item has expired
  if (cacheItem.expiresAt < Date.now()) {
    // Remove expired item
    cacheStore.delete(key);
    removeLRU(key);
    cacheStats.expired++;
    cacheStats.misses++;
    return undefined;
  }
  
  // Update LRU list
  updateLRU(key);
  
  // Update stats
  cacheStats.hits++;
  
  return cacheItem.value;
};

/**
 * Check if a key exists in the cache
 * 
 * @param {string} key - Cache key
 * @returns {boolean} True if key exists and has not expired
 */
const has = (key) => {
  if (!CACHE_ENABLED || !cacheStore.has(key)) {
    return false;
  }
  
  const cacheItem = cacheStore.get(key);
  
  // Check if item has expired
  if (cacheItem.expiresAt < Date.now()) {
    // Remove expired item
    cacheStore.delete(key);
    removeLRU(key);
    cacheStats.expired++;
    return false;
  }
  
  return true;
};

/**
 * Delete a value from the cache
 * 
 * @param {string} key - Cache key
 * @returns {boolean} True if item was deleted
 */
const del = (key) => {
  if (!CACHE_ENABLED || !cacheStore.has(key)) {
    return false;
  }
  
  cacheStore.delete(key);
  removeLRU(key);
  
  return true;
};

/**
 * Clear the entire cache
 */
const clear = () => {
  cacheStore.clear();
  lruList.length = 0;
};

/**
 * Get cache statistics
 * 
 * @returns {Object} Cache statistics
 */
const getStats = () => {
  const hitRate = cacheStats.hits + cacheStats.misses > 0 
    ? (cacheStats.hits / (cacheStats.hits + cacheStats.misses)) * 100 
    : 0;
    
  return {
    ...cacheStats,
    size: cacheStore.size,
    maxSize: MAX_CACHE_SIZE,
    hitRate: hitRate.toFixed(2) + '%',
    enabled: CACHE_ENABLED
  };
};

/**
 * Reset cache statistics
 */
const resetStats = () => {
  cacheStats.hits = 0;
  cacheStats.misses = 0;
  cacheStats.sets = 0;
  cacheStats.evictions = 0;
  cacheStats.expired = 0;
};

/**
 * Update LRU list for a key
 * 
 * @param {string} key - Cache key
 */
const updateLRU = (key) => {
  // Remove key if it already exists in the list
  removeLRU(key);
  
  // Add key to the end of the list (most recently used)
  lruList.push(key);
};

/**
 * Remove a key from the LRU list
 * 
 * @param {string} key - Cache key
 */
const removeLRU = (key) => {
  const index = lruList.indexOf(key);
  if (index !== -1) {
    lruList.splice(index, 1);
  }
};

/**
 * Evict the oldest (least recently used) item from the cache
 */
const evictOldest = () => {
  if (lruList.length > 0) {
    const oldestKey = lruList.shift(); // Get the oldest key
    cacheStore.delete(oldestKey);
    cacheStats.evictions++;
  }
};

/**
 * Prune expired items from the cache
 * 
 * @returns {number} Number of items pruned
 */
const prune = () => {
  const now = Date.now();
  let prunedCount = 0;
  
  for (const [key, item] of cacheStore.entries()) {
    if (item.expiresAt < now) {
      cacheStore.delete(key);
      removeLRU(key);
      prunedCount++;
      cacheStats.expired++;
    }
  }
  
  return prunedCount;
};

// Periodically prune expired items (every 5 minutes)
if (CACHE_ENABLED) {
  setInterval(prune, 5 * 60 * 1000);
}

module.exports = {
  set,
  get,
  has,
  del,
  clear,
  getStats,
  resetStats,
  prune
};
