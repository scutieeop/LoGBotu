const { EmbedBuilder } = require('discord.js');
module.exports = {
  name: 'messageDelete',
  async execute(client, message) {
    if (!message.guild) return;
    if (!client.config.logTypes.MESSAGE) return;
    let formattedUser;
    if (message.author) {
      formattedUser = await client.logger.guild_formatUser(message.author);
    }
    await client.logger.guild_sendLogEmbed(message.guild.id, {
      title: '🗑️ Mesaj Silindi',
      color: client.config.colors.error,
      thumbnail: formattedUser?.avatar,
      logType: 'message-logs',
      fields: [
        { name: 'Gönderen', value: formattedUser ? `<@${formattedUser.id}> (${formattedUser.name})` : 'Bilinmiyor', inline: true },
        { name: 'Kanal', value: `<#${message.channel.id}>`, inline: true },
        { name: '📝 Silinen İçerik', value: message.content || '*İçerik yok (muhtemelen bir embed veya dosya)*' },
        { name: 'Mesaj ID', value: `\`${message.id}\``, inline: true },
        { name: 'Zaman Damgası', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
      ],
      footer: formattedUser ? `Kullanıcı ID: ${formattedUser.id}` : 'Mesaj içeriği önbellekte bulunamadı.'
    });
    if (message.attachments && message.attachments.size > 0) {
      const attachmentList = message.attachments.map(a => 
        `📎 [${a.name}](${a.url}) (${(a.size / 1024).toFixed(2)} KB)`
      ).join('\n');
      await client.logger.guild_sendLogEmbed(message.guild.id, {
        title: '🗑️ Dosya Ekli Mesaj Silindi',
        color: client.config.colors.error,
        thumbnail: formattedUser?.avatar,
        logType: 'message-logs',
        fields: [
          { name: 'Gönderen', value: formattedUser ? `<@${formattedUser.id}> (${formattedUser.name})` : 'Bilinmiyor', inline: true },
          { name: 'Kanal', value: `<#${message.channel.id}>`, inline: true },
          { name: 'Silinen Eklentiler', value: attachmentList },
          { name: 'Mesaj ID', value: `\`${message.id}\``, inline: true }
        ],
        image: message.attachments.first()?.url,
        footer: `Toplam Eklenti: ${message.attachments.size}`
      });
    }
  }
}; 