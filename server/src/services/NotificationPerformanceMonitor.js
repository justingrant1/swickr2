/**
 * NotificationPerformanceMonitor
 * 
 * Service for tracking and analyzing push notification performance metrics
 * Aligns with Swickr's focus on speed and performance
 */

const redis = require('../config/redis');
const logger = require('../utils/logger');

// Redis keys
const METRICS_KEY = 'notification:performance:metrics';
const EVENTS_KEY = 'notification:performance:events';
const HOURLY_STATS_KEY = 'notification:performance:hourly';
const DAILY_STATS_KEY = 'notification:performance:daily';

class NotificationPerformanceMonitor {
  /**
   * Start tracking a notification send
   * @param {string} notificationId - Unique ID for the notification
   * @returns {Function} Function to call when notification send completes
   */
  static startNotificationSend(notificationId) {
    const startTime = Date.now();
    
    // Return a function to call when the notification send completes
    return async (success = true, type = 'unknown', failureReason = null) => {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      try {
        // Record the notification event
        await this.recordNotificationEvent({
          id: notificationId,
          type,
          success,
          duration,
          startTime,
          endTime,
          failureReason: success ? null : failureReason
        });
        
        // Update aggregate metrics
        await this.updateAggregateMetrics({
          success,
          duration,
          type,
          failureReason
        });
        
        // Log performance data for monitoring
        if (duration > 500) {
          // Log slow notifications (over 500ms)
          logger.warn(`Slow notification delivery (${duration}ms): ${notificationId}`);
        }
        
        if (!success) {
          // Log failed notifications
          logger.error(`Notification delivery failed: ${notificationId}, reason: ${failureReason}`);
        }
      } catch (error) {
        logger.error('Error recording notification performance:', error);
      }
    };
  }
  
  /**
   * Record a notification event
   * @param {Object} event - Notification event data
   */
  static async recordNotificationEvent(event) {
    try {
      // Store event in Redis
      // Use a capped list to prevent unbounded growth
      const redisClient = await redis.getClient();
      
      // Add to events list (newest first)
      await redisClient.lPush(EVENTS_KEY, JSON.stringify({
        ...event,
        timestamp: Date.now()
      }));
      
      // Cap the list at 1000 events
      await redisClient.lTrim(EVENTS_KEY, 0, 999);
      
      // Update time-based stats
      await this.updateTimeBasedStats(event);
    } catch (error) {
      logger.error('Error recording notification event:', error);
    }
  }
  
  /**
   * Update aggregate metrics
   * @param {Object} data - Notification data
   */
  static async updateAggregateMetrics(data) {
    try {
      const redisClient = await redis.getClient();
      
      // Get current metrics or initialize if not exists
      let metrics = await redisClient.get(METRICS_KEY);
      metrics = metrics ? JSON.parse(metrics) : {
        totalCount: 0,
        successCount: 0,
        failureCount: 0,
        totalDuration: 0,
        maxDuration: 0,
        minDuration: Infinity,
        typeBreakdown: {},
        failureReasons: {},
        lastUpdated: Date.now()
      };
      
      // Update metrics
      metrics.totalCount++;
      if (data.success) {
        metrics.successCount++;
      } else {
        metrics.failureCount++;
        
        // Track failure reasons
        const reason = data.failureReason || 'unknown';
        metrics.failureReasons[reason] = (metrics.failureReasons[reason] || 0) + 1;
      }
      
      // Update duration stats
      metrics.totalDuration += data.duration;
      metrics.maxDuration = Math.max(metrics.maxDuration, data.duration);
      metrics.minDuration = Math.min(metrics.minDuration, data.duration);
      
      // Update type breakdown
      const type = data.type || 'unknown';
      metrics.typeBreakdown[type] = metrics.typeBreakdown[type] || {
        count: 0,
        successCount: 0,
        failureCount: 0,
        totalDuration: 0
      };
      
      metrics.typeBreakdown[type].count++;
      if (data.success) {
        metrics.typeBreakdown[type].successCount++;
      } else {
        metrics.typeBreakdown[type].failureCount++;
      }
      metrics.typeBreakdown[type].totalDuration += data.duration;
      
      // Update last updated timestamp
      metrics.lastUpdated = Date.now();
      
      // Save updated metrics
      await redisClient.set(METRICS_KEY, JSON.stringify(metrics));
    } catch (error) {
      logger.error('Error updating notification metrics:', error);
    }
  }
  
  /**
   * Update time-based statistics (hourly and daily)
   * @param {Object} event - Notification event
   */
  static async updateTimeBasedStats(event) {
    try {
      const redisClient = await redis.getClient();
      const timestamp = event.timestamp || Date.now();
      
      // Get hour and day keys
      const hourKey = `${HOURLY_STATS_KEY}:${new Date(timestamp).toISOString().slice(0, 13)}`;
      const dayKey = `${DAILY_STATS_KEY}:${new Date(timestamp).toISOString().slice(0, 10)}`;
      
      // Update hourly stats
      await this.updateTimeStats(redisClient, hourKey, event);
      
      // Update daily stats
      await this.updateTimeStats(redisClient, dayKey, event);
      
      // Set expiration for hourly stats (3 days)
      await redisClient.expire(hourKey, 3 * 24 * 60 * 60);
      
      // Set expiration for daily stats (30 days)
      await redisClient.expire(dayKey, 30 * 24 * 60 * 60);
    } catch (error) {
      logger.error('Error updating time-based stats:', error);
    }
  }
  
  /**
   * Update stats for a specific time period
   * @param {Object} redisClient - Redis client
   * @param {string} key - Redis key for the time period
   * @param {Object} event - Notification event
   */
  static async updateTimeStats(redisClient, key, event) {
    // Get current stats or initialize if not exists
    let stats = await redisClient.get(key);
    stats = stats ? JSON.parse(stats) : {
      totalCount: 0,
      successCount: 0,
      failureCount: 0,
      totalDuration: 0,
      typeBreakdown: {},
      failureReasons: {}
    };
    
    // Update stats
    stats.totalCount++;
    if (event.success) {
      stats.successCount++;
    } else {
      stats.failureCount++;
      
      // Track failure reasons
      const reason = event.failureReason || 'unknown';
      stats.failureReasons[reason] = (stats.failureReasons[reason] || 0) + 1;
    }
    
    // Update duration stats
    stats.totalDuration += event.duration;
    
    // Update type breakdown
    const type = event.type || 'unknown';
    stats.typeBreakdown[type] = stats.typeBreakdown[type] || {
      count: 0,
      successCount: 0,
      failureCount: 0,
      totalDuration: 0
    };
    
    stats.typeBreakdown[type].count++;
    if (event.success) {
      stats.typeBreakdown[type].successCount++;
    } else {
      stats.typeBreakdown[type].failureCount++;
    }
    stats.typeBreakdown[type].totalDuration += event.duration;
    
    // Save updated stats
    await redisClient.set(key, JSON.stringify(stats));
  }
  
  /**
   * Get current performance metrics
   * @returns {Object} Current performance metrics
   */
  static async getPerformanceMetrics() {
    try {
      const redisClient = await redis.getClient();
      
      // Get current metrics
      const metrics = await redisClient.get(METRICS_KEY);
      
      if (!metrics) {
        return {
          totalCount: 0,
          successCount: 0,
          failureCount: 0,
          averageDuration: 0,
          successRate: 100,
          typeBreakdown: {},
          failureReasons: {},
          lastUpdated: null
        };
      }
      
      const parsedMetrics = JSON.parse(metrics);
      
      // Calculate derived metrics
      const averageDuration = parsedMetrics.totalCount > 0 
        ? parsedMetrics.totalDuration / parsedMetrics.totalCount 
        : 0;
        
      const successRate = parsedMetrics.totalCount > 0 
        ? (parsedMetrics.successCount / parsedMetrics.totalCount) * 100 
        : 100;
      
      return {
        ...parsedMetrics,
        averageDuration,
        successRate
      };
    } catch (error) {
      logger.error('Error getting notification performance metrics:', error);
      return null;
    }
  }
  
  /**
   * Get performance report for a specific time period
   * @param {number} startTime - Start timestamp
   * @param {number} endTime - End timestamp
   * @returns {Object} Performance report
   */
  static async getPerformanceReport(startTime, endTime) {
    try {
      const redisClient = await redis.getClient();
      
      // Get events within the time range
      const events = await redisClient.lRange(EVENTS_KEY, 0, -1);
      
      // Filter and parse events
      const filteredEvents = events
        .map(event => JSON.parse(event))
        .filter(event => {
          const timestamp = event.timestamp || event.startTime;
          return timestamp >= startTime && timestamp <= endTime;
        });
      
      // Calculate report metrics
      const totalCount = filteredEvents.length;
      const successCount = filteredEvents.filter(e => e.success).length;
      const failureCount = totalCount - successCount;
      
      const totalDuration = filteredEvents.reduce((sum, e) => sum + e.duration, 0);
      const averageDuration = totalCount > 0 ? totalDuration / totalCount : 0;
      
      const successRate = totalCount > 0 ? (successCount / totalCount) * 100 : 100;
      
      // Calculate type breakdown
      const typeBreakdown = {};
      filteredEvents.forEach(event => {
        const type = event.type || 'unknown';
        typeBreakdown[type] = typeBreakdown[type] || {
          count: 0,
          successCount: 0,
          failureCount: 0,
          totalDuration: 0
        };
        
        typeBreakdown[type].count++;
        if (event.success) {
          typeBreakdown[type].successCount++;
        } else {
          typeBreakdown[type].failureCount++;
        }
        typeBreakdown[type].totalDuration += event.duration;
      });
      
      // Calculate failure reasons
      const failureReasons = {};
      filteredEvents
        .filter(e => !e.success)
        .forEach(event => {
          const reason = event.failureReason || 'unknown';
          failureReasons[reason] = (failureReasons[reason] || 0) + 1;
        });
      
      return {
        totalCount,
        successCount,
        failureCount,
        totalDuration,
        averageDuration,
        successRate,
        typeBreakdown,
        failureReasons,
        timeRange: {
          start: startTime,
          end: endTime
        }
      };
    } catch (error) {
      logger.error('Error generating performance report:', error);
      return null;
    }
  }
  
  /**
   * Get recent notification events
   * @param {number} limit - Maximum number of events to return
   * @returns {Array} Recent notification events
   */
  static async getRecentEvents(limit = 100) {
    try {
      const redisClient = await redis.getClient();
      
      // Get recent events
      const events = await redisClient.lRange(EVENTS_KEY, 0, limit - 1);
      
      // Parse events
      return events.map(event => JSON.parse(event));
    } catch (error) {
      logger.error('Error getting recent notification events:', error);
      return [];
    }
  }
  
  /**
   * Get hourly statistics for a date range
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Object} Hourly statistics
   */
  static async getHourlyStats(startDate, endDate) {
    try {
      const redisClient = await redis.getClient();
      const stats = {};
      
      // Generate all hour keys in the range
      const start = new Date(startDate);
      const end = new Date(endDate);
      end.setHours(23); // Include the full end day
      
      for (let date = new Date(start); date <= end; date.setHours(date.getHours() + 1)) {
        const hourKey = `${HOURLY_STATS_KEY}:${date.toISOString().slice(0, 13)}`;
        const hourStats = await redisClient.get(hourKey);
        
        if (hourStats) {
          stats[date.toISOString().slice(0, 13)] = JSON.parse(hourStats);
        }
      }
      
      return stats;
    } catch (error) {
      logger.error('Error getting hourly stats:', error);
      return {};
    }
  }
  
  /**
   * Get daily statistics for a date range
   * @param {string} startDate - Start date (YYYY-MM-DD)
   * @param {string} endDate - End date (YYYY-MM-DD)
   * @returns {Object} Daily statistics
   */
  static async getDailyStats(startDate, endDate) {
    try {
      const redisClient = await redis.getClient();
      const stats = {};
      
      // Generate all day keys in the range
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
        const dayKey = `${DAILY_STATS_KEY}:${date.toISOString().slice(0, 10)}`;
        const dayStats = await redisClient.get(dayKey);
        
        if (dayStats) {
          stats[date.toISOString().slice(0, 10)] = JSON.parse(dayStats);
        }
      }
      
      return stats;
    } catch (error) {
      logger.error('Error getting daily stats:', error);
      return {};
    }
  }
  
  /**
   * Reset all performance metrics
   * @returns {boolean} Success status
   */
  static async resetMetrics() {
    try {
      const redisClient = await redis.getClient();
      
      // Delete all metrics keys
      await redisClient.del(METRICS_KEY);
      await redisClient.del(EVENTS_KEY);
      
      // Log the reset
      logger.info('Notification performance metrics reset');
      
      return true;
    } catch (error) {
      logger.error('Error resetting notification metrics:', error);
      return false;
    }
  }
}

module.exports = NotificationPerformanceMonitor;
