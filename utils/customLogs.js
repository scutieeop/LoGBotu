const { EmbedBuilder } = require('discord.js');
const InMemoryStorage = require('./inMemoryStorage');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const customLogStorage = new InMemoryStorage('customLogs');
const analyticsStorage = new InMemoryStorage('logAnalytics');
class CustomLogs {
  constructor(client) {
    this.client = client;
    this.enabled = true;
    this.logTypes = {
      SYSTEM: 'system',
      SECURITY: 'security',
      COMMAND: 'command',
      API: 'api',
      ERROR: 'error',
      USER_ACTIVITY: 'userActivity',
      PERFORMANCE: 'performance',
      AUTOMATION: 'automation'
    };
    this.severityLevels = {
      DEBUG: { value: 0, color: '#cccccc', emoji: '🔍' },
      INFO: { value: 1, color: '#3498db', emoji: 'ℹ️' },
      NOTICE: { value: 2, color: '#2ecc71', emoji: '📝' },
      WARNING: { value: 3, color: '#f1c40f', emoji: '⚠️' },
      ERROR: { value: 4, color: '#e74c3c', emoji: '❌' },
      CRITICAL: { value: 5, color: '#c0392b', emoji: '🔥' },
      ALERT: { value: 6, color: '#9b59b6', emoji: '🚨' },
      EMERGENCY: { value: 7, color: '#8e44ad', emoji: '☢️' }
    };
    this.defaultThresholds = {
      errorRate: { timeWindow: 60, count: 5, action: 'notify' },
      apiFailures: { timeWindow: 300, count: 10, action: 'notify' },
      highLatency: { threshold: 1000, action: 'log' }
    };
    this.analyticsReportSchedule = 86400000; 
    this.lastAnalyticsReport = Date.now();
    this.initialize();
  }
  async initialize() {
    this.setupAnalyticsTimer();
    console.log('Custom logs system initialized');
    return true;
  }
  setupAnalyticsTimer() {
    setInterval(() => {
      if (Date.now() - this.lastAnalyticsReport >= this.analyticsReportSchedule) {
        this.generateAnalyticsReport();
        this.lastAnalyticsReport = Date.now();
      }
    }, 3600000); 
  }
  async log(type, data) {
    if (!this.enabled) return;
    const logEntry = {
      id: `log_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      type: type || this.logTypes.SYSTEM,
      severity: data.severity || 'INFO',
      guildId: data.guildId || null,
      userId: data.userId || null,
      content: data.content || '',
      details: data.details || {},
      metadata: {
        hostname: os.hostname(),
        platform: os.platform(),
        nodeVersion: process.version,
        uptime: process.uptime()
      }
    };
    const savedLog = customLogStorage.add(logEntry);
    this.updateAnalytics(logEntry);
    this.checkThresholds(logEntry);
    if (data.sendToChannel !== false) {
      await this.sendToChannel(logEntry);
    }
    return savedLog;
  }
  updateAnalytics(logEntry) {
    const today = new Date().toISOString().split('T')[0];
    const key = `${today}_${logEntry.type}_${logEntry.severity}`;
    let analytics = analyticsStorage.get(key);
    if (!analytics) {
      analytics = {
        id: key,
        date: today,
        type: logEntry.type,
        severity: logEntry.severity,
        count: 0,
        guildCounts: {},
        userCounts: {},
        hourlyDistribution: Array(24).fill(0)
      };
    }
    analytics.count++;
    if (logEntry.guildId) {
      analytics.guildCounts[logEntry.guildId] = (analytics.guildCounts[logEntry.guildId] || 0) + 1;
    }
    if (logEntry.userId) {
      analytics.userCounts[logEntry.userId] = (analytics.userCounts[logEntry.userId] || 0) + 1;
    }
    const hour = new Date(logEntry.timestamp).getHours();
    analytics.hourlyDistribution[hour]++;
    analyticsStorage.update(key, analytics);
  }
  checkThresholds(logEntry) {
    if (logEntry.severity === 'ERROR' || logEntry.severity === 'CRITICAL') {
      const timeWindow = this.defaultThresholds.errorRate.timeWindow * 1000;
      const now = Date.now();
      const recentErrorLogs = customLogStorage.find(log => 
        (log.severity === 'ERROR' || log.severity === 'CRITICAL') && 
        (now - new Date(log.timestamp).getTime() <= timeWindow)
      );
      if (recentErrorLogs.length >= this.defaultThresholds.errorRate.count) {
        this.triggerAlert({
          type: 'errorRateExceeded',
          message: `Error rate threshold exceeded: ${recentErrorLogs.length} errors in the last ${this.defaultThresholds.errorRate.timeWindow} seconds`,
          severity: 'ALERT',
          relatedLogs: recentErrorLogs.map(log => log.id)
        });
      }
    }
    if (logEntry.type === this.logTypes.API && logEntry.details.success === false) {
      const timeWindow = this.defaultThresholds.apiFailures.timeWindow * 1000;
      const now = Date.now();
      const recentApiFailures = customLogStorage.find(log => 
        log.type === this.logTypes.API && 
        log.details.success === false && 
        (now - new Date(log.timestamp).getTime() <= timeWindow)
      );
      if (recentApiFailures.length >= this.defaultThresholds.apiFailures.count) {
        this.triggerAlert({
          type: 'apiFailureRateExceeded',
          message: `API failure rate threshold exceeded: ${recentApiFailures.length} failures in the last ${this.defaultThresholds.apiFailures.timeWindow} seconds`,
          severity: 'ALERT',
          relatedLogs: recentApiFailures.map(log => log.id)
        });
      }
    }
    if (logEntry.type === this.logTypes.PERFORMANCE && logEntry.details.latency) {
      if (logEntry.details.latency > this.defaultThresholds.highLatency.threshold) {
        this.triggerAlert({
          type: 'highLatencyDetected',
          message: `High latency detected: ${logEntry.details.latency}ms for operation ${logEntry.details.operation || 'unknown'}`,
          severity: 'WARNING',
          relatedLogs: [logEntry.id]
        });
      }
    }
  }
  async triggerAlert(alertData) {
    console.log(`[ALERT] ${alertData.message}`);
    await this.log(this.logTypes.SYSTEM, {
      severity: alertData.severity || 'ALERT',
      content: alertData.message,
      details: {
        alertType: alertData.type,
        relatedLogs: alertData.relatedLogs
      }
    });
    if (this.client && this.client.config && this.client.config.alertChannelId) {
      const channel = await this.client.channels.fetch(this.client.config.alertChannelId).catch(() => null);
      if (channel) {
        const embed = new EmbedBuilder()
          .setTitle(`${this.severityLevels[alertData.severity]?.emoji || '🚨'} System Alert: ${alertData.type}`)
          .setDescription(alertData.message)
          .setColor(this.severityLevels[alertData.severity]?.color || '#ff0000')
          .setTimestamp();
        await channel.send({ embeds: [embed] });
      }
    }
  }
  async sendToChannel(logEntry) {
    if (!this.client) return;
    let channelId;
    if (logEntry.severity === 'ERROR' || logEntry.severity === 'CRITICAL' || 
        logEntry.severity === 'ALERT' || logEntry.severity === 'EMERGENCY') {
      channelId = this.client.config?.channels?.['error-logs'];
    } else if (logEntry.type === this.logTypes.SECURITY) {
      channelId = this.client.config?.channels?.['security-logs'];
    } else if (logEntry.type === this.logTypes.COMMAND) {
      channelId = this.client.config?.channels?.['command-logs'];
    } else if (logEntry.type === this.logTypes.USER_ACTIVITY) {
      channelId = this.client.config?.channels?.['user-logs'];
    } else {
      channelId = this.client.config?.channels?.['server-logs'];
    }
    if (!channelId) return;
    try {
      const channel = await this.client.channels.fetch(channelId).catch(() => null);
      if (!channel) return;
      const severityInfo = this.severityLevels[logEntry.severity] || this.severityLevels.INFO;
      const embed = new EmbedBuilder()
        .setTitle(`${severityInfo.emoji} ${logEntry.type.toUpperCase()}: ${logEntry.content.substring(0, 100)}`)
        .setDescription(logEntry.content)
        .setColor(severityInfo.color)
        .setTimestamp(new Date(logEntry.timestamp));
      if (logEntry.userId) {
        try {
          const user = await this.client.users.fetch(logEntry.userId).catch(() => null);
          if (user) {
            embed.setAuthor({
              name: user.tag,
              iconURL: user.displayAvatarURL({ dynamic: true })
            });
            embed.addFields({
              name: 'User',
              value: `<@${user.id}> (${user.tag})`,
              inline: true
            });
          }
        } catch (error) {
        }
      }
      if (logEntry.guildId) {
        try {
          const guild = await this.client.guilds.fetch(logEntry.guildId).catch(() => null);
          if (guild) {
            embed.addFields({
              name: 'Server',
              value: guild.name,
              inline: true
            });
          }
        } catch (error) {
        }
      }
      if (logEntry.details && Object.keys(logEntry.details).length > 0) {
        for (const [key, value] of Object.entries(logEntry.details)) {
          if (value == null) continue;
          let formattedValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
          if (formattedValue.length > 1024) {
            formattedValue = formattedValue.substring(0, 1021) + '...';
          }
          embed.addFields({
            name: key.charAt(0).toUpperCase() + key.slice(1),
            value: formattedValue || 'N/A',
            inline: true
          });
        }
      }
      embed.setFooter({
        text: `Log ID: ${logEntry.id.substring(0, 8)} • Type: ${logEntry.type} • Severity: ${logEntry.severity}`
      });
      await channel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Error sending log to channel:', error);
    }
  }
  async generateAnalyticsReport() {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    const yesterdayLogs = analyticsStorage.find(analytics => analytics.date === yesterdayStr);
    if (!yesterdayLogs || yesterdayLogs.length === 0) return;
    let totalLogs = 0;
    const typeBreakdown = {};
    const severityBreakdown = {};
    const topGuilds = {};
    const topUsers = {};
    let hourlyDistribution = Array(24).fill(0);
    yesterdayLogs.forEach(analytics => {
      totalLogs += analytics.count;
      typeBreakdown[analytics.type] = (typeBreakdown[analytics.type] || 0) + analytics.count;
      severityBreakdown[analytics.severity] = (severityBreakdown[analytics.severity] || 0) + analytics.count;
      Object.entries(analytics.guildCounts).forEach(([guildId, count]) => {
        topGuilds[guildId] = (topGuilds[guildId] || 0) + count;
      });
      Object.entries(analytics.userCounts).forEach(([userId, count]) => {
        topUsers[userId] = (topUsers[userId] || 0) + count;
      });
      hourlyDistribution = hourlyDistribution.map((count, i) => count + analytics.hourlyDistribution[i]);
    });
    const sortedGuilds = Object.entries(topGuilds)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const sortedUsers = Object.entries(topUsers)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
    const peakHour = hourlyDistribution.indexOf(Math.max(...hourlyDistribution));
    await this.log(this.logTypes.SYSTEM, {
      severity: 'INFO',
      content: `Daily Log Analytics Report for ${yesterdayStr}`,
      details: {
        totalLogs,
        typeBreakdown,
        severityBreakdown,
        peakHour,
        peakCount: hourlyDistribution[peakHour]
      }
    });
    if (this.client && this.client.config && this.client.config.analyticsChannelId) {
      try {
        const channel = await this.client.channels.fetch(this.client.config.analyticsChannelId).catch(() => null);
        if (channel) {
          const typeBreakdownStr = Object.entries(typeBreakdown)
            .sort((a, b) => b[1] - a[1])
            .map(([type, count]) => `${type}: ${count} (${Math.round(count / totalLogs * 100)}%)`)
            .join('\n');
          const severityBreakdownStr = Object.entries(severityBreakdown)
            .sort((a, b) => {
              const levelA = this.severityLevels[a[0]]?.value || 0;
              const levelB = this.severityLevels[b[0]]?.value || 0;
              return levelB - levelA;
            })
            .map(([severity, count]) => {
              const emoji = this.severityLevels[severity]?.emoji || '•';
              return `${emoji} ${severity}: ${count} (${Math.round(count / totalLogs * 100)}%)`;
            })
            .join('\n');
          const topGuildsStr = await Promise.all(sortedGuilds.map(async ([guildId, count]) => {
            let guildName = guildId;
            try {
              const guild = await this.client.guilds.fetch(guildId).catch(() => null);
              if (guild) guildName = guild.name;
            } catch (error) {
            }
            return `${guildName}: ${count} logs`;
          }));
          const topUsersStr = await Promise.all(sortedUsers.map(async ([userId, count]) => {
            let userName = userId;
            try {
              const user = await this.client.users.fetch(userId).catch(() => null);
              if (user) userName = user.tag;
            } catch (error) {
            }
            return `${userName}: ${count} logs`;
          }));
          const hourLabels = Array.from({ length: 24 }, (_, i) => `${i.toString().padStart(2, '0')}:00`);
          const embed = new EmbedBuilder()
            .setTitle(`📊 Daily Log Analytics Report - ${yesterdayStr}`)
            .setDescription(`**Total Logs:** ${totalLogs}`)
            .addFields(
              { name: '📈 Log Types', value: typeBreakdownStr || 'No data', inline: false },
              { name: '🚨 Severity Levels', value: severityBreakdownStr || 'No data', inline: false },
              { name: '🔍 Peak Activity', value: `Hour: ${peakHour}:00 with ${hourlyDistribution[peakHour]} logs`, inline: false },
              { name: '🏠 Top Servers', value: topGuildsStr.join('\n') || 'No data', inline: true },
              { name: '👤 Top Users', value: topUsersStr.join('\n') || 'No data', inline: true }
            )
            .setColor('#3498db')
            .setTimestamp();
          await channel.send({ embeds: [embed] });
        }
      } catch (error) {
        console.error('Error sending analytics report:', error);
      }
    }
  }
  logCommand(commandName, userId, guildId, success, latency, error = null) {
    return this.log(this.logTypes.COMMAND, {
      severity: error ? 'ERROR' : 'INFO',
      content: `Command executed: ${commandName}`,
      userId,
      guildId,
      details: {
        command: commandName,
        success,
        latency,
        error: error ? error.message : null
      }
    });
  }
  logSecurity(action, userId, guildId, details = {}) {
    return this.log(this.logTypes.SECURITY, {
      severity: details.severity || 'NOTICE',
      content: `Security event: ${action}`,
      userId,
      guildId,
      details: {
        action,
        ...details
      }
    });
  }
  logUserActivity(action, userData, guildId, details = {}) {
    // Handle the case where userData is an object containing user details
    let userId = userData;
    let additionalDetails = {};
    
    if (typeof userData === 'object') {
      userId = userData.userId;
      // Extract useful properties from userData object
      const { username, tag, content, channelId, channelName } = userData;
      additionalDetails = { username, tag, content, channelId, channelName };
    }
    
    // Check for recent duplicate logs (within last 3 seconds)
    const recentDuplicates = customLogStorage.find(log => 
      log.type === this.logTypes.USER_ACTIVITY &&
      log.details.action === action &&
      log.userId === userId &&
      (new Date() - new Date(log.timestamp)) < 3000
    );
    
    // Skip if a recent duplicate exists
    if (recentDuplicates.length > 0) {
      return recentDuplicates[0];
    }
    
    return this.log(this.logTypes.USER_ACTIVITY, {
      severity: details.severity || 'INFO',
      content: `User activity: ${action}`,
      userId,
      guildId,
      details: {
        action,
        ...additionalDetails,
        ...details
      }
    });
  }
  logError(error, context, userId = null, guildId = null) {
    const isOperational = error.isOperational || false;
    return this.log(this.logTypes.ERROR, {
      severity: isOperational ? 'ERROR' : 'CRITICAL',
      content: `Error: ${error.message}`,
      userId,
      guildId,
      details: {
        error: error.message,
        stack: error.stack,
        code: error.code,
        context,
        isOperational
      }
    });
  }
  logPerformance(operation, latency, success, details = {}) {
    return this.log(this.logTypes.PERFORMANCE, {
      severity: latency > 1000 ? 'WARNING' : 'INFO',
      content: `Performance: ${operation}`,
      details: {
        operation,
        latency,
        success,
        ...details
      }
    });
  }
  async getLogsByDateRange(startDate, endDate, type = null, severity = null) {
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();
    return customLogStorage.find(log => {
      const logTime = new Date(log.timestamp).getTime();
      let match = logTime >= start && logTime <= end;
      if (match && type) match = match && log.type === type;
      if (match && severity) match = match && log.severity === severity;
      return match;
    });
  }
  async getLogsByUser(userId, limit = 100) {
    return customLogStorage.find(log => log.userId === userId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }
  async getLogsByGuild(guildId, limit = 100) {
    return customLogStorage.find(log => log.guildId === guildId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }
  async exportLogs(type = null, startDate = null, endDate = null) {
    const logs = customLogStorage.find(log => {
      let match = true;
      if (type) match = match && log.type === type;
      if (startDate) {
        const start = new Date(startDate).getTime();
        match = match && new Date(log.timestamp).getTime() >= start;
      }
      if (endDate) {
        const end = new Date(endDate).getTime();
        match = match && new Date(log.timestamp).getTime() <= end;
      }
      return match;
    });
    if (logs.length === 0) return null;
    const filePath = path.join(
      os.tmpdir(),
      `logs_export_${new Date().toISOString().replace(/:/g, '-')}.json`
    );
    await fs.writeFile(filePath, JSON.stringify(logs, null, 2));
    return filePath;
  }
}
module.exports = CustomLogs; 