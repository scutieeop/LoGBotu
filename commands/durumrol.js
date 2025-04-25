const { PermissionFlagsBits } = require('discord.js');
const fs = require('fs');

module.exports = {
  name: 'durumrol',
  description: 'Kullanıcı durumuna göre otomatik rol verme sistemini yönetir',
  async execute(message, args, client) {
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply('Bu komutu kullanmak için yönetici yetkisine sahip olmanız gerekiyor.');
    }

    if (args.length < 1) {
      return message.reply(`
**Durum Rol Sistemi Komutları:**
\`.durumrol ekle <metin> <@rol>\` - Durumda belirli bir metin olduğunda verilecek rolü ayarlar
\`.durumrol kaldir <metin>\` - Durum-rol eşleşmesini kaldırır
\`.durumrol liste\` - Ayarlanan tüm durum-rol eşleşmelerini gösterir
\`.durumrol otomatikkaldir <açık/kapalı>\` - Durumdan metin kaldırıldığında rolün otomatik kaldırılmasını ayarlar
`);
    }

    const subCommand = args[0].toLowerCase();
    
    if (!client.config.statusRoles) {
      client.config.statusRoles = {};
    }
    
    if (!client.config.statusRoles[message.guild.id]) {
      client.config.statusRoles[message.guild.id] = {
        autoRemove: true 
      };
    }
    
    const guildStatusRoles = client.config.statusRoles[message.guild.id];
    
    switch (subCommand) {
      case 'ekle': {
        if (args.length < 3) {
          return message.reply('Kullanım: `.durumrol ekle <metin> <@rol>`');
        }
        
        const roleMention = message.mentions.roles.first();
        if (!roleMention) {
          return message.reply('Lütfen bir rol etiketleyin.');
        }
        
        const text = args.slice(1, -1).join(' ');
        if (!text || text.length < 2) {
          return message.reply('Lütfen en az 2 karakter uzunluğunda bir metin belirtin.');
        }
        
        guildStatusRoles[text] = roleMention.id;
        await updateConfig(client);
        
        return message.reply(`✅ Kullanıcı durumunda **${text}** metni bulunduğunda <@&${roleMention.id}> rolü verilecek şekilde ayarlandı.`);
      }
      
      case 'kaldir': {
        if (args.length < 2) {
          return message.reply('Kullanım: `.durumrol kaldir <metin>`');
        }
        
        const text = args.slice(1).join(' ');
        if (!guildStatusRoles[text]) {
          return message.reply(`❌ **${text}** metni için ayarlanmış bir rol bulunamadı.`);
        }
        
        const roleId = guildStatusRoles[text];
        delete guildStatusRoles[text];
        await updateConfig(client);
        
        return message.reply(`✅ **${text}** metni için <@&${roleId}> rol eşleşmesi kaldırıldı.`);
      }
      
      case 'liste': {
        const entries = Object.entries(guildStatusRoles).filter(([key]) => key !== 'autoRemove');
        
        if (entries.length === 0) {
          return message.reply('❌ Bu sunucu için ayarlanmış durum-rol eşleşmesi bulunamadı.');
        }
        
        const list = entries.map(([text, roleId], index) => {
          const role = message.guild.roles.cache.get(roleId);
          return `${index + 1}. **${text}** → ${role ? `<@&${roleId}>` : 'Silinmiş Rol'}`;
        }).join('\n');
        
        return message.reply(`
**Durum-Rol Eşleşmeleri:**
${list}
**Otomatik Rol Kaldırma:** ${guildStatusRoles.autoRemove ? 'Açık ✅' : 'Kapalı ❌'}
`);
      }
      
      case 'otomatikkaldir': {
        if (args.length < 2) {
          return message.reply('Kullanım: `.durumrol otomatikkaldir <açık/kapalı>`');
        }
        
        const state = args[1].toLowerCase();
        if (state === 'açık' || state === 'aktif' || state === 'on') {
          guildStatusRoles.autoRemove = true;
          await updateConfig(client);
          return message.reply('✅ Durumdan metin kaldırıldığında roller otomatik olarak kaldırılacak.');
        } else if (state === 'kapalı' || state === 'kapali' || state === 'off') {
          guildStatusRoles.autoRemove = false;
          await updateConfig(client);
          return message.reply('✅ Durumdan metin kaldırıldığında roller otomatik olarak kaldırılmayacak.');
        } else {
          return message.reply('❌ Geçersiz parametre. `açık` veya `kapalı` kullanın.');
        }
      }
      
      default:
        return message.reply(`❌ Geçersiz komut. Yardım için \`.durumrol\` yazın.`);
    }
  }
};

async function updateConfig(client) {
  try {
    const configPath = './config/config.js';
    const configData = fs.readFileSync(configPath, 'utf8');
    let updatedConfig;
    
    if (configData.includes('statusRoles:')) {
      updatedConfig = configData.replace(
        /statusRoles:\s*{[\s\S]*?},/,
        `statusRoles: ${JSON.stringify(client.config.statusRoles, null, 2)},`
      );
    } else {
      updatedConfig = configData.replace(
        'module.exports = {',
        `module.exports = {\n  statusRoles: ${JSON.stringify(client.config.statusRoles, null, 2)},`
      );
    }
    
    fs.writeFileSync(configPath, updatedConfig);
    return true;
  } catch (error) {
    console.error('Config güncellenirken hata:', error);
    return false;
  }
} 