const { PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
module.exports = {
  name: 'reactionrole',
  description: 'Tepki rolü sistemini yönetir',
  async execute(message, args, client) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('Bu komutu kullanmak için yönetici yetkisine sahip olmanız gerekiyor.');
    }
    if (args.length < 1) {
      return message.reply(`
**Tepki Rol Sistemi Komutları:**
\`.reactionrole ekle <mesaj_id> <emoji> <@rol>\` - Belirtilen mesaja tepki verildiğinde verilecek rolü ayarlar
\`.reactionrole kaldir <mesaj_id> <emoji>\` - Belirtilen mesajdaki belirtilen emojinin rol eşleşmesini kaldırır
\`.reactionrole liste\` - Ayarlanan tüm tepki-rol eşleşmelerini gösterir
\`.reactionrole mesaj <#kanal> <başlık | açıklama>\` - Tepki rolü için özel bir mesaj oluşturur
`);
    }
    const subCommand = args[0].toLowerCase();
    if (!client.config.reactionRoles) {
      client.config.reactionRoles = [];
    }
    switch (subCommand) {
      case 'ekle': {
        if (args.length < 4) {
          return message.reply('Kullanım: `.reactionrole ekle <mesaj_id> <emoji> <@rol>`');
        }
        const messageId = args[1];
        const emojiInput = args[2];
        const roleMention = message.mentions.roles.first();
        if (!roleMention) {
          return message.reply('Lütfen bir rol etiketleyin.');
        }
        let emoji = emojiInput;
        if (emojiInput.startsWith('<') && emojiInput.endsWith('>')) {
          const match = emojiInput.match(/<a?:([^:]+):(\d+)>/);
          if (match) {
            emoji = `${match[1]}:${match[2]}`;
          }
        }
        try {
          const existingRole = client.config.reactionRoles.find(
            rr => rr.messageId === messageId && rr.emoji === emoji
          );
          if (existingRole) {
            return message.reply(`Bu mesaj için zaten "${emoji}" emojisi rol eşleşmesi bulunuyor.`);
          }
          client.config.reactionRoles.push({
            messageId,
            emoji,
            roleId: roleMention.id,
            guildId: message.guild.id
          });
          await updateConfig(client);
          return message.reply(`✅ Tepki rolü ayarlandı! Kullanıcılar "${emoji}" tepkisi verdiklerinde <@&${roleMention.id}> rolü verilecek.`);
        } catch (error) {
          console.error('Tepki rol ekleme hatası:', error);
          return message.reply('❌ Tepki rolü eklenirken bir hata oluştu. Lütfen mesaj ID ve emoji kontrolü yapın.');
        }
      }
      case 'kaldir': {
        if (args.length < 3) {
          return message.reply('Kullanım: `.reactionrole kaldir <mesaj_id> <emoji>`');
        }
        const messageId = args[1];
        const emojiInput = args[2];
        let emoji = emojiInput;
        if (emojiInput.startsWith('<') && emojiInput.endsWith('>')) {
          const match = emojiInput.match(/<a?:([^:]+):(\d+)>/);
          if (match) {
            emoji = `${match[1]}:${match[2]}`;
          }
        }
        const index = client.config.reactionRoles.findIndex(
          rr => rr.messageId === messageId && rr.emoji === emoji
        );
        if (index === -1) {
          return message.reply(`❌ Bu mesaj için "${emoji}" emojisi ile ilişkilendirilmiş bir rol bulunamadı.`);
        }
        const removed = client.config.reactionRoles.splice(index, 1)[0];
        await updateConfig(client);
        return message.reply(`✅ Tepki rolü kaldırıldı! "${emoji}" emojisi artık <@&${removed.roleId}> rolü vermeyecek.`);
      }
      case 'liste': {
        const guildReactionRoles = client.config.reactionRoles.filter(
          rr => rr.guildId === message.guild.id
        );
        if (guildReactionRoles.length === 0) {
          return message.reply('❌ Bu sunucu için ayarlanmış tepki rolü bulunamadı.');
        }
        const list = await Promise.all(guildReactionRoles.map(async (rr, index) => {
          const role = message.guild.roles.cache.get(rr.roleId);
          const roleName = role ? role.name : 'Silinmiş Rol';
          let messageInfo = `Mesaj ID: ${rr.messageId}`;
          try {
            const channel = message.guild.channels.cache.find(ch => 
              ch.isTextBased() && ch.messages.fetch(rr.messageId).catch(() => null)
            );
            if (channel) {
              messageInfo = `Kanal: <#${channel.id}>`;
            }
          } catch (error) {
            // Mesaj bulunamadı, varsayılan bilgi kullanılacak
          }
          return `${index + 1}. ${rr.emoji} → <@&${rr.roleId}> (${roleName}) | ${messageInfo}`;
        }));
        return message.reply(`
**Tepki Rol Eşleşmeleri:**
${list.join('\n')}
`);
      }
      case 'mesaj': {
        if (args.length < 3) {
          return message.reply('Kullanım: `.reactionrole mesaj <#kanal> <başlık | açıklama>`');
        }
        const channelMention = message.mentions.channels.first();
        if (!channelMention) {
          return message.reply('Lütfen bir kanal etiketleyin.');
        }
        const contentParts = args.slice(2).join(' ').split('|');
        const title = contentParts[0]?.trim() || 'Rol Seçimi';
        const description = contentParts[1]?.trim() || 'Aşağıdaki emojilere tıklayarak ilgili rolleri alabilirsiniz.';
        try {
          const sentMessage = await channelMention.send({
            embeds: [{
              title,
              description,
              color: 0x5865F2, 
              footer: {
                text: 'İstediğiniz emojiye tıklayarak rolü alın, tekrar tıklayarak rolü bırakın'
              }
            }]
          });
          return message.reply(`✅ Tepki rol mesajı oluşturuldu! Şimdi \`.reactionrole ekle ${sentMessage.id} <emoji> <@rol>\` komutu ile rolleri ekleyebilirsiniz.`);
        } catch (error) {
          console.error('Tepki rol mesajı oluşturma hatası:', error);
          return message.reply('❌ Tepki rol mesajı oluşturulurken bir hata oluştu.');
        }
      }
      default:
        return message.reply(`❌ Geçersiz komut. Yardım için \`.reactionrole\` yazın.`);
    }
  }
};
async function updateConfig(client) {
  try {
    const configPath = './config/config.js';
    const configData = fs.readFileSync(configPath, 'utf8');
    let updatedConfig;
    if (configData.includes('reactionRoles:')) {
      updatedConfig = configData.replace(
        /reactionRoles:\s*\[[\s\S]*?\],/,
        `reactionRoles: ${JSON.stringify(client.config.reactionRoles, null, 2)},`
      );
    } else {
      updatedConfig = configData.replace(
        'module.exports = {',
        `module.exports = {\n  reactionRoles: ${JSON.stringify(client.config.reactionRoles, null, 2)},`
      );
    }
    fs.writeFileSync(configPath, updatedConfig);
    return true;
  } catch (error) {
    console.error('Config güncellenirken hata:', error);
    return false;
  }
} 