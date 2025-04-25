const { EmbedBuilder, diffWordsWithSpace } = require('discord.js');
module.exports = {
  name: 'messageUpdate',
  async execute(client, oldMessage, newMessage) {
    if (oldMessage.author?.bot) return;
    if (!oldMessage.guild) return;
    if (!client.config.logTypes.MESSAGE) return;
    if (oldMessage.content === newMessage.content) return;
    const formattedUser = await client.logger.guild_formatUser(oldMessage.author);
    function guild_getDifferences(oldContent, newContent) {
      if (!oldContent || !newContent) return "İçerik yok";
      let str = "";
      const changes = diffWordsWithSpace(oldContent || "", newContent || "");
      changes.forEach(change => {
        if (change.added) {
          str += `**${change.value}**`;
        } else if (change.removed) {
          str += `~~${change.value}~~`;
        } else {
          str += change.value;
        }
      });
      if (str.length > 1024) {
        return `Mesaj çok uzun. [Tıkla](${newMessage.url})`;
      }
      return str;
    }
    await client.logger.guild_sendLogEmbed(oldMessage.guild.id, {
      title: '✏️ Mesaj Düzenlendi',
      color: client.config.colors.warning,
      thumbnail: formattedUser?.avatar,
      logType: 'message-logs',
      fields: [
        { name: 'Gönderen', value: `<@${formattedUser.id}> (${formattedUser.name})`, inline: true },
        { name: 'Kanal', value: `<#${oldMessage.channel.id}>`, inline: true },
        { name: '📝 Eski İçerik', value: oldMessage.content || '*İçerik yok*', inline: false },
        { name: '📝 Yeni İçerik', value: newMessage.content || '*İçerik yok*', inline: false },
        { name: '🔄 Değişiklikler', value: guild_getDifferences(oldMessage.content, newMessage.content), inline: false },
        { name: 'Mesaj ID', value: `\`${oldMessage.id}\``, inline: true },
        { name: 'Mesaj Bağlantısı', value: `[Tıkla](${newMessage.url})`, inline: true }
      ],
      footer: `Düzenlenme Zamanı: ${new Date().toLocaleString()}`
    });
  }
}; 