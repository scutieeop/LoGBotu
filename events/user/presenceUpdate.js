const { EmbedBuilder } = require('discord.js');

module.exports = {
  name: 'presenceUpdate',
  async execute(client, oldPresence, newPresence) {
    try {
      if (!oldPresence || !newPresence) return;
      if (!newPresence.guild) return;
      
      // Kullanıcı mevcut değilse işlemi durdur
      const member = newPresence.member;
      if (!member) return;
      
      // Durumrol sistemi yapılandırması kontrol ediliyor
      if (!client.config.statusRoles || !client.config.statusRoles[newPresence.guild.id]) return;
      
      // Bu sunucu için durum-rol eşleşmelerini al
      const guildStatusRoles = client.config.statusRoles[newPresence.guild.id];
      if (!guildStatusRoles || Object.keys(guildStatusRoles).length === 1) return; // Sadece autoRemove varsa boş kabul et
      
      // Aktiviteleri ve statusu kontrol et
      const newActivities = newPresence.activities || [];
      const oldActivities = oldPresence?.activities || [];
      
      // Yeni ve eski durum metinlerini birleştir
      const newStatusText = getStatusTexts(newActivities, newPresence.status);
      const oldStatusText = getStatusTexts(oldActivities, oldPresence?.status);
      
      // Her durum-rol eşleştirmesi için kontrol yap
      for (const [text, roleId] of Object.entries(guildStatusRoles)) {
        // autoRemove ayarını atla
        if (text === 'autoRemove') continue;
        
        // Rol hala mevcut mu kontrol et
        const role = newPresence.guild.roles.cache.get(roleId);
        if (!role) continue;
        
        // Metin durumda var mı kontrol et
        const textInNewStatus = newStatusText.toLowerCase().includes(text.toLowerCase());
        const textInOldStatus = oldStatusText.toLowerCase().includes(text.toLowerCase());
        
        // Rol verme: Metin yeni durumda var ve önceki durumda yoksa
        if (textInNewStatus && !textInOldStatus) {
          try {
            // Kullanıcıda rol yoksa ekle
            if (!member.roles.cache.has(role.id)) {
              await member.roles.add(role, `Durum içeriğinde "${text}" bulunduğu için otomatik eklendi`);
              
              // Log oluştur
              logRoleChange(client, member, role, text, true);
            }
          } catch (error) {
            console.error(`Rol ekleme hatası (${member.user.tag}, ${role.name}):`, error);
          }
        } 
        // Rol alma: Metin önceki durumda var ama yeni durumda yok
        else if (!textInNewStatus && textInOldStatus && guildStatusRoles.autoRemove) {
          try {
            // Kullanıcıda rol varsa kaldır
            if (member.roles.cache.has(role.id)) {
              await member.roles.remove(role, `Durum içeriğinden "${text}" kaldırıldığı için otomatik alındı`);
              
              // Log oluştur
              logRoleChange(client, member, role, text, false);
            }
          } catch (error) {
            console.error(`Rol kaldırma hatası (${member.user.tag}, ${role.name}):`, error);
          }
        }
      }
    } catch (error) {
      console.error('Presence Update event error:', error);
    }
  }
};

// Durumdan ve aktivitelerden metinleri çıkaran fonksiyon
function getStatusTexts(activities, status) {
  let texts = [];
  
  // Status'u ekle (online, idle, dnd, invisible)
  if (status) {
    texts.push(status);
  }
  
  // Tüm aktiviteleri kontrol et
  if (activities && activities.length > 0) {
    for (const activity of activities) {
      if (activity.name) texts.push(activity.name);
      if (activity.state) texts.push(activity.state);
      if (activity.details) texts.push(activity.details);
      
      // Custom status özel olarak kontrol edilmeli
      if (activity.type === 4 && activity.state) { // 4 = CUSTOM
        texts.push(activity.state);
      }
    }
  }
  
  return texts.join(' ');
}

// Rol değişikliklerini loglayan fonksiyon
async function logRoleChange(client, member, role, text, isAdd) {
  if (!client.customLogs) return;
  
  // Kullanıcı aktivitesini logla
  client.customLogs.logUserActivity(
    isAdd ? 'statusRoleAdd' : 'statusRoleRemove',
    member.id,
    member.guild.id,
    {
      roleId: role.id,
      roleName: role.name,
      text: text,
      action: isAdd ? 'add' : 'remove'
    }
  );
  
  // Webhook ile log gönder (eğer mevcutsa)
  if (client.logger?.webhooks?.server) {
    try {
      const embed = new EmbedBuilder()
        .setTitle(`${isAdd ? '🟢 Durum Rolü Eklendi' : '🔴 Durum Rolü Kaldırıldı'}`)
        .setColor(isAdd ? '#43B581' : '#F04747')
        .setDescription(`${member.user.tag} kullanıcısına ${isAdd ? 'durum değişikliği ile rol verildi' : 'durum değişikliği ile rolü alındı'}`)
        .addFields(
          { name: 'Kullanıcı', value: `<@${member.id}> (${member.user.tag})`, inline: true },
          { name: 'Rol', value: `<@&${role.id}> (${role.name})`, inline: true },
          { name: 'Aranan Metin', value: `\`${text}\``, inline: true }
        )
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setFooter({ text: `ID: ${member.id}` })
        .setTimestamp();
        
      await client.logger.webhooks.server.send({
        embeds: [embed],
        username: `${member.guild.name} - Durum Rol Sistemi`,
        avatarURL: member.guild.iconURL({ dynamic: true })
      });
    } catch (error) {
      console.error('Status role log webhook error:', error);
    }
  }
} 