/**
 * Notification Performance Monitor
 * 
 * Utility for monitoring and tracking push notification performance metrics
 * Aligns with Swickr's focus on speed and performance optimization
 */

const { performance } = require('perf_hooks');
const { createLogger } = require('./logger');

const logger = createLogger('notification-performance');

// Store metrics in memory for quick access
const metrics = {
  sendCount: 0,
  successCount: 0,
  failureCount: 0,
  totalSendTime: 0,
  averageSendTime: 0,
  maxSendTime: 0,
  minSendTime: Number.MAX_SAFE_INTEGER,
  sendTimeHistory: [], // Last 100 send times
  failureReasons: {}, // Count of failure reasons
  sendTimesByType: {}, // Average send time by notification type
  hourlyStats: Array(24).fill().map(() => ({
    sendCount: 0,
    successCount: 0,
    failureCount: 0,
    totalSendTime: 0
  }))
};

// Maximum history size to prevent memory issues
const MAX_HISTORY_SIZE = 100;

/**
 * Record the start of a notification send operation
 * @param {string} id - Unique identifier for this notification
 * @returns {function} Function to call when the operation completes
 */
function startNotificationSend(id) {
  const startTime = performance.now();
  
  return (success, type = 'unknown', failureReason = null) => {
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    recordNotificationMetrics(id, duration, success, type, failureReason);
  };
}

/**
 * Record metrics for a notification send operation
 * @param {string} id - Unique identifier for this notification
 * @param {number} duration - Time taken to send the notification in ms
 * @param {boolean} success - Whether the send was successful
 * @param {string} type - Type of notification (message, mention, etc.)
 * @param {string|null} failureReason - Reason for failure if unsuccessful
 */
function recordNotificationMetrics(id, duration, success, type, failureReason) {
  // Update global counts
  metrics.sendCount++;
  
  if (success) {
    metrics.successCount++;
  } else {
    metrics.failureCount++;
    
    // Record failure reason
    if (failureReason) {
      metrics.failureReasons[failureReason] = (metrics.failureReasons[failureReason] || 0) + 1;
    }
  }
  
  // Update timing metrics
  metrics.totalSendTime += duration;
  metrics.averageSendTime = metrics.totalSendTime / metrics.sendCount;
  metrics.maxSendTime = Math.max(metrics.maxSendTime, duration);
  metrics.minSendTime = Math.min(metrics.minSendTime, duration);
  
  // Add to history, maintaining max size
  metrics.sendTimeHistory.push({
    id,
    timestamp: Date.now(),
    duration,
    success,
    type
  });
  
  if (metrics.sendTimeHistory.length > MAX_HISTORY_SIZE) {
    metrics.sendTimeHistory.shift();
  }
  
  // Update type-specific metrics
  if (!metrics.sendTimesByType[type]) {
    metrics.sendTimesByType[type] = {
      count: 0,
      totalTime: 0,
      averageTime: 0
    };
  }
  
  metrics.sendTimesByType[type].count++;
  metrics.sendTimesByType[type].totalTime += duration;
  metrics.sendTimesByType[type].averageTime = 
    metrics.sendTimesByType[type].totalTime / metrics.sendTimesByType[type].count;
  
  // Update hourly stats
  const hour = new Date().getHours();
  metrics.hourlyStats[hour].sendCount++;
  
  if (success) {
    metrics.hourlyStats[hour].successCount++;
  } else {
    metrics.hourlyStats[hour].failureCount++;
  }
  
  metrics.hourlyStats[hour].totalSendTime += duration;
  
  // Log performance data
  logger.info({
    message: 'Notification performance data',
    id,
    duration,
    success,
    type,
    failureReason: failureReason || undefined
  });
  
  // Alert on slow notifications (> 1000ms)
  if (duration > 1000) {
    logger.warn({
      message: 'Slow notification detected',
      id,
      duration,
      type
    });
  }
}

/**
 * Get current notification performance metrics
 * @returns {Object} Current metrics
 */
function getNotificationMetrics() {
  return {
    ...metrics,
    // Calculate some additional metrics
    successRate: metrics.sendCount > 0 ? (metrics.successCount / metrics.sendCount) * 100 : 0,
    failureRate: metrics.sendCount > 0 ? (metrics.failureCount / metrics.sendCount) * 100 : 0,
    // Add timestamp
    timestamp: Date.now()
  };
}

/**
 * Reset all metrics
 */
function resetMetrics() {
  metrics.sendCount = 0;
  metrics.successCount = 0;
  metrics.failureCount = 0;
  metrics.totalSendTime = 0;
  metrics.averageSendTime = 0;
  metrics.maxSendTime = 0;
  metrics.minSendTime = Number.MAX_SAFE_INTEGER;
  metrics.sendTimeHistory = [];
  metrics.failureReasons = {};
  metrics.sendTimesByType = {};
  metrics.hourlyStats = Array(24).fill().map(() => ({
    sendCount: 0,
    successCount: 0,
    failureCount: 0,
    totalSendTime: 0
  }));
}

/**
 * Get performance report for a specific time period
 * @param {number} startTime - Start timestamp
 * @param {number} endTime - End timestamp
 * @returns {Object} Performance report
 */
function getPerformanceReport(startTime = 0, endTime = Date.now()) {
  // Filter history by time range
  const relevantHistory = metrics.sendTimeHistory.filter(
    entry => entry.timestamp >= startTime && entry.timestamp <= endTime
  );
  
  // Calculate metrics for this period
  const periodMetrics = {
    sendCount: relevantHistory.length,
    successCount: relevantHistory.filter(entry => entry.success).length,
    failureCount: relevantHistory.filter(entry => !entry.success).length,
    totalSendTime: relevantHistory.reduce((sum, entry) => sum + entry.duration, 0),
    averageSendTime: 0,
    maxSendTime: relevantHistory.length > 0 ? 
      Math.max(...relevantHistory.map(entry => entry.duration)) : 0,
    minSendTime: relevantHistory.length > 0 ? 
      Math.min(...relevantHistory.map(entry => entry.duration)) : 0,
    byType: {}
  };
  
  // Calculate average
  if (periodMetrics.sendCount > 0) {
    periodMetrics.averageSendTime = periodMetrics.totalSendTime / periodMetrics.sendCount;
  }
  
  // Group by type
  relevantHistory.forEach(entry => {
    if (!periodMetrics.byType[entry.type]) {
      periodMetrics.byType[entry.type] = {
        count: 0,
        successCount: 0,
        failureCount: 0,
        totalTime: 0,
        averageTime: 0
      };
    }
    
    periodMetrics.byType[entry.type].count++;
    
    if (entry.success) {
      periodMetrics.byType[entry.type].successCount++;
    } else {
      periodMetrics.byType[entry.type].failureCount++;
    }
    
    periodMetrics.byType[entry.type].totalTime += entry.duration;
  });
  
  // Calculate averages by type
  Object.keys(periodMetrics.byType).forEach(type => {
    const typeMetrics = periodMetrics.byType[type];
    if (typeMetrics.count > 0) {
      typeMetrics.averageTime = typeMetrics.totalTime / typeMetrics.count;
    }
  });
  
  return {
    startTime,
    endTime,
    ...periodMetrics,
    successRate: periodMetrics.sendCount > 0 ? 
      (periodMetrics.successCount / periodMetrics.sendCount) * 100 : 0,
    failureRate: periodMetrics.sendCount > 0 ? 
      (periodMetrics.failureCount / periodMetrics.sendCount) * 100 : 0
  };
}

module.exports = {
  startNotificationSend,
  recordNotificationMetrics,
  getNotificationMetrics,
  resetMetrics,
  getPerformanceReport
};
