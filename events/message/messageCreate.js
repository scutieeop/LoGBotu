const { EmbedBuilder, PermissionsBitField, ApplicationCommandType, Client, Message, PermissionFlagsBits } = require('discord.js');
const CustomLogs = require('../../utils/customLogs');

module.exports = {
    name: 'messageCreate',
    async execute(client, message) {
        if (message.author.bot) return;
        
        // Start performance tracking
        const startTime = Date.now();
        
        try {
            // Skip if message logs are disabled
            if (!client.config?.logTypes?.MESSAGE) return;

            // Format user data for logging
            const userData = {
                userId: message.author.id,
                username: message.author.username,
                tag: message.author.tag,
                content: message.content,
                channelId: message.channel.id,
                channelName: message.channel.name,
                guildId: message.guild?.id
            };

            // Initialize Custom Logs if not present
            if (!client.customLogs) {
                client.customLogs = new CustomLogs(client);
            }

            // Log actual message to webhook if enabled for MESSAGE type
            if (message.guild && message.content.length > 0) {
                const formattedUser = await client.logger.guild_formatUser(message.author);
                
                // Only log non-command messages (optional)
                if (!message.content.startsWith(client.config.prefix)) {
                    await client.logger.guild_sendLogEmbed(message.guild.id, {
                        title: '💬 Mesaj Gönderildi',
                        color: client.config.colors.info,
                        thumbnail: formattedUser?.avatar,
                        logType: 'message-logs',
                        fields: [
                            { name: 'Gönderen', value: `<@${formattedUser.id}> (${formattedUser.name})`, inline: true },
                            { name: 'Kanal', value: `<#${message.channel.id}>`, inline: true },
                            { name: '📝 İçerik', value: message.content || '*İçerik yok*' },
                            { name: 'Mesaj ID', value: `\`${message.id}\``, inline: true },
                            { name: 'Zaman Damgası', value: `<t:${Math.floor(Date.now() / 1000)}:F>`, inline: true }
                        ],
                        footer: `Kullanıcı ID: ${formattedUser.id}`
                    });
                }
            }

            // Pass userData object directly to logUserActivity
            client.customLogs.logUserActivity('messageCreate', userData);

            // Process prefix commands if configured
            if (client.config.usePrefix) {
                const prefix = client.config.prefix;
                
                if (!message.content.startsWith(prefix)) return;
                
                const args = message.content.slice(prefix.length).trim().split(/ +/g);
                const commandName = args.shift().toLowerCase();
                const command = client.prefixCommands.get(commandName);
                
                if (!command) return;
                
                if (command.permissions) {
                    const authorPerms = message.channel.permissionsFor(message.author);
                    if (!authorPerms || !authorPerms.has(PermissionFlagsBits[command.permissions])) {
                        return message.reply({ content: "You don't have permission to use this command!" });
                    }
                }
                
                try {
                    command.execute(client, message, args);
                    
                    // Log command execution
                    client.customLogs.log('command', {
                        userId: message.author.id,
                        username: message.author.username,
                        command: commandName,
                        args: args.join(' '),
                        channelId: message.channel.id,
                        guildId: message.guild?.id,
                        success: true
                    });
                } catch (error) {
                    console.error(error);
                    message.reply({ content: 'There was an error while executing this command!' });
                    
                    // Log command execution error
                    client.customLogs.log('command', {
                        userId: message.author.id,
                        username: message.author.username,
                        command: commandName,
                        args: args.join(' '),
                        channelId: message.channel.id,
                        guildId: message.guild?.id,
                        success: false,
                        error: error.message
                    });
                }
            }
            
            // Log performance
            const processingTime = Date.now() - startTime;
            if (processingTime > 500) {
                client.customLogs.log('performance', {
                    event: 'messageCreate',
                    processingTime,
                    threshold: 500
                });
            }
        } catch (error) {
            console.error('Error in messageCreate event:', error);
            client.customLogs?.log('error', {
                event: 'messageCreate',
                error: error.message,
                stack: error.stack
            });
        }
    }
}; 