const { PermissionFlagsBits, ChannelType } = require('discord.js');
const fs = require('fs');

module.exports = {
  name: 'logsistemikur',
  description: 'Sunucu için detaylı log sistemini kurar',
  async execute(message, args, client) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('Bu komutu kullanmak için yönetici yetkisine sahip olmanız gerekiyor!');
    }
    const loadingMsg = await message.channel.send('⏳ Log sistemi kuruluyor, lütfen bekleyin...');
    try {
      const logChannels = [
        { name: 'message-logs', emoji: '📝', description: 'Mesaj işlemleri' },
        { name: 'member-logs', emoji: '👤', description: 'Üye giriş/çıkış işlemleri' },
        { name: 'voice-logs', emoji: '🔊', description: 'Ses kanalı aktiviteleri' },
        { name: 'channel-logs', emoji: '📂', description: 'Kanal işlemleri' },
        { name: 'role-logs', emoji: '👑', description: 'Rol işlemleri' },
        { name: 'server-logs', emoji: '🖥️', description: 'Sunucu ayarları' },
        { name: 'emoji-logs', emoji: '😀', description: 'Emoji işlemleri' },
        { name: 'invite-logs', emoji: '📨', description: 'Davet işlemleri' },
        { name: 'mod-logs', emoji: '🔨', description: 'Moderasyon işlemleri' },
        { name: 'webhook-logs', emoji: '🔗', description: 'Webhook işlemleri' },
        { name: 'error-logs', emoji: '⚠️', description: 'Hata kayıtları' },
        { name: 'security-logs', emoji: '🛡️', description: 'Güvenlik kayıtları' },
        { name: 'command-logs', emoji: '⌨️', description: 'Komut kullanımları' },
        { name: 'user-logs', emoji: '👁️', description: 'Kullanıcı izleme' }
      ];
      
      let logsCategory = message.guild.channels.cache.find(
        channel => channel.type === ChannelType.GuildCategory && channel.name === 'guild-logs'
      );
      
      if (!logsCategory) {
        logsCategory = await message.guild.channels.create({
          name: 'guild-logs',
          type: ChannelType.GuildCategory,
          permissionOverwrites: [
            {
              id: message.guild.id, 
              deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
            },
            {
              id: message.guild.members.me.id, 
              allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageWebhooks]
            },
            {
              id: message.member.id, 
              allow: [PermissionFlagsBits.ViewChannel]
            }
          ]
        });
      }
      
      const serverAvatar = message.guild.iconURL({ dynamic: true });
      const logSetup = {
        category: logsCategory,
        channels: {},
        webhooks: {}
      };
      
      let createdCount = 0;
      let existingCount = 0;
      
      for (const channelInfo of logChannels) {
        let logChannel = message.guild.channels.cache.find(
          ch => ch.parentId === logsCategory.id && ch.name === channelInfo.name
        );
        
        if (!logChannel) {
          logChannel = await message.guild.channels.create({
            name: channelInfo.name,
            type: ChannelType.GuildText,
            parent: logsCategory.id,
            topic: `${channelInfo.emoji} | ${channelInfo.description} için log kanalı`,
            permissionOverwrites: [
              {
                id: message.guild.id,
                deny: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]
              },
              {
                id: message.guild.members.me.id,
                allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageWebhooks]
              },
              {
                id: message.member.id,
                allow: [PermissionFlagsBits.ViewChannel]
              }
            ]
          });
          createdCount++;
        } else {
          existingCount++;
        }
        
        const webhooks = await logChannel.fetchWebhooks();
        let webhook = webhooks.find(wh => wh.owner?.id === client.user.id);
        
        if (!webhook) {
          webhook = await logChannel.createWebhook({
            name: `${channelInfo.emoji} ${logChannel.name}`,
            avatar: serverAvatar
          });
        }
        
        logSetup.channels[channelInfo.name] = logChannel.id;
        logSetup.webhooks[channelInfo.name] = webhook.url;
        
        await new Promise(resolve => setTimeout(resolve, 1500)); 
      }
      
      try {
        const webhookUrlsPath = './data/webhook-urls.json';
        
        if (!fs.existsSync('./data')) {
          fs.mkdirSync('./data', { recursive: true });
        }
        
        const webhookData = {
          webhooks: logSetup.webhooks,
          webhookTemplate: "https://discord.com/api/webhooks/ID/TOKEN"
        };
        
        fs.writeFileSync(webhookUrlsPath, JSON.stringify(webhookData, null, 2));
        console.log('Webhook URL\'leri webhook-urls.json dosyasına kaydedildi');
        
        if (!client.config.webhooks) {
          client.config.webhooks = {};
        }
        
        for (const [name, url] of Object.entries(logSetup.webhooks)) {
          client.config.webhooks[name] = url;
        }
        
        if (!client.config.logTypes) {
          client.config.logTypes = {};
        }
        
        logChannels.forEach(channel => {
          const logTypeName = channel.name.replace('-logs', '').toUpperCase();
          client.config.logTypes[logTypeName] = true;
        });
        
        client.config.logSetup = logSetup;
      } catch (error) {
        console.error('Webhook URL\'leri kaydedilirken hata oluştu:', error);
      }
      
      await loadingMsg.edit({
        content: `✅ Log sistemi başarıyla kuruldu!\n\n**Oluşturulan Kategori:** ${logsCategory.name}\n**Oluşturulan Yeni Kanallar:** ${createdCount}\n**Mevcut Kanallar:** ${existingCount}\n**Toplam Log Kanalları:** ${logChannels.length}\n\nTüm loglar artık webhook'lar aracılığıyla ilgili kanallara iletilecek.\n\n📋 Webhook durumlarını görmek için \`.logsistemidurumu\` komutunu kullanabilirsiniz.`
      });
      
      if (client.logger) {
        await client.logger.initialize();
        console.log('Logger yeniden başlatıldı');
      }
      
    } catch (error) {
      console.error('Log sistemi kurulurken hata oluştu:', error);
      await loadingMsg.edit('❌ Log sistemi kurulurken bir hata oluştu. Lütfen daha sonra tekrar deneyin.');
    }
  }
}; 