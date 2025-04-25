const { EmbedBuilder, ChannelType } = require('discord.js');
module.exports = {
  name: 'channelDelete',
  async execute(client, channel) {
    if (!channel.guild) return;
    if (!client.config.logTypes.CHANNEL) return;
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
          type: 12 
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
        { name: 'Silen', value: `<@${formattedUser.id}> (${formattedUser.name})`, inline: true }
      );
      if (auditInfo.reason) {
        fields.push(
          { name: 'Sebep', value: auditInfo.reason, inline: false }
        );
      }
    }
    await client.logger.guild_sendLogEmbed(channel.guild.id, {
      title: `${channelIcon} Kanal Silindi`,
      description: `Bir **${channelType}** silindi: **${channel.name}**`,
      color: client.config.colors.error,
      logType: 'channel-logs',
      fields: fields,
      footer: `${new Date().toLocaleString()}`
    });
  }
}; 