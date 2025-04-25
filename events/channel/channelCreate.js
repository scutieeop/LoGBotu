const { EmbedBuilder, ChannelType } = require('discord.js');
module.exports = {
  name: 'channelCreate',
  async execute(client, channel) {
    try {
      if (!channel.guild) return;
      if (!client.config.logTypes.CHANNEL) return;
      
      // Start performance tracking
      const startTime = Date.now();
      
      function guild_getChannelTypeString(type) {
        const types = {
          [ChannelType.GuildText]: 'Metin Kanalı',
          [ChannelType.GuildVoice]: 'Ses Kanalı',
          [ChannelType.GuildCategory]: 'Kategori',
          [ChannelType.GuildAnnouncement]: 'Duyuru Kanalı',
          [ChannelType.AnnouncementThread]: 'Duyuru İş Parçacığı',
          [ChannelType.PublicThread]: 'Genel İş Parçacığı',
          [ChannelType.PrivateThread]: 'Özel İş Parçacığı',
          [ChannelType.GuildStageVoice]: 'Sahne Kanalı',
          [ChannelType.GuildForum]: 'Forum Kanalı',
          [ChannelType.GuildDirectory]: 'Dizin Kanalı'
        };
        return types[type] || 'Bilinmeyen Kanal Türü';
      }
      
      function guild_getChannelIcon(type) {
        const icons = {
          [ChannelType.GuildText]: '📝',
          [ChannelType.GuildVoice]: '🔊',
          [ChannelType.GuildCategory]: '📁',
          [ChannelType.GuildAnnouncement]: '📢',
          [ChannelType.AnnouncementThread]: '🧵',
          [ChannelType.PublicThread]: '🧵',
          [ChannelType.PrivateThread]: '🔒',
          [ChannelType.GuildStageVoice]: '🎭',
          [ChannelType.GuildForum]: '💬',
          [ChannelType.GuildDirectory]: '📚'
        };
        return icons[type] || '❓';
      }
      
      async function guild_getAuditInfo(guild, channelId) {
        try {
          const fetchedLogs = await guild.fetchAuditLogs({
            limit: 1,
            type: 10 
          });
          const log = fetchedLogs.entries.first();
          if (log && log.target.id === channelId && (log.createdTimestamp > (Date.now() - 5000))) {
            return {
              executor: log.executor,
              reason: log.reason
            };
          }
          return {
            executor: null,
            reason: null
          };
        } catch (error) {
          console.error('Audit log fetching error:', error);
          return {
            executor: null,
            reason: null
          };
        }
      }
      
      const auditInfo = await guild_getAuditInfo(channel.guild, channel.id);
      const formattedChannel = await client.logger.guild_formatChannel(channel);
      const channelType = guild_getChannelTypeString(channel.type);
      const channelIcon = guild_getChannelIcon(channel.type);
      
      const fields = [
        { name: 'Kanal Adı', value: channel.name, inline: true },
        { name: 'Kanal ID', value: channel.id, inline: true },
        { name: 'Kanal Türü', value: channelType, inline: true }
      ];
      
      if (channel.parent) {
        fields.push({
          name: 'Kategori',
          value: `${channel.parent.name} (${channel.parent.id})`,
          inline: true
        });
      }
      
      if (auditInfo.executor) {
        const formattedUser = await client.logger.guild_formatUser(auditInfo.executor);
        fields.push(
          { name: 'Oluşturan', value: `<@${formattedUser.id}> (${formattedUser.name})`, inline: true }
        );
        
        if (auditInfo.reason) {
          fields.push(
            { name: 'Sebep', value: auditInfo.reason, inline: false }
          );
        }
      }
      
      let permissionOverwrites = [];
      if (channel.permissionOverwrites && channel.permissionOverwrites.cache.size > 0) {
        channel.permissionOverwrites.cache.forEach((overwrite) => {
          const type = overwrite.type === 0 ? 'Rol' : 'Kullanıcı';
          const target = overwrite.type === 0 
            ? `<@&${overwrite.id}>` 
            : `<@${overwrite.id}>`;
          permissionOverwrites.push(`${type}: ${target}`);
        });
        
        if (permissionOverwrites.length > 0) {
          fields.push({
            name: 'İzin Ayarları',
            value: permissionOverwrites.join('\n').slice(0, 1024),
            inline: false
          });
        }
      }
      
      // Log to customLogs if available
      if (client.customLogs) {
        client.customLogs.logSecurity('channelCreate', 
          auditInfo.executor ? auditInfo.executor.id : null,
          channel.guild.id,
          {
            channelId: channel.id,
            channelName: channel.name,
            channelType: channelType,
            reason: auditInfo.reason || 'No reason provided',
            severity: 'NOTICE'
          }
        );
      }
      
      // Use the updated guild_sendLog method
      await client.logger.guild_sendLogEmbed(channel.guild.id, {
        title: `${channelIcon} Kanal Oluşturuldu`,
        description: `Yeni bir **${channelType}** oluşturuldu: <#${channel.id}>`,
        color: client.config.colors.success,
        logType: 'channel-logs',
        fields: fields,
        footer: `${new Date().toLocaleString()}`
      });
      
      // Log performance
      const processingTime = Date.now() - startTime;
      if (processingTime > 500) {
        console.warn(`channelCreate event processing took ${processingTime}ms`);
      }
    } catch (error) {
      console.error('Error in channelCreate event:', error);
      if (client.customLogs) {
        client.customLogs.log('error', {
          event: 'channelCreate',
          error: error.message,
          stack: error.stack
        });
      }
    }
  }
}; 