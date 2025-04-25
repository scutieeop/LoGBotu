const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');

module.exports = {
  name: 'help',
  aliases: ['yardım', 'komutlar', 'y'],
  description: 'Botun komutları ve özellikleri hakkında bilgi verir',
  usage: '.help [komut adı]',
  category: 'genel',
  async execute(message, args, client) {
    const startTime = Date.now();
    
    try {
      if (args.length) {
        return this.showCommandHelp(message, args[0].toLowerCase(), client);
      }
      
      return this.showMainHelp(message, client);
    } catch (error) {
      console.error('Error executing help command:', error);
      
      if (client.customLogs) {
        client.customLogs.logError(error, 'help command', message.author.id, message.guild.id);
      }
      
      return message.reply('Yardım görüntülenirken bir hata oluştu.');
    } finally {
      const processingTime = Date.now() - startTime;
      
      if (client.customLogs) {
        client.customLogs.logCommand(
          'help',
          message.author.id,
          message.guild.id,
          true,
          processingTime,
          null
        );
      }
    }
  },
  
  async showMainHelp(message, client) {
    const categories = this.getCommandCategories(client);
    
    const embed = new EmbedBuilder()
      .setTitle('📚 Komut Yardımı')
      .setDescription(`**${client.user.username}** botunun komutları ve özellikleri hakkında bilgi alabilirsiniz.\n\nToplam **${client.commands.size}** komut bulunmaktadır.\n\nAşağıdaki menüden bir kategori seçin veya bir komut hakkında detaylı bilgi almak için \`.help [komut adı]\` yazın.`)
      .setColor('#5865F2')
      .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
      .setFooter({ text: `${message.author.tag} tarafından istendi`, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
      .setTimestamp();
    
    const categoryOptions = Object.keys(categories).map(category => {
      const emoji = this.getCategoryEmoji(category);
      return {
        label: this.getCategoryName(category),
        description: `${category} kategorisindeki komutlar`,
        value: category,
        emoji: emoji
      };
    });
    
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(`help_category_${message.author.id}`)
      .setPlaceholder('Bir kategori seçin')
      .addOptions(categoryOptions);
    
    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`help_all_${message.author.id}`)
        .setLabel('Tüm Komutlar')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📋'),
      new ButtonBuilder()
        .setCustomId(`help_stats_${message.author.id}`)
        .setLabel('Bot Bilgileri')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📊'),
      new ButtonBuilder()
        .setURL('https://discord.gg/example')
        .setLabel('Destek Sunucusu')
        .setStyle(ButtonStyle.Link)
        .setEmoji('💬')
    );
    
    const reply = await message.reply({
      embeds: [embed],
      components: [row1, row2]
    });
    
    const filter = i => i.customId && i.customId.includes(message.author.id);
    const collector = reply.createMessageComponentCollector({ filter, time: 300000 });
    
    collector.on('collect', async interaction => {
      await interaction.deferUpdate();
      
      if (interaction.customId === `help_all_${message.author.id}`) {
        const allCommandsEmbed = this.createAllCommandsEmbed(client, message.author);
        await interaction.followUp({ embeds: [allCommandsEmbed], ephemeral: true });
      } else if (interaction.customId === `help_stats_${message.author.id}`) {
        const statsEmbed = this.createBotStatsEmbed(client, message.author);
        await interaction.followUp({ embeds: [statsEmbed], ephemeral: true });
      } else if (interaction.customId === `help_category_${message.author.id}`) {
        const category = interaction.values[0];
        const categoryEmbed = this.createCategoryEmbed(category, categories[category], client, message.author);
        await interaction.followUp({ embeds: [categoryEmbed], ephemeral: true });
      }
    });
    
    collector.on('end', () => {
      reply.edit({ components: [] }).catch(() => {});
    });
    
    return reply;
  },
  
  async showCommandHelp(message, commandName, client) {
    const command = client.commands.get(commandName) || 
                    client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));
    
    if (!command) {
      return message.reply(`\`${commandName}\` adında bir komut bulunamadı. Mevcut komutları görmek için \`.help\` yazabilirsiniz.`);
    }
    
    const embed = new EmbedBuilder()
      .setTitle(`Komut: ${command.name}`)
      .setDescription(command.description || 'Açıklama bulunamadı.')
      .setColor('#5865F2')
      .addFields(
        { name: '📋 Kullanım', value: `\`${command.usage || `.${command.name}`}\``, inline: true },
        { name: '📁 Kategori', value: `${this.getCategoryEmoji(command.category)} ${this.getCategoryName(command.category)}`, inline: true }
      )
      .setFooter({ text: `${message.author.tag} tarafından istendi`, iconURL: message.author.displayAvatarURL({ dynamic: true }) })
      .setTimestamp();
    
    if (command.aliases && command.aliases.length) {
      embed.addFields({ name: '🔄 Alternatif İsimler', value: command.aliases.map(alias => `\`${alias}\``).join(', '), inline: false });
    }
    
    if (command.cooldown) {
      embed.addFields({ name: '⏱️ Bekleme Süresi', value: `${command.cooldown} saniye`, inline: true });
    }
    
    if (command.permissions) {
      embed.addFields({ name: '🔒 Gerekli Yetkiler', value: command.permissions.map(perm => `\`${perm}\``).join(', '), inline: false });
    }
    
    if (command.examples) {
      embed.addFields({ name: '📝 Örnekler', value: command.examples.map(example => `\`${example}\``).join('\n'), inline: false });
    }
    
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`help_back_${message.author.id}`)
        .setLabel('Ana Menüye Dön')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⬅️')
    );
    
    const reply = await message.reply({
      embeds: [embed],
      components: [row]
    });
    
    const filter = i => i.customId === `help_back_${message.author.id}`;
    const collector = reply.createMessageComponentCollector({ filter, time: 60000 });
    
    collector.on('collect', async interaction => {
      await interaction.deferUpdate();
      await this.showMainHelp(message, client);
      collector.stop();
    });
    
    collector.on('end', () => {
      reply.edit({ components: [] }).catch(() => {});
    });
    
    return reply;
  },
  
  getCommandCategories(client) {
    const categories = {};
    
    client.commands.forEach(command => {
      const category = command.category || 'genel';
      
      if (!categories[category]) {
        categories[category] = [];
      }
      
      categories[category].push(command);
    });
    
    return categories;
  },
  
  getCategoryName(category) {
    const categoryNames = {
      'genel': 'Genel Komutlar',
      'moderation': 'Moderasyon Komutları',
      'admin': 'Yönetici Komutları',
      'config': 'Yapılandırma Komutları',
      'fun': 'Eğlence Komutları',
      'bilgi': 'Bilgi Komutları',
      'log': 'Log Komutları',
      'security': 'Güvenlik Komutları',
      'util': 'Yardımcı Komutlar'
    };
    
    return categoryNames[category] || category.charAt(0).toUpperCase() + category.slice(1);
  },
  
  getCategoryEmoji(category) {
    const categoryEmojis = {
      'genel': '🌐',
      'moderation': '🔨',
      'admin': '👑',
      'config': '⚙️',
      'fun': '🎮',
      'bilgi': 'ℹ️',
      'log': '📋',
      'security': '🛡️',
      'util': '🔧'
    };
    
    return categoryEmojis[category] || '📁';
  },
  
  createCategoryEmbed(category, commands, client, author) {
    const embed = new EmbedBuilder()
      .setTitle(`${this.getCategoryEmoji(category)} ${this.getCategoryName(category)}`)
      .setDescription(`Bu kategoride **${commands.length}** komut bulunmaktadır.`)
      .setColor('#5865F2')
      .setFooter({ text: `${author.tag} tarafından istendi`, iconURL: author.displayAvatarURL({ dynamic: true }) })
      .setTimestamp();
    
    commands.sort((a, b) => a.name.localeCompare(b.name));
    
    for (const command of commands) {
      embed.addFields({
        name: `${command.name} ${command.aliases ? `(${command.aliases.join(', ')})` : ''}`,
        value: `${command.description || 'Açıklama bulunamadı.'}\n**Kullanım:** \`${command.usage || `.${command.name}`}\``,
        inline: false
      });
    }
    
    return embed;
  },
  
  createAllCommandsEmbed(client, author) {
    const embed = new EmbedBuilder()
      .setTitle('📋 Tüm Komutlar')
      .setDescription(`**${client.user.username}** botunun tüm komutlarının listesi. Toplam **${client.commands.size}** komut bulunmaktadır.`)
      .setColor('#5865F2')
      .setFooter({ text: `${author.tag} tarafından istendi`, iconURL: author.displayAvatarURL({ dynamic: true }) })
      .setTimestamp();
    
    const categories = this.getCommandCategories(client);
    
    for (const [category, commands] of Object.entries(categories)) {
      const commandList = commands
        .sort((a, b) => a.name.localeCompare(b.name))
        .map(cmd => `\`${cmd.name}\``)
        .join(', ');
      
      embed.addFields({
        name: `${this.getCategoryEmoji(category)} ${this.getCategoryName(category)} (${commands.length})`,
        value: commandList,
        inline: false
      });
    }
    
    return embed;
  },
  
  createBotStatsEmbed(client, author) {
    const uptime = this.formatUptime(client.uptime);
    const memoryUsage = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
    const botVersion = client.config?.version || '1.0.0';
    
    const embed = new EmbedBuilder()
      .setTitle(`📊 Bot Bilgileri: ${client.user.username}`)
      .setDescription('Bot hakkında teknik bilgiler ve istatistikler.')
      .setColor('#5865F2')
      .setThumbnail(client.user.displayAvatarURL({ dynamic: true }))
      .addFields(
        { name: '⏱️ Çalışma Süresi', value: uptime, inline: true },
        { name: '🏓 Gecikme', value: `${Math.round(client.ws.ping)}ms`, inline: true },
        { name: '💾 Bellek Kullanımı', value: `${memoryUsage} MB`, inline: true },
        { name: '🤖 Bot Versiyonu', value: botVersion, inline: true },
        { name: '📚 Discord.js', value: require('discord.js').version, inline: true },
        { name: '⚙️ Node.js', value: process.version, inline: true },
        { name: '🌐 Toplam Sunucu', value: client.guilds.cache.size.toString(), inline: true },
        { name: '👥 Toplam Kullanıcı', value: client.users.cache.size.toString(), inline: true },
        { name: '📋 Toplam Komut', value: client.commands.size.toString(), inline: true }
      )
      .setFooter({ text: `${author.tag} tarafından istendi`, iconURL: author.displayAvatarURL({ dynamic: true }) })
      .setTimestamp();
    
    return embed;
  },
  
  formatUptime(uptime) {
    const totalSeconds = Math.floor(uptime / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = Math.floor(totalSeconds % 60);
    
    const parts = [];
    
    if (days > 0) parts.push(`${days} gün`);
    if (hours > 0) parts.push(`${hours} saat`);
    if (minutes > 0) parts.push(`${minutes} dakika`);
    if (seconds > 0) parts.push(`${seconds} saniye`);
    
    return parts.join(', ');
  }
}; 