const { EmbedBuilder, time } = require('discord.js');
module.exports = {
  name: 'guildMemberRemove',
  async execute(client, member) {
    if (!client.config.logTypes.MEMBER) return;
    const formattedUser = await client.logger.guild_formatUser(member.user);
    const formattedMember = await client.logger.guild_formatMember(member);
    const memberDuration = member.joinedAt 
      ? Math.floor((Date.now() - member.joinedTimestamp) / 1000 / 60 / 60 / 24)
      : 'Bilinmiyor';
    function guild_getMemberAuditInfo(guild, userId) {
      return new Promise(async (resolve) => {
        try {
          const fetchedLogs = await guild.fetchAuditLogs({
            limit: 1,
            type: 20 
          });
          const kickLog = fetchedLogs.entries.first();
          const banLogs = await guild.fetchAuditLogs({
            limit: 1,
            type: 22 
          });
          const banLog = banLogs.entries.first();
          if (kickLog && kickLog.target.id === userId && 
              (kickLog.createdTimestamp > (Date.now() - 5000))) {
            return resolve({
              action: 'Atıldı',
              executor: kickLog.executor,
              reason: kickLog.reason || 'Sebep belirtilmedi'
            });
          }
          if (banLog && banLog.target.id === userId && 
              (banLog.createdTimestamp > (Date.now() - 5000))) {
            return resolve({
              action: 'Yasaklandı',
              executor: banLog.executor,
              reason: banLog.reason || 'Sebep belirtilmedi'
            });
          }
          resolve({
            action: 'Ayrıldı',
            executor: null,
            reason: null
          });
        } catch (error) {
          console.error('Audit log sorgulamasında hata:', error);
          resolve({
            action: 'Ayrıldı',
            executor: null,
            reason: null
          });
        }
      });
    }
    const auditInfo = await guild_getMemberAuditInfo(member.guild, member.id);
    await client.logger.guild_sendLogEmbed(member.guild.id, {
      title: `📤 Kullanıcı ${auditInfo.action}`,
      color: client.config.colors.error,
      thumbnail: formattedUser.avatar,
      logType: 'member-logs',
      fields: [
        { name: 'Kullanıcı', value: `<@${formattedUser.id}> (${formattedUser.name})`, inline: true },
        { name: 'ID', value: formattedUser.id, inline: true },
        { name: 'İşlem', value: auditInfo.action, inline: true },
        { name: 'Sunucuda Kalma Süresi', value: typeof memberDuration === 'number' ? `${memberDuration} gün` : memberDuration, inline: true },
        { name: 'Katılma Tarihi', value: member.joinedAt ? `${time(member.joinedAt, 'F')} (${time(member.joinedAt, 'R')})` : 'Bilinmiyor', inline: false },
        { name: 'Hesap Oluşturulma Tarihi', value: `${time(member.user.createdAt, 'F')} (${time(member.user.createdAt, 'R')})`, inline: false },
        { name: 'Sunucudaki Üye Sayısı', value: `${member.guild.memberCount}`, inline: true }
      ].concat(
        auditInfo.executor ? [
          { name: 'İşlemi Yapan', value: `<@${auditInfo.executor.id}> (${auditInfo.executor.tag})`, inline: true },
          { name: 'Sebep', value: auditInfo.reason || 'Belirtilmedi', inline: false }
        ] : []
      ),
      footer: `Kullanıcı ID: ${formattedUser.id}`
    });
    if (formattedMember && formattedMember.roles && formattedMember.roles.length > 0) {
      await client.logger.guild_sendLogEmbed(member.guild.id, {
        title: `📋 Ayrılan Kullanıcının Rolleri`,
        description: `<@${formattedUser.id}> kullanıcısının sahip olduğu roller`,
        color: client.config.colors.info,
        thumbnail: formattedUser.avatar,
        logType: 'member-logs',
        fields: [
          { name: 'Roller', value: formattedMember.roleMentions || 'Rol yok', inline: false }
        ],
        footer: `Toplam ${formattedMember.roles.length} rol`
      });
    }
  }
}; 