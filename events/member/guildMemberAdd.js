const { EmbedBuilder } = require('discord.js');
const CustomLogs = require('../../utils/customLogs');
module.exports = {
  name: 'guildMemberAdd',
  async execute(client, member) {
    const startTime = Date.now();
    if (!client.config.logTypes.MEMBER) return;
    if (!client.customLogs) {
      client.customLogs = new CustomLogs(client);
    }
    try {
      const formattedUser = await client.logger.guild_formatUser(member.user);
      const securityConcerns = [];
      const accountAge = Date.now() - member.user.createdTimestamp;
      const accountAgeDays = Math.floor(accountAge / (1000 * 60 * 60 * 24));
      if (accountAgeDays < 7) {
        securityConcerns.push({
          type: 'newAccount',
          severity: 'WARNING',
          details: `Account is only ${accountAgeDays} days old`
        });
      }
      const suspiciousPatterns = [
        { pattern: /discord\.gg/i, type: 'inviteLink' },
        { pattern: /nitro|free|gift/i, type: 'potentialScam' },
        { pattern: /bot|[0-9]{4}$/i, type: 'possibleBot' },
        { pattern: /hack|exploit|selfbot/i, type: 'malicious' }
      ];
      for (const { pattern, type } of suspiciousPatterns) {
        if (pattern.test(member.user.username) || (member.nickname && pattern.test(member.nickname))) {
          securityConcerns.push({
            type,
            severity: 'NOTICE',
            details: `Username/nickname matches suspicious pattern: ${type}`
          });
          break;
        }
      }
      if (!client.memberJoinHistory) client.memberJoinHistory = new Map();
      const guildJoinKey = `${member.guild.id}-joins`;
      const guildJoins = client.memberJoinHistory.get(guildJoinKey) || {};
      if (guildJoins[member.id]) {
        const lastJoin = guildJoins[member.id];
        const timeSinceLastJoin = Date.now() - lastJoin.timestamp;
        const daysSinceLastJoin = Math.floor(timeSinceLastJoin / (1000 * 60 * 60 * 24));
        if (lastJoin.left && daysSinceLastJoin < 1) {
          securityConcerns.push({
            type: 'rejoin',
            severity: 'NOTICE',
            details: `User rejoined after leaving less than a day ago`
          });
        }
      }
      guildJoins[member.id] = {
        timestamp: Date.now(),
        left: false
      };
      client.memberJoinHistory.set(guildJoinKey, guildJoins);
      const RAID_WINDOW = 120000; 
      const RAID_THRESHOLD = 10; 
      const recentJoins = Object.entries(guildJoins)
        .filter(([, data]) => Date.now() - data.timestamp < RAID_WINDOW)
        .length;
      if (recentJoins >= RAID_THRESHOLD) {
        client.customLogs.logSecurity('possibleRaid', null, member.guild.id, {
          severity: 'ALERT',
          content: `Possible raid detected - ${recentJoins} users joined in the last 2 minutes`,
          details: {
            recentJoins,
            threshold: RAID_THRESHOLD,
            timeWindow: RAID_WINDOW / 1000
          }
        });
      }
      const fields = [
        { name: 'User', value: `<@${member.id}> (${formattedUser.name})`, inline: true },
        { name: 'Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
        { name: 'ID', value: `\`${member.id}\``, inline: true },
        { name: 'Member Count', value: `${member.guild.memberCount}`, inline: true }
      ];
      if (securityConcerns.length > 0) {
        fields.push({
          name: '⚠️ Security Notes',
          value: securityConcerns.map(concern => `• ${concern.details}`).join('\n'),
          inline: false
        });
      }
      await client.logger.guild_sendLogEmbed(member.guild.id, {
        title: '👋 Member Joined',
        description: `<@${member.id}> (${formattedUser.name}) joined the server.`,
        color: client.config.colors.success,
        thumbnail: formattedUser.avatar,
        logType: 'member-logs',
        fields: fields,
        footer: `User joined • ${new Date().toLocaleString()}`
      });
      client.customLogs.logUserActivity('memberJoin', member.user.id, member.guild.id, {
        accountAge: accountAgeDays,
        bot: member.user.bot,
        joinedAt: member.joinedAt,
        userTag: member.user.tag
      });
      if (securityConcerns.length > 0) {
        const highestSeverity = securityConcerns.reduce((highest, concern) => {
          const severityOrder = {
            'NOTICE': 0,
            'WARNING': 1,
            'ALERT': 2
          };
          return severityOrder[concern.severity] > severityOrder[highest] 
            ? concern.severity 
            : highest;
        }, 'NOTICE');
        client.customLogs.logSecurity('memberJoinConcerns', member.user.id, member.guild.id, {
          severity: highestSeverity,
          content: `New member joined with security concerns: ${securityConcerns.length} issues found`,
          details: {
            concerns: securityConcerns,
            accountAge: accountAgeDays,
            username: member.user.username,
            nickname: member.nickname
          }
        });
      }
      const processingTime = Date.now() - startTime;
      client.customLogs.logPerformance('guildMemberAdd', processingTime, true, {
        guildId: member.guild.id,
        memberId: member.id
      });
    } catch (error) {
      console.error('Error handling guild member add event:', error);
      if (client.customLogs) {
        client.customLogs.logError(error, 'guildMemberAdd', member?.user?.id, member?.guild?.id);
      }
    }
  }
}; 