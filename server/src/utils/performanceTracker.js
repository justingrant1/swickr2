/**
 * Performance Tracker Utility
 * 
 * This utility provides performance tracking capabilities for various operations in Swickr.
 * It allows tracking execution time, memory usage, and other performance metrics.
 */

// Store metrics for different operation types
const metrics = {
  // Media operations
  media: {
    upload: {
      count: 0,
      totalTime: 0,
      maxTime: 0,
      minTime: Number.MAX_SAFE_INTEGER,
      avgTime: 0
    },
    batchUpload: {
      count: 0,
      totalTime: 0,
      maxTime: 0,
      minTime: Number.MAX_SAFE_INTEGER,
      avgTime: 0,
      totalFiles: 0,
      avgFilesPerBatch: 0
    },
    imageProcessing: {
      count: 0,
      totalTime: 0,
      maxTime: 0,
      minTime: Number.MAX_SAFE_INTEGER,
      avgTime: 0
    },
    accessCheck: {
      count: 0,
      totalTime: 0,
      avgTime: 0
    },
    dbCreate: {
      count: 0,
      totalTime: 0,
      avgTime: 0
    },
    processFile: {
      count: 0,
      totalTime: 0,
      avgTime: 0
    }
  },
  
  // Reaction operations
  reaction: {
    add: {
      count: 0,
      totalTime: 0,
      avgTime: 0
    },
    remove: {
      count: 0,
      totalTime: 0,
      avgTime: 0
    },
    addBatch: {
      count: 0,
      totalTime: 0,
      avgTime: 0,
      totalItems: 0,
      avgItemsPerBatch: 0
    },
    removeBatch: {
      count: 0,
      totalTime: 0,
      avgTime: 0,
      totalItems: 0,
      avgItemsPerBatch: 0
    }
  }
};

/**
 * Start tracking performance for an operation
 * 
 * @param {string} operationType - Type of operation being tracked
 * @returns {Object} Tracker object with end method
 */
const start = (operationType) => {
  const startTime = process.hrtime();
  const startMemory = process.memoryUsage();
  
  // Parse operation type to get category and operation
  const [category, operation] = operationType.split('.');
  
  return {
    operationType,
    startTime,
    startMemory,
    
    /**
     * End performance tracking and update metrics
     * 
     * @param {Object} additionalData - Additional data to include in metrics
     * @returns {Object} Performance metrics for this operation
     */
    end: (additionalData = {}) => {
      const endTime = process.hrtime(startTime);
      const endMemory = process.memoryUsage();
      
      // Calculate execution time in milliseconds
      const executionTime = (endTime[0] * 1000) + (endTime[1] / 1000000);
      
      // Calculate memory usage delta in MB
      const memoryDelta = {
        rss: (endMemory.rss - startMemory.rss) / 1024 / 1024,
        heapTotal: (endMemory.heapTotal - startMemory.heapTotal) / 1024 / 1024,
        heapUsed: (endMemory.heapUsed - startMemory.heapUsed) / 1024 / 1024
      };
      
      // Update metrics if category and operation exist
      if (metrics[category] && metrics[category][operation]) {
        const metricObj = metrics[category][operation];
        
        // Update count and total time
        metricObj.count++;
        metricObj.totalTime += executionTime;
        
        // Update min/max times
        if (executionTime > metricObj.maxTime) {
          metricObj.maxTime = executionTime;
        }
        if (executionTime < metricObj.minTime) {
          metricObj.minTime = executionTime;
        }
        
        // Update average time
        metricObj.avgTime = metricObj.totalTime / metricObj.count;
        
        // Handle batch-specific metrics
        if (operation.includes('Batch') && additionalData.itemCount) {
          metricObj.totalItems += additionalData.itemCount;
          metricObj.avgItemsPerBatch = metricObj.totalItems / metricObj.count;
        }
      }
      
      return {
        operationType,
        executionTime,
        memoryDelta,
        timestamp: new Date()
      };
    },
    
    /**
     * Get metrics for this operation
     * 
     * @returns {Object} Current metrics
     */
    getMetrics: () => {
      if (metrics[category] && metrics[category][operation]) {
        return { ...metrics[category][operation] };
      }
      return null;
    }
  };
};

/**
 * Track batch operation metrics
 * 
 * @param {string} category - Category of operation (e.g., 'reaction')
 * @param {string} operation - Type of operation (e.g., 'add')
 * @param {number} itemCount - Number of items in the batch
 * @param {number} executionTime - Execution time in milliseconds
 */
const trackBatchOperation = (category, operation, itemCount, executionTime) => {
  const batchOperation = `${operation}Batch`;
  
  if (metrics[category] && metrics[category][batchOperation]) {
    const metricObj = metrics[category][batchOperation];
    
    // Update metrics
    metricObj.count++;
    metricObj.totalTime += executionTime;
    metricObj.avgTime = metricObj.totalTime / metricObj.count;
    metricObj.totalItems += itemCount;
    metricObj.avgItemsPerBatch = metricObj.totalItems / metricObj.count;
  }
};

/**
 * Get all performance metrics
 * 
 * @returns {Object} All performance metrics
 */
const getAllMetrics = () => {
  return { ...metrics };
};

/**
 * Get metrics for a specific category
 * 
 * @param {string} category - Category to get metrics for
 * @returns {Object} Category metrics
 */
const getCategoryMetrics = (category) => {
  if (metrics[category]) {
    return { ...metrics[category] };
  }
  return null;
};

/**
 * Reset all metrics
 */
const resetAllMetrics = () => {
  for (const category in metrics) {
    for (const operation in metrics[category]) {
      const metricObj = metrics[category][operation];
      
      metricObj.count = 0;
      metricObj.totalTime = 0;
      metricObj.maxTime = 0;
      metricObj.minTime = Number.MAX_SAFE_INTEGER;
      metricObj.avgTime = 0;
      
      if ('totalItems' in metricObj) {
        metricObj.totalItems = 0;
        metricObj.avgItemsPerBatch = 0;
      }
    }
  }
};

/**
 * Reset metrics for a specific category
 * 
 * @param {string} category - Category to reset metrics for
 */
const resetCategoryMetrics = (category) => {
  if (metrics[category]) {
    for (const operation in metrics[category]) {
      const metricObj = metrics[category][operation];
      
      metricObj.count = 0;
      metricObj.totalTime = 0;
      metricObj.maxTime = 0;
      metricObj.minTime = Number.MAX_SAFE_INTEGER;
      metricObj.avgTime = 0;
      
      if ('totalItems' in metricObj) {
        metricObj.totalItems = 0;
        metricObj.avgItemsPerBatch = 0;
      }
    }
  }
};

module.exports = {
  start,
  trackBatchOperation,
  getAllMetrics,
  getCategoryMetrics,
  resetAllMetrics,
  resetCategoryMetrics
};
