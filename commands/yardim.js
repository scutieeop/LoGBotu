const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
module.exports = {
  name: 'yardim',
  description: 'Bot komutları ve özelliklerini gösterir',
  async execute(message, args, client) {
    const categories = [
      {
        name: '🏠 Ana Sayfa',
        emoji: '🏠',
        description: 'Discord Logger Bot\'un özelliklerine genel bakış',
        color: '#5865F2', 
        fields: [
          {
            name: '📢 Selam, Ben Discord Logger Bot!',
            value: '```diff\n+ Sunucunuzdaki tüm olayları ayrıntılı şekilde izler ve kaydederim!\n+ Gelişmiş rol ve etkileşim sistemleri sunarım!\n+ Webhook tabanlı log sistemi ile her şeyi ayrı kanallarda görebilirsiniz!\n```',
            inline: false
          },
          {
            name: '⚡ Hızlı Başlangıç',
            value: '```ini\n[1] .logsistemikur - Log kanalları sistemini kurar\n[2] .durumrol - Durum bilgisine göre otomatik rol verir\n[3] .reactionrole - Tepki ile rol verme sistemi\n```',
            inline: false
          },
          {
            name: '📋 Komut Kategorileri',
            value: '```yaml\n⚙️ Log Sistemi: Log kanalları ve ayarlar\n👤 Kullanıcı: Durum-rol ve tepki-rol işlemleri\n🔧 Yönetici: Yetkili komutları\n🔍 Bilgi: Bot ve sunucu bilgileri\n```',
            inline: false
          },
        ],
        footer: { text: '💫 Detaylı bilgi için diğer sayfalara göz atın! 💫' }
      },
      {
        name: '⚙️ Log Sistemi',
        emoji: '⚙️',
        description: 'Log sistemini yapılandırmak için komutlar',
        color: '#FF5555', 
        fields: [
          {
            name: '📋 Log Sistemi Kurulumu',
            value: '```css\n.logsistemikur\n```\n*✨ Log kanalları kategorisi ve webhook\'ları otomatik oluşturur*\n\n*Her bir log türü için ayrı webhook ve kanallar oluşturulur:*\n> 📝 Mesaj Logları\n> 👤 Üye Logları\n> 🔊 Ses Logları\n> 📂 Kanal Logları\n> 👑 Rol Logları',
            inline: false
          },
          {
            name: '🔄 Log Ayarları',
            value: '```css\n.logayarla [log-türü] [açık/kapalı]\n```\n*✨ Belirli log türlerini açıp kapatmanızı sağlar*\n\n```css\n.logkanalları\n```\n*✨ Mevcut log kanallarını ve durumlarını gösterir*',
            inline: false
          }
        ],
        footer: { text: '⚠️ Log sistemi kurulumu için yönetici yetkisi gerekir' }
      },
      {
        name: '👤 Kullanıcı Sistemleri',
        emoji: '👤',
        description: 'Durum-rol ve tepki-rol sistemleri',
        color: '#43B581', 
        fields: [
          {
            name: '✨ Durum-Rol Sistemi',
            value: '```fix\n.durumrol ekle <metin> <@rol>\n.durumrol kaldir <metin>\n.durumrol liste\n.durumrol otomatikkaldir <açık/kapalı>\n```\n*Kullanıcıların Discord durumlarındaki metinlere göre otomatik rol verme sistemi!*\n\n**Örnek Kullanım:**\n```\n.durumrol ekle "twitch.tv" @Yayıncı\n```',
            inline: false
          },
          {
            name: '🎭 Tepki-Rol Sistemi',
            value: '```fix\n.reactionrole mesaj <#kanal> <başlık | açıklama>\n.reactionrole ekle <mesaj_id> <emoji> <@rol>\n.reactionrole kaldir <mesaj_id> <emoji>\n.reactionrole liste\n```\n*Kullanıcıların emoji tepkilerine göre rol alabileceği etkileşimli sistem!*\n\n**Örnek Kullanım:**\n```\n.reactionrole mesaj #roller Rol Seçimi | Emoji\'lere tıklayarak rol alabilirsiniz\n```',
            inline: false
          }
        ],
        footer: { text: '💡 İpucu: Tepki-rol sistemi için önce mesaj oluşturup sonra rolleri ekleyin' }
      },
      {
        name: '🔍 Diğer Özellikler',
        emoji: '🔍',
        description: 'Botun tüm özellikleri ve istatistikler',
        color: '#FAA61A', 
        fields: [
          {
            name: '📊 Bot İstatistikleri',
            value: '```ini\n.istatistik\n```\n*Botun çalışma süresi, ping, bellek kullanımı gibi bilgileri gösterir*',
            inline: false
          },
          {
            name: '🔆 Özel Özellikler',
            value: '```md\n# Webhook Tabanlı Log Kanalları\n* Her log türü için ayrı webhook ve kanal\n\n# Detaylı Kullanıcı İzleme\n* Kullanıcı adı, avatar, durum değişikliklerini izleme\n\n# Mesaj Takibi\n* Ekli dosyalarla birlikte tüm mesaj aktivitelerini izleme\n\n# Ses Kanalı İzleme\n* Ses kanalı giriş/çıkış ve durum değişikliklerini izleme\n\n# Kanal ve Rol İşlemleri\n* Tüm kanal ve rol değişiklikleri izleme\n```',
            inline: false
          }
        ],
        footer: { text: '✨ Daha fazla bilgi için discord.gg/loggerbot adresini ziyaret edin' }
      }
    ];
    let currentPage = 0;
    const createButtons = (disabled = {}) => {
      const row = new ActionRowBuilder();
      row.addComponents(
        new ButtonBuilder()
          .setCustomId('previous')
          .setLabel('◀️ Önceki')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled.previous || currentPage === 0)
      );
      row.addComponents(
        new ButtonBuilder()
          .setCustomId('home')
          .setLabel('🏠 Ana Sayfa')
          .setStyle(ButtonStyle.Primary)
          .setDisabled(disabled.home || currentPage === 0)
      );
      row.addComponents(
        new ButtonBuilder()
          .setCustomId('next')
          .setLabel('Sonraki ▶️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled.next || currentPage === categories.length - 1)
      );
      const startIdx = Math.max(0, Math.min(categories.length - 2, currentPage));
      for (let i = 0; i < Math.min(2, categories.length); i++) {
        const idx = (startIdx + i + 1) % categories.length;
        if (idx !== currentPage) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`goto_${idx}`)
              .setLabel(`${categories[idx].emoji} ${categories[idx].name}`)
              .setStyle(ButtonStyle.Success)
          );
        }
      }
      return row;
    };
    const createEmbed = () => {
      const category = categories[currentPage];
      const embed = new EmbedBuilder()
        .setTitle(`${category.emoji} ${category.name}`)
        .setDescription(`**${category.description}**`)
        .setColor(category.color)
        .addFields(category.fields)
        .setFooter(category.footer)
        .setTimestamp();
      embed.setThumbnail(message.client.user.displayAvatarURL({ dynamic: true, size: 256 }));
      return embed;
    };
    const response = await message.reply({
      embeds: [createEmbed()],
      components: [createButtons()]
    });
    const collector = response.createMessageComponentCollector({ 
      componentType: ComponentType.Button, 
      time: 60000 
    });
    collector.on('collect', async interaction => {
      if (interaction.user.id !== message.author.id) {
        return interaction.reply({ 
          content: '❌ Bu menüyü sadece komutu çalıştıran kişi kullanabilir!', 
          ephemeral: true 
        });
      }
      collector.resetTimer();
      if (interaction.customId === 'previous') {
        currentPage = Math.max(0, currentPage - 1);
      } else if (interaction.customId === 'next') {
        currentPage = Math.min(categories.length - 1, currentPage + 1);
      } else if (interaction.customId === 'home') {
        currentPage = 0;
      } else if (interaction.customId.startsWith('goto_')) {
        currentPage = parseInt(interaction.customId.replace('goto_', ''));
      }
      await interaction.update({
        embeds: [createEmbed()],
        components: [createButtons()]
      });
    });
    collector.on('end', async () => {
      await response.edit({
        components: [createButtons({ previous: true, next: true, home: true })]
      }).catch(() => {});
    });
  }
}; 