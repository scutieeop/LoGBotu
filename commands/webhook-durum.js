const { EmbedBuilder, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

module.exports = {
  name: 'logsistemidurumu',
  aliases: ['webhook-durum', 'log-durum'],
  description: 'Log sistemi webhook durumlarını ve ayarlarını gösterir',
  async execute(message, args, client) {
    // Sadece yöneticilerin kullanabilmesi için
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('Bu komutu kullanmak için yönetici yetkisine sahip olmanız gerekiyor!');
    }

    const embed = new EmbedBuilder()
      .setTitle('🛠️ Webhook Durum Raporu')
      .setColor('#3498db')
      .setDescription('Sistemde yapılandırılmış webhook bilgileri aşağıda listelenmiştir.')
      .setTimestamp();

    try {
      // webhook-urls.json dosyasını okuma
      let webhooksConfigured = false;
      let webhookData = {};
      
      try {
        const webhookPath = path.join(__dirname, '..', 'data', 'webhook-urls.json');
        if (fs.existsSync(webhookPath)) {
          const fileContent = fs.readFileSync(webhookPath, 'utf8');
          webhookData = JSON.parse(fileContent);
          webhooksConfigured = true;
        }
      } catch (error) {
        console.error('Webhook dosyası okunamadı:', error);
      }

      // Her bir webhook türünün durumunu kontrol et
      const logTypes = [
        'message-logs', 'member-logs', 'voice-logs', 'channel-logs', 'role-logs',
        'server-logs', 'emoji-logs', 'invite-logs', 'mod-logs', 'webhook-logs',
        'error-logs', 'security-logs', 'command-logs', 'user-logs'
      ];

      // Webhook durumlarını kontrol et
      let statusText = 'Webhook Durumları\n';
      
      for (const logType of logTypes) {
        let status = '❌ Yapılandırılmamış (Yapılandırılmamış)';
        let webhookId = '';
        
        if (webhooksConfigured && webhookData.webhooks && webhookData.webhooks[logType]) {
          const webhookUrl = webhookData.webhooks[logType];
          
          if (webhookUrl && webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
            // URL'yi parçala ve ID'yi çıkar
            const urlParts = webhookUrl.split('/');
            webhookId = urlParts[urlParts.length - 2];
            status = `✅ Hazır (ID: ${webhookId})`;
          } else {
            status = '⚠️ Geçersiz URL (Geçersiz format)';
          }
        }
        
        statusText += `${logType}: ${status}\n`;
      }
      
      // Client tarafındaki logger durumunu kontrol et
      let loggerStatus = '❌ Başlatılmadı';
      if (client.logger && client.logger.initialized) {
        loggerStatus = '✅ Aktif';
      }
      
      embed.addFields(
        { name: 'Webhook Durumları', value: statusText || 'Hiç webhook yapılandırılmamış.', inline: false },
        { name: 'Logger Durumu', value: loggerStatus, inline: false },
        { name: '📝 Not', value: 'Webhook\'ları ayarlamak için `.logsistemikur` komutunu kullanabilirsiniz.\nLog sistemi çalışmıyorsa botu yeniden başlatmanız gerekebilir.', inline: false }
      );

      return message.channel.send({ embeds: [embed] });
    } catch (error) {
      console.error('Webhook durumu gösterilirken hata oluştu:', error);
      return message.reply('Webhook durumları gösterilirken bir hata oluştu. Lütfen daha sonra tekrar deneyin.');
    }
  }
}; 