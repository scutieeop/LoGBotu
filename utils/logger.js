const { EmbedBuilder, WebhookClient, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const os = require('os');
class Logger {
  constructor(options = {}) {
    this.logChannels = options.logChannels || {};
    this.webhooks = options.webhooks || {};
    this.logDir = options.logDir || './logs';
    this.maxLogSize = options.maxLogSize || 10000;
    this.maxFileSize = options.maxFileSize || 5 * 1024 * 1024;
    this.dailySummary = options.dailySummary || true;
    this.dailySummaryChannel = options.dailySummaryChannel || null;
    this.initialized = false;
    this.logs = {
      message: [],
      member: [],
      channel: [],
      role: [],
      voice: [],
      server: []
    };
    this.stats = {
      messages: { created: 0, deleted: 0, edited: 0 },
      members: { joined: 0, left: 0, updated: 0, banned: 0, unbanned: 0 },
      channels: { created: 0, deleted: 0, updated: 0 },
      roles: { created: 0, deleted: 0, updated: 0 },
      voices: { joined: 0, left: 0, muted: 0, unmuted: 0 },
      total: 0
    };
    this.alarmPatterns = new Map();
    this.userTracker = new Map();
    this.monitoring = {
      patterns: [],
      thresholds: {
        messages: { perSecond: 10, perMinute: 100 },
        members: { joins: 20, leaves: 20 },
        channels: { deletes: 3 },
        roles: { deletes: 3 }
      },
      counters: {
        messages: { last: 0, count: 0 },
        members: { joins: 0, leaves: 0 },
        channels: { deletes: 0 },
        roles: { deletes: 0 }
      }
    };
    this.lastSummaryDate = null;
  }
  async initialize() {
    this.ensureLogDirectoryExists();
    await this.loadLogs();
    this.initializeWebhooks();
    if (this.dailySummary) {
      this.scheduleDailySummary();
    }
    this.initialized = true;
    console.log('📝 Logger sistemi başlatıldı.');
    return true;
  }
  initializeWebhooks() {
    for (const [logType, webhookValue] of Object.entries(this.webhooks)) {
      try {
        if (typeof webhookValue === 'string') {
          if (webhookValue.startsWith('https://discord.com/api/webhooks/')) {
            this.webhooks[logType] = new WebhookClient({ url: webhookValue });
          } else {
            console.log(`${logType} için webhook ID algılandı, tam URL gerekli.`);
            this.webhooks[logType] = null;
          }
        } else {
          console.error(`${logType} webhook değeri geçersiz.`);
          this.webhooks[logType] = null;
        }
      } catch (error) {
        console.error(`${logType} webhook bağlantısı kurulamadı:`, error);
        this.webhooks[logType] = null;
      }
    }
  }
  ensureLogDirectoryExists() {
    if (!fsSync.existsSync(this.logDir)) {
      fsSync.mkdirSync(this.logDir, { recursive: true });
    }
    Object.keys(this.logs).forEach(logType => {
      const typePath = path.join(this.logDir, logType);
      if (!fsSync.existsSync(typePath)) {
        fsSync.mkdirSync(typePath, { recursive: true });
      }
    });
  }
  async saveLogs() {
    for (const [logType, logs] of Object.entries(this.logs)) {
      if (logs.length === 0) continue;
      const date = new Date();
      const fileName = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}.json`;
      const filePath = path.join(this.logDir, logType, fileName);
      try {
        let existingLogs = [];
        if (fsSync.existsSync(filePath)) {
          const fileContent = await fs.readFile(filePath, 'utf8');
          existingLogs = JSON.parse(fileContent);
        }
        existingLogs = [...existingLogs, ...logs];
        if (existingLogs.length > this.maxLogSize) {
          existingLogs = existingLogs.slice(-this.maxLogSize);
        }
        await fs.writeFile(filePath, JSON.stringify(existingLogs, null, 2), 'utf8');
        this.logs[logType] = [];
      } catch (error) {
        console.error(`${logType} logları kaydedilirken hata oluştu:`, error);
      }
    }
  }
  async loadLogs() {
    for (const logType of Object.keys(this.logs)) {
      const typePath = path.join(this.logDir, logType);
      if (!fsSync.existsSync(typePath)) continue;
      try {
        const files = await fs.readdir(typePath)
          .then(files => files.filter(file => file.endsWith('.json')))
          .then(files => files.sort((a, b) => b.localeCompare(a)));
        if (files.length === 0) continue;
        const lastFile = files[0];
        const filePath = path.join(typePath, lastFile);
        const fileContent = await fs.readFile(filePath, 'utf8');
        const logs = JSON.parse(fileContent);
        this.logs[logType] = logs.slice(-100);
      } catch (error) {
        console.error(`${logType} logları yüklenirken hata oluştu:`, error);
      }
    }
  }
  scheduleDailySummary() {
    setInterval(() => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      if ((!this.lastSummaryDate || this.lastSummaryDate < today) && now.getHours() === 0) {
        this.createDailySummary();
        this.lastSummaryDate = today;
      }
    }, 30 * 60 * 1000);
  }
  async createDailySummary() {
    if (!this.dailySummaryChannel) return;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const dateString = `${yesterday.getFullYear()}-${(yesterday.getMonth() + 1).toString().padStart(2, '0')}-${yesterday.getDate().toString().padStart(2, '0')}`;
    const stats = {
      messages: { created: 0, deleted: 0, edited: 0 },
      members: { joined: 0, left: 0, updated: 0, banned: 0, unbanned: 0 },
      channels: { created: 0, deleted: 0, updated: 0 },
      roles: { created: 0, deleted: 0, updated: 0 },
      voices: { joined: 0, left: 0, muted: 0, unmuted: 0 },
      total: 0
    };
    for (const logType of Object.keys(this.logs)) {
      const filePath = path.join(this.logDir, logType, `${dateString}.json`);
      if (!fsSync.existsSync(filePath)) continue;
      try {
        const fileContent = await fs.readFile(filePath, 'utf8');
        const logs = JSON.parse(fileContent);
        logs.forEach(log => {
          if (logType === 'message') {
            if (log.action === 'create') stats.messages.created++;
            else if (log.action === 'delete') stats.messages.deleted++;
            else if (log.action === 'update') stats.messages.edited++;
          }
          else if (logType === 'member') {
            if (log.action === 'join') stats.members.joined++;
            else if (log.action === 'leave') stats.members.left++;
            else if (log.action === 'update') stats.members.updated++;
            else if (log.action === 'ban') stats.members.banned++;
            else if (log.action === 'unban') stats.members.unbanned++;
          }
          else if (logType === 'channel') {
            if (log.action === 'create') stats.channels.created++;
            else if (log.action === 'delete') stats.channels.deleted++;
            else if (log.action === 'update') stats.channels.updated++;
          }
          else if (logType === 'role') {
            if (log.action === 'create') stats.roles.created++;
            else if (log.action === 'delete') stats.roles.deleted++;
            else if (log.action === 'update') stats.roles.updated++;
          }
          else if (logType === 'voice') {
            if (log.action === 'join') stats.voices.joined++;
            else if (log.action === 'leave') stats.voices.left++;
            else if (log.action === 'mute') stats.voices.muted++;
            else if (log.action === 'unmute') stats.voices.unmuted++;
          }
          stats.total++;
        });
      } catch (error) {
        console.error(`${logType} log özeti hesaplanırken hata oluştu:`, error);
      }
    }
    const embed = new EmbedBuilder()
      .setTitle(`📊 Günlük Log Özeti - ${dateString}`)
      .setDescription(`Dün gerçekleşen toplam **${stats.total}** log kaydı bulunmaktadır.`)
      .setColor('#5865F2')
      .setTimestamp()
      .addFields(
        {
          name: '📝 Mesajlar',
          value: `Gönderildi: ${stats.messages.created}\nSilindi: ${stats.messages.deleted}\nDüzenlendi: ${stats.messages.edited}`,
          inline: true
        },
        {
          name: '👥 Üyeler',
          value: `Katıldı: ${stats.members.joined}\nAyrıldı: ${stats.members.left}\nGüncellendi: ${stats.members.updated}\nYasaklandı: ${stats.members.banned}\nYasak Kaldırıldı: ${stats.members.unbanned}`,
          inline: true
        },
        {
          name: '🔊 Ses Aktiviteleri',
          value: `Katıldı: ${stats.voices.joined}\nAyrıldı: ${stats.voices.left}\nSusturuldu: ${stats.voices.muted}\nSusturma Kaldırıldı: ${stats.voices.unmuted}`,
          inline: true
        },
        {
          name: '📢 Kanallar',
          value: `Oluşturuldu: ${stats.channels.created}\nSilindi: ${stats.channels.deleted}\nGüncellendi: ${stats.channels.updated}`,
          inline: true
        },
        {
          name: '👑 Roller',
          value: `Oluşturuldu: ${stats.roles.created}\nSilindi: ${stats.roles.deleted}\nGüncellendi: ${stats.roles.updated}`,
          inline: true
        }
      );
    const webhook = this.webhooks[this.dailySummaryChannel];
    if (webhook) {
      await webhook.send({
        embeds: [embed]
      });
    }
  }
  async log(logData) {
    if (!this.initialized) {
      await this.initialize();
    }
    const { logType, action, timestamp } = logData;
    if (!this.logs[logType]) {
      console.error(`Geçersiz log tipi: ${logType}`);
      return false;
    }
    const logEntry = {
      id: uuidv4(),
      timestamp: timestamp || new Date().toISOString(),
      ...logData
    };
    this.logs[logType].push(logEntry);
    this.updateStats(logType, action);
    this.checkAlarms(logEntry);
    this.checkUserTracking(logEntry);
    if (this.logs[logType].length >= 100) {
      await this.saveLogs();
    }
    await this.sendLogToChannel(logEntry);
    return true;
  }
  updateStats(logType, action) {
    this.stats.total++;
    if (logType === 'message') {
      if (action === 'create') this.stats.messages.created++;
      else if (action === 'delete') this.stats.messages.deleted++;
      else if (action === 'update') this.stats.messages.edited++;
    }
    else if (logType === 'member') {
      if (action === 'join') this.stats.members.joined++;
      else if (action === 'leave') this.stats.members.left++;
      else if (action === 'update') this.stats.members.updated++;
      else if (action === 'ban') this.stats.members.banned++;
      else if (action === 'unban') this.stats.members.unbanned++;
    }
    else if (logType === 'channel') {
      if (action === 'create') this.stats.channels.created++;
      else if (action === 'delete') this.stats.channels.deleted++;
      else if (action === 'update') this.stats.channels.updated++;
    }
    else if (logType === 'role') {
      if (action === 'create') this.stats.roles.created++;
      else if (action === 'delete') this.stats.roles.deleted++;
      else if (action === 'update') this.stats.roles.updated++;
    }
    else if (logType === 'voice') {
      if (action === 'join') this.stats.voices.joined++;
      else if (action === 'leave') this.stats.voices.left++;
      else if (action === 'mute') this.stats.voices.muted++;
      else if (action === 'unmute') this.stats.voices.unmuted++;
    }
  }
  async sendLogToChannel(logEntry) {
    const { logType } = logEntry;
    if (!this.webhooks[logType]) return;
    try {
      const embed = this.createLogEmbed(logEntry);
      await this.webhooks[logType].send({
        embeds: [embed]
      });
    } catch (error) {
      console.error(`Log webhook'a gönderilirken hata oluştu:`, error);
    }
  }
  createLogEmbed(logEntry) {
    const { logType, action, timestamp, user, target, content, reason, channel, changes } = logEntry;
    let color = '#5865F2';
    let title = 'Log Kaydı';
    if (action === 'create' || action === 'join' || action === 'add') {
      color = '#43B581';
    } else if (action === 'delete' || action === 'leave' || action === 'remove' || action === 'ban') {
      color = '#F04747';
    } else if (action === 'update' || action === 'edit') {
      color = '#FAA61A';
    }
    if (logType === 'message') {
      if (action === 'create') title = '📝 Mesaj Gönderildi';
      else if (action === 'delete') title = '🗑️ Mesaj Silindi';
      else if (action === 'update') title = '✏️ Mesaj Düzenlendi';
    }
    else if (logType === 'member') {
      if (action === 'join') title = '📥 Üye Katıldı';
      else if (action === 'leave') title = '📤 Üye Ayrıldı';
      else if (action === 'update') title = '👤 Üye Güncellendi';
      else if (action === 'ban') title = '🔨 Üye Yasaklandı';
      else if (action === 'unban') title = '🔓 Yasak Kaldırıldı';
    }
    else if (logType === 'channel') {
      if (action === 'create') title = '📢 Kanal Oluşturuldu';
      else if (action === 'delete') title = '📢 Kanal Silindi';
      else if (action === 'update') title = '📢 Kanal Güncellendi';
    }
    else if (logType === 'role') {
      if (action === 'create') title = '👑 Rol Oluşturuldu';
      else if (action === 'delete') title = '👑 Rol Silindi';
      else if (action === 'update') title = '👑 Rol Güncellendi';
      else if (action === 'add') title = '👑 Rol Verildi';
      else if (action === 'remove') title = '👑 Rol Alındı';
    }
    else if (logType === 'voice') {
      if (action === 'join') title = '🔊 Ses Kanalına Katıldı';
      else if (action === 'leave') title = '🔊 Ses Kanalından Ayrıldı';
      else if (action === 'mute') title = '🔇 Sessize Alındı';
      else if (action === 'unmute') title = '🔈 Ses Açıldı';
    }
    const embed = new EmbedBuilder()
      .setTitle(title)
      .setColor(color)
      .setTimestamp(new Date(timestamp))
      .setFooter({ text: `ID: ${logEntry.id.substring(0, 8)}` });
    if (user) {
      const userStr = typeof user === 'string' ? user : `<@${user.id}>`;
      embed.setAuthor({ name: `${typeof user === 'string' ? user : user.username}`, iconURL: typeof user === 'object' && user.avatarURL ? user.avatarURL() : undefined });
    }
    let description = '';
    if (user) {
      const userStr = typeof user === 'string' ? user : `<@${user.id}>`;
      description += `**Kullanıcı:** ${userStr}\n`;
    }
    if (target) {
      const targetStr = typeof target === 'string' ? target : (target.name || `<@${target.id}>`);
      description += `**Hedef:** ${targetStr}\n`;
    }
    if (channel) {
      const channelStr = typeof channel === 'string' ? channel : `<#${channel.id}>`;
      description += `**Kanal:** ${channelStr}\n`;
    }
    if (content) {
      description += `**İçerik:** ${content}\n`;
    }
    if (reason) {
      description += `**Sebep:** ${reason}\n`;
    }
    if (changes && Object.keys(changes).length > 0) {
      description += '\n**Değişiklikler:**\n';
      for (const [key, value] of Object.entries(changes)) {
        if (value.old !== undefined && value.new !== undefined) {
          description += `• **${key}:** \`${value.old}\` → \`${value.new}\`\n`;
        } else {
          description += `• **${key}:** \`${value}\`\n`;
        }
      }
    }
    embed.setDescription(description);
    return embed;
  }
  checkAlarms(logEntry) {
    if (!this.alarmPatterns || this.alarmPatterns.size === 0) {
      return;
    }
    for (const [alarmId, alarm] of this.alarmPatterns.entries()) {
      const { pattern, action, enabled } = alarm;
      if (enabled === false) continue;
      let match = true;
      if (pattern.logType && pattern.logType !== logEntry.logType) {
        match = false;
      }
      if (match && pattern.userId) {
        const userId = typeof logEntry.user === 'string' ? logEntry.user : (logEntry.user?.id || '');
        if (pattern.userId !== userId) {
          match = false;
        }
      }
      if (match && pattern.content && logEntry.content) {
        try {
          const regex = new RegExp(pattern.content, 'i');
          if (!regex.test(logEntry.content)) {
            match = false;
          }
        } catch (e) {
          if (!logEntry.content.includes(pattern.content)) {
            match = false;
          }
        }
      }
      if (match && pattern.roleId) {
        let roleMatch = false;
        if (logEntry.target && logEntry.target.id === pattern.roleId) {
          roleMatch = true;
        } else if (logEntry.changes && logEntry.changes.roles) {
          const roleChanges = logEntry.changes.roles;
          if (Array.isArray(roleChanges.added) && roleChanges.added.includes(pattern.roleId)) {
            roleMatch = true;
          } else if (Array.isArray(roleChanges.removed) && roleChanges.removed.includes(pattern.roleId)) {
            roleMatch = true;
          }
        }
        if (!roleMatch) {
          match = false;
        }
      }
      if (match) {
        this.triggerAlarm(alarmId, alarm, logEntry);
      }
    }
  }
  async triggerAlarm(alarmId, alarm, logEntry) {
    const { action } = alarm;
    if (action.notifyChannelId) {
      const webhook = this.webhooks[action.notifyChannelId] || this.webhooks['server'];
      if (webhook) {
        const embed = new EmbedBuilder()
          .setTitle(action.title || '⚠️ Log Alarmı')
          .setDescription(action.description || 'Bir log alarmı tetiklendi.')
          .setColor(action.color || '#FF5555')
          .setTimestamp()
          .setFooter({ text: `Alarm ID: ${alarmId.substring(0, 8)}` });
        let logInfo = '';
        if (logEntry.user) {
          const userStr = typeof logEntry.user === 'string' ? logEntry.user : `<@${logEntry.user.id}>`;
          logInfo += `**Kullanıcı:** ${userStr}\n`;
        }
        if (logEntry.action) {
          logInfo += `**İşlem:** ${logEntry.action}\n`;
        }
        if (logEntry.target) {
          const targetStr = typeof logEntry.target === 'string' ? logEntry.target : (logEntry.target.name || `<@${logEntry.target.id}>`);
          logInfo += `**Hedef:** ${targetStr}\n`;
        }
        if (logEntry.channel) {
          const channelStr = typeof logEntry.channel === 'string' ? logEntry.channel : `<#${logEntry.channel.id}>`;
          logInfo += `**Kanal:** ${channelStr}\n`;
        }
        if (logEntry.content) {
          logInfo += `**İçerik:** ${logEntry.content}\n`;
        }
        embed.addFields({
          name: '📝 Log Detayları',
          value: logInfo || 'Detay bulunamadı.',
          inline: false
        });
        await webhook.send({
          embeds: [embed]
        });
      }
    }
  }
  addAlarmPattern(pattern, action) {
    const alarmId = uuidv4();
    this.alarmPatterns.set(alarmId, {
      pattern,
      action,
      enabled: true,
      created: new Date().toISOString()
    });
    return alarmId;
  }
  checkUserTracking(logEntry) {
    if (!this.userTracker || this.userTracker.size === 0) {
      return;
    }
    const userId = typeof logEntry.user === 'string' ? logEntry.user : (logEntry.user?.id || '');
    if (!userId) return;
    const tracker = this.userTracker.get(userId);
    if (!tracker || !tracker.enabled) return;
    if (
      (logEntry.logType === 'message' && !tracker.trackMessages) ||
      (logEntry.logType === 'voice' && !tracker.trackVoice) ||
      (logEntry.logType === 'member' && !tracker.trackMember)
    ) {
      return;
    }
    tracker.logs.push({
      timestamp: logEntry.timestamp,
      logType: logEntry.logType,
      action: logEntry.action,
      content: logEntry.content,
      channel: logEntry.channel
    });
    if (tracker.notifyChannel && this.webhooks[tracker.notifyChannel]) {
      const webhook = this.webhooks[tracker.notifyChannel];
      const embed = new EmbedBuilder()
        .setTitle(`👁️ İzlenen Kullanıcı Aktivitesi`)
        .setDescription(`<@${userId}> kullanıcısının bir aktivitesi kaydedildi.`)
        .setColor('#FF5555')
        .setTimestamp()
        .setFooter({ text: `İzleme ID: ${userId}` });
      let logInfo = '';
      if (logEntry.action) {
        logInfo += `**İşlem:** ${logEntry.action}\n`;
      }
      if (logEntry.logType) {
        logInfo += `**Log Türü:** ${logEntry.logType}\n`;
      }
      if (logEntry.target) {
        const targetStr = typeof logEntry.target === 'string' ? logEntry.target : (logEntry.target.name || `<@${logEntry.target.id}>`);
        logInfo += `**Hedef:** ${targetStr}\n`;
      }
      if (logEntry.channel) {
        const channelStr = typeof logEntry.channel === 'string' ? logEntry.channel : `<#${logEntry.channel.id}>`;
        logInfo += `**Kanal:** ${channelStr}\n`;
      }
      if (logEntry.content) {
        logInfo += `**İçerik:** ${logEntry.content}\n`;
      }
      embed.addFields({
        name: '📝 Aktivite Detayları',
        value: logInfo || 'Detay bulunamadı.',
        inline: false
      });
      webhook.send({
        embeds: [embed]
      });
    }
  }
  addUserTracker(userId, options = {}) {
    if (!userId) return false;
    const defaultOptions = {
      notifyChannel: null,
      reason: 'Güvenlik izlemesi',
      trackMessages: true,
      trackVoice: true,
      trackMember: true,
      enabled: true
    };
    const trackerOptions = { ...defaultOptions, ...options };
    this.userTracker.set(userId, {
      ...trackerOptions,
      startedAt: new Date().toISOString(),
      logs: []
    });
    return true;
  }
  removeUserTracker(userId) {
    if (!userId || !this.userTracker.has(userId)) {
      return false;
    }
    this.userTracker.delete(userId);
    return true;
  }
  getStats() {
    return this.stats;
  }
  searchLogs(options = {}) {
    const { logType, from, to, userId, action, limit = 100, content, targetId } = options;
    if (!logType || !this.logs[logType]) {
      return [];
    }
    let fromDate = from ? new Date(from) : new Date(0);
    let toDate = to ? new Date(to) : new Date();
    let filteredLogs = [...this.logs[logType]];
    filteredLogs = filteredLogs.filter(log => {
      const logDate = new Date(log.timestamp);
      if (logDate < fromDate || logDate > toDate) {
        return false;
      }
      if (userId) {
        const logUserId = typeof log.user === 'string' ? log.user : (log.user?.id || '');
        if (logUserId !== userId) {
          return false;
        }
      }
      if (action && log.action !== action) {
        return false;
      }
      if (content && log.content) {
        if (!log.content.includes(content)) {
          return false;
        }
      }
      if (targetId) {
        const logTargetId = typeof log.target === 'string' ? log.target : (log.target?.id || '');
        if (logTargetId !== targetId) {
          return false;
        }
      }
      return true;
    });
    filteredLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return filteredLogs.slice(0, limit);
  }
  async flushLogs() {
    await this.saveLogs();
    return true;
  }
  async guild_formatChannel(channel) {
    return {
      id: channel.id,
      name: channel.name,
      type: channel.type,
      parentId: channel.parentId,
      position: channel.position,
      nsfw: channel.nsfw || false,
      createdAt: channel.createdAt,
      permissionOverwrites: channel.permissionOverwrites ? 
        Array.from(channel.permissionOverwrites.cache.values()).map(p => ({
          id: p.id,
          type: p.type,
          allow: p.allow ? p.allow.toArray() : [],
          deny: p.deny ? p.deny.toArray() : []
        })) : []
    };
  }
  async guild_formatUser(user) {
    if (!user) return null;
    return {
      id: user.id,
      name: user.username || user.user?.username,
      tag: user.tag || user.user?.tag || `${user.username || user.user?.username}`,
      bot: user.bot || user.user?.bot || false,
      system: user.system || user.user?.system || false,
      createdAt: user.createdAt || user.user?.createdAt,
      avatarURL: user.displayAvatarURL?.({ dynamic: true }) || 
                user.user?.displayAvatarURL?.({ dynamic: true }) || null
    };
  }
  async guild_sendLog(type, options) {
    try {
      if (!this.webhooks[type]) {
        console.error(`Webhook not found for log type: ${type}`);
        return;
      }
      
      const embed = new EmbedBuilder()
        .setTitle(options.title || 'Log Event')
        .setColor(options.color || '#5865F2')
        .setDescription(options.description || '')
        .setTimestamp();
        
      if (options.fields && options.fields.length > 0) {
        embed.addFields(options.fields);
      }
      
      if (options.footer) {
        embed.setFooter({ text: options.footer });
      }
      
      return this.webhooks[type].send({
        embeds: [embed],
        username: options.username || 'Guild Log',
        avatarURL: options.avatarURL,
        content: options.content
      }).catch(err => console.error(`Error sending ${type} log:`, err));
    } catch (error) {
      console.error('Error in guild_sendLog:', error);
    }
  }
  async guild_sendLogEmbed(guildId, options) {
    try {
      // Log türünü options'dan al, yoksa varsayılan olarak message-logs kullan
      const type = options.logType || 'message-logs';

      if (!this.webhooks[type]) {
        console.error(`Webhook not found for log type: ${type}`);
        console.error(`Available webhooks: ${Object.keys(this.webhooks).join(', ')}`);
        return;
      }
      
      console.log(`Webhook bulundu: ${type} - Gönderiliyor...`);
      
      const embed = new EmbedBuilder()
        .setTitle(options.title || 'Log Event')
        .setColor(options.color || '#5865F2')
        .setTimestamp();
      
      if (options.thumbnail) {
        embed.setThumbnail(options.thumbnail);
      }
      
      if (options.description) {
        embed.setDescription(options.description);
      }
      
      if (options.fields && options.fields.length > 0) {
        embed.addFields(options.fields);
      }
      
      if (options.footer) {
        embed.setFooter({ text: options.footer });
      }

      if (options.image) {
        embed.setImage(options.image);
      }
      
      try {
        const result = await this.webhooks[type].send({
          embeds: [embed],
          username: options.username || `${guildId ? `Guild ${guildId}` : 'Unknown Guild'} - Log`,
          avatarURL: options.avatarURL,
          content: options.content
        });
        console.log(`Log webhook gönderildi: ${type}`);
        return result;
      } catch (err) {
        console.error(`Error sending ${type} log embed:`, err);
        return null;
      }
    } catch (error) {
      console.error('Error in guild_sendLogEmbed:', error);
    }
  }
}
module.exports = Logger; 