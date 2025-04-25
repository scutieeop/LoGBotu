const { EmbedBuilder } = require('discord.js');
const CustomLogs = require('../../utils/customLogs');
module.exports = {
  name: 'voiceStateUpdate',
  async execute(client, oldState, newState) {
    const startTime = Date.now();
    if (!client.config.logTypes.VOICE) return;
    const member = newState.member || oldState.member;
    if (!member) return;
    if (!client.customLogs) {
      client.customLogs = new CustomLogs(client);
    }
    try {
      const formattedUser = await client.logger.guild_formatUser(member.user);
      const voiceChange = getVoiceChangeType(oldState, newState, member, client);
      if (!voiceChange) return;
      if (voiceChange.type === 'leave' && oldState.channelId) {
        const joinTimestamp = client.voiceJoinTimes?.get(member.id + '-' + oldState.channelId);
        if (joinTimestamp) {
          const duration = Date.now() - joinTimestamp;
          const durationMinutes = Math.floor(duration / 60000);
          voiceChange.duration = duration;
          voiceChange.durationText = `${durationMinutes} minutes, ${Math.floor((duration % 60000) / 1000)} seconds`;
          client.voiceJoinTimes?.delete(member.id + '-' + oldState.channelId);
          client.customLogs.logUserActivity('voiceSession', member.user.id, member.guild.id, {
            channelId: oldState.channelId,
            channelName: oldState.channel?.name || 'Unknown Channel',
            duration: duration,
            durationText: voiceChange.durationText
          });
        }
      }
      if (voiceChange.type === 'join' && newState.channelId) {
        if (!client.voiceJoinTimes) client.voiceJoinTimes = new Map();
        client.voiceJoinTimes.set(member.id + '-' + newState.channelId, Date.now());
      }
      const membersInChannel = [];
      if (newState.channelId) {
        const channel = newState.channel;
        if (channel) {
          channel.members.forEach(m => {
            membersInChannel.push(`<@${m.id}> ${m.user.bot ? '🤖' : ''}`);
          });
        }
      }
      const fields = [
        { name: 'User', value: `<@${formattedUser.id}> (${formattedUser.name})`, inline: true },
        { name: 'ID', value: formattedUser.id, inline: true }
      ];
      if (voiceChange.type === 'join' || voiceChange.type === 'leave' || voiceChange.type === 'move') {
        if (voiceChange.type === 'join' || voiceChange.type === 'move') {
          fields.push(
            { name: 'Channel', value: `<#${newState.channelId}>`, inline: true },
            { name: 'Members in Channel', value: membersInChannel.length > 0 ? membersInChannel.join(', ') : 'No one', inline: false },
            { name: 'Member Count', value: `${membersInChannel.length}`, inline: true }
          );
        } else if (voiceChange.type === 'leave') {
          fields.push(
            { name: 'Left Channel', value: `<#${oldState.channelId}>`, inline: true }
          );
          if (voiceChange.duration) {
            fields.push(
              { name: 'Session Duration', value: voiceChange.durationText, inline: true }
            );
          }
        }
      } else if (voiceChange.type === 'status') {
        voiceChange.changes.forEach(change => {
          fields.push({
            name: `${change.emoji} ${change.name}`,
            value: `${change.oldValue} ➡️ ${change.newValue}`,
            inline: true
          });
        });
        fields.push(
          { name: 'Channel', value: `<#${newState.channelId}>`, inline: true }
        );
      }
      await client.logger.guild_sendLogEmbed(member.guild.id, {
        title: voiceChange.title,
        description: voiceChange.description,
        color: voiceChange.color,
        thumbnail: formattedUser.avatar,
        logType: 'voice-logs',
        fields: fields,
        footer: `Voice Activity • ${new Date().toLocaleString()}`
      });
      let severityLevel = 'INFO';
      const voiceEventDetails = {
        oldChannelId: oldState.channelId,
        newChannelId: newState.channelId,
        oldChannelName: oldState.channel?.name,
        newChannelName: newState.channel?.name,
        changes: voiceChange.changes || [],
        membersInNewChannel: membersInChannel.length
      };
      switch(voiceChange.type) {
        case 'join':
          client.customLogs.logUserActivity('voiceJoin', member.user.id, member.guild.id, voiceEventDetails);
          break;
        case 'leave':
          client.customLogs.logUserActivity('voiceLeave', member.user.id, member.guild.id, voiceEventDetails);
          break;
        case 'move':
          client.customLogs.logUserActivity('voiceMove', member.user.id, member.guild.id, voiceEventDetails);
          break;
        case 'status':
          client.customLogs.logUserActivity('voiceStatusChange', member.user.id, member.guild.id, voiceEventDetails);
          checkForSuspiciousDeafenPattern(client, member, oldState, newState);
          break;
      }
      checkForSuspiciousVoiceBehavior(client, member, oldState, newState, voiceChange);
      const processingTime = Date.now() - startTime;
      client.customLogs.logPerformance('voiceStateUpdate', processingTime, true, {
        userId: member.user.id,
        guildId: member.guild.id,
        changeType: voiceChange.type
      });
    } catch (error) {
      console.error('Error handling voice state update event:', error);
      if (client.customLogs) {
        client.customLogs.logError(error, 'voiceStateUpdate', member?.user?.id, member?.guild?.id);
      }
    }
  }
};
function getVoiceChangeType(oldState, newState, member, client) {
  if (!oldState.channelId && newState.channelId) {
    return {
      type: 'join',
      title: '🔊 Joined Voice Channel',
      description: `<@${member.id}> joined <#${newState.channelId}> channel.`,
      color: client.config.colors.success
    };
  }
  if (oldState.channelId && !newState.channelId) {
    return {
      type: 'leave',
      title: '🔇 Left Voice Channel',
      description: `<@${member.id}> left <#${oldState.channelId}> channel.`,
      color: client.config.colors.error
    };
  }
  if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
    return {
      type: 'move',
      title: '🔀 Changed Voice Channel',
      description: `<@${member.id}> moved from <#${oldState.channelId}> to <#${newState.channelId}> channel.`,
      color: client.config.colors.warning
    };
  }
  const changes = [];
  if (oldState.serverMute !== newState.serverMute) {
    changes.push({
      name: 'Server Mute',
      oldValue: oldState.serverMute ? 'On' : 'Off',
      newValue: newState.serverMute ? 'On' : 'Off',
      emoji: newState.serverMute ? '🔇' : '🔊'
    });
  }
  if (oldState.serverDeaf !== newState.serverDeaf) {
    changes.push({
      name: 'Server Deafen',
      oldValue: oldState.serverDeaf ? 'On' : 'Off',
      newValue: newState.serverDeaf ? 'On' : 'Off',
      emoji: newState.serverDeaf ? '🔇' : '🔊'
    });
  }
  if (oldState.selfMute !== newState.selfMute) {
    changes.push({
      name: 'Self Mute',
      oldValue: oldState.selfMute ? 'On' : 'Off',
      newValue: newState.selfMute ? 'On' : 'Off',
      emoji: newState.selfMute ? '🔇' : '🔊'
    });
  }
  if (oldState.selfDeaf !== newState.selfDeaf) {
    changes.push({
      name: 'Self Deafen',
      oldValue: oldState.selfDeaf ? 'On' : 'Off',
      newValue: newState.selfDeaf ? 'On' : 'Off',
      emoji: newState.selfDeaf ? '🔇' : '🔊'
    });
  }
  if (oldState.selfVideo !== newState.selfVideo) {
    changes.push({
      name: 'Camera',
      oldValue: oldState.selfVideo ? 'On' : 'Off',
      newValue: newState.selfVideo ? 'On' : 'Off',
      emoji: newState.selfVideo ? '📹' : '❌'
    });
  }
  if (oldState.streaming !== newState.streaming) {
    changes.push({
      name: 'Screen Share',
      oldValue: oldState.streaming ? 'On' : 'Off',
      newValue: newState.streaming ? 'On' : 'Off',
      emoji: newState.streaming ? '🖥️' : '❌'
    });
  }
  if (changes.length > 0) {
    const mainChange = changes[0];
    return {
      type: 'status',
      title: `${mainChange.emoji} Voice Status Changed`,
      description: `<@${member.id}>'s voice status has changed.`,
      color: client.config.colors.info,
      changes: changes
    };
  }
  return null;
}
function checkForSuspiciousVoiceBehavior(client, member, oldState, newState, voiceChange) {
  if (!client.voiceStatePatterns) {
    client.voiceStatePatterns = {
      channelHopping: new Map(), 
      deafenPatterns: new Map(), 
      emptyChannelJoins: new Map() 
    };
  }
  const userId = member.user.id;
  const guildId = member.guild.id;
  const now = Date.now();
  if (voiceChange.type === 'move') {
    const userHoppingKey = `${userId}-${guildId}`;
    const userHoppingData = client.voiceStatePatterns.channelHopping.get(userHoppingKey) || {
      count: 0,
      channels: [],
      timestamps: [],
      lastUpdate: 0
    };
    if (now - userHoppingData.lastUpdate > 60000) {
      userHoppingData.count = 0;
      userHoppingData.channels = [];
      userHoppingData.timestamps = [];
    }
    userHoppingData.count++;
    userHoppingData.channels.push(newState.channelId);
    userHoppingData.timestamps.push(now);
    userHoppingData.lastUpdate = now;
    client.voiceStatePatterns.channelHopping.set(userHoppingKey, userHoppingData);
    if (userHoppingData.count >= 5 && (now - userHoppingData.timestamps[0]) <= 60000) {
      const uniqueChannels = new Set(userHoppingData.channels).size;
      if (uniqueChannels >= 3) {
        client.customLogs.logSecurity('suspiciousVoiceHopping', userId, guildId, {
          severity: 'WARNING',
          details: `User has changed voice channels ${userHoppingData.count} times in the last minute between ${uniqueChannels} different channels`,
          channels: Array.from(new Set(userHoppingData.channels)),
          timestamps: userHoppingData.timestamps
        });
        client.voiceStatePatterns.channelHopping.delete(userHoppingKey);
      }
    }
  }
  if (voiceChange.type === 'join' || voiceChange.type === 'move') {
    const channel = newState.channel;
    if (channel && channel.members.size === 1) {
      const userEmptyJoinKey = `${userId}-${guildId}`;
      const userEmptyJoinData = client.voiceStatePatterns.emptyChannelJoins.get(userEmptyJoinKey) || {
        count: 0,
        channels: [],
        timestamps: [],
        lastUpdate: 0
      };
      if (now - userEmptyJoinData.lastUpdate > 600000) {
        userEmptyJoinData.count = 0;
        userEmptyJoinData.channels = [];
        userEmptyJoinData.timestamps = [];
      }
      userEmptyJoinData.count++;
      userEmptyJoinData.channels.push({ id: newState.channelId, name: channel.name });
      userEmptyJoinData.timestamps.push(now);
      userEmptyJoinData.lastUpdate = now;
      client.voiceStatePatterns.emptyChannelJoins.set(userEmptyJoinKey, userEmptyJoinData);
    }
  }
}
function checkForSuspiciousDeafenPattern(client, member, oldState, newState) {
  if (oldState.selfDeaf !== newState.selfDeaf) {
    if (!client.deafenPatterns) client.deafenPatterns = new Map();
    const userId = member.user.id;
    const guildId = member.guild.id;
    const userDeafenKey = `${userId}-${guildId}`;
    const now = Date.now();
    const deafenData = client.deafenPatterns.get(userDeafenKey) || {
      count: 0,
      changes: [],
      lastUpdate: 0
    };
    if (now - deafenData.lastUpdate > 300000) {
      deafenData.count = 0;
      deafenData.changes = [];
    }
    deafenData.count++;
    deafenData.changes.push({
      timestamp: now,
      newValue: newState.selfDeaf
    });
    deafenData.lastUpdate = now;
    client.deafenPatterns.set(userDeafenKey, deafenData);
    if (deafenData.count >= 6 && (now - deafenData.changes[0].timestamp) <= 60000) {
      client.customLogs.logSecurity('suspiciousDeafenToggling', userId, guildId, {
        severity: 'NOTICE',
        details: `User has toggled deafen status ${deafenData.count} times in the last minute`,
        changes: deafenData.changes
      });
      client.deafenPatterns.delete(userDeafenKey);
    }
  }
} 