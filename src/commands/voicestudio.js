import { PermissionFlagsBits, MessageFlags } from 'discord.js';
import db from '../database.js';
import cv2 from '../cv2.js';

// Helper to format minutes into human readable text
function formatMinutes(minutes) {
  if (!minutes || minutes <= 0) return '0m';
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs > 0) {
    return `${hrs}h ${mins}m`;
  }
  return `${mins}m`;
}

// Generate simple ASCII / Unicode horizontal bar
function generateBar(value, max, length = 10) {
  if (max <= 0) return '░'.repeat(length);
  const filled = Math.min(length, Math.max(0, Math.round((value / max) * length)));
  return '█'.repeat(filled) + '░'.repeat(length - filled);
}

export const commands = [
  {
    name: 'voiceanalytics',
    aliases: ['va', 'vcstats', 'voiceheatmap', 'voiceintel'],
    description: 'Dynamic voice channel analytics, 24-hour activity heatmaps, and peak participation telemetry',
    category: 'voice',
    permissions: [PermissionFlagsBits.ManageChannels],
    options: [],
    async executePrefix(message) {
      return renderVoiceAnalytics(message, message.guild);
    },
    async executeSlash(interaction) {
      await interaction.deferReply();
      return renderVoiceAnalytics(interaction, interaction.guild);
    }
  }
];

async function renderVoiceAnalytics(ctx, guild) {
  const analytics = db.getVoiceAnalytics(guild.id);
  const hourly = analytics.hourly || {};
  const channels = analytics.channels || {};
  const users = analytics.users || {};

  // Calculate totals
  const totalMinutes = Object.values(hourly).reduce((acc, v) => acc + (v || 0), 0);
  
  // Find peak hour
  let peakHour = 0;
  let peakHourMinutes = 0;
  for (let h = 0; h < 24; h++) {
    const val = hourly[h] || 0;
    if (val > peakHourMinutes) {
      peakHourMinutes = val;
      peakHour = h;
    }
  }

  // Format peak hour nicely e.g. "20:00 (8:00 PM)"
  const peakHourStr = `${String(peakHour).padStart(2, '0')}:00 UTC (${(peakHour % 12 || 12)} ${peakHour >= 12 ? 'PM' : 'AM'})`;

  // Top 5 Channels
  const sortedChannels = Object.entries(channels)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  let channelLines = [];
  if (sortedChannels.length === 0) {
    channelLines.push('-# *No voice activity recorded yet for active channels.*');
  } else {
    for (const [chId, mins] of sortedChannels) {
      const ch = guild.channels.cache.get(chId) || await guild.channels.fetch(chId).catch(() => null);
      const name = ch ? ch.name : `Deleted VC (${chId.slice(-4)})`;
      const bar = generateBar(mins, sortedChannels[0][1], 8);
      channelLines.push(`-# \u2022 **${name}:** \`${bar}\` **${formatMinutes(mins)}**`);
    }
  }

  // Top 5 Members
  const sortedUsers = Object.entries(users)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  let userLines = [];
  if (sortedUsers.length === 0) {
    userLines.push('-# *No voice activity recorded yet for individual members.*');
  } else {
    for (const [uId, mins] of sortedUsers) {
      const member = guild.members.cache.get(uId) || await guild.members.fetch(uId).catch(() => null);
      const name = member ? member.displayName : `User ${uId.slice(-4)}`;
      const bar = generateBar(mins, sortedUsers[0][1], 8);
      userLines.push(`-# \u2022 **${name}:** \`${bar}\` **${formatMinutes(mins)}**`);
    }
  }

  // Hourly Breakdown (4 quarters of 6 hours)
  const quarters = [
    { label: '00:00 - 06:00 (Night)', hours: [0, 1, 2, 3, 4, 5] },
    { label: '06:00 - 12:00 (Morning)', hours: [6, 7, 8, 9, 10, 11] },
    { label: '12:00 - 18:00 (Afternoon)', hours: [12, 13, 14, 15, 16, 17] },
    { label: '18:00 - 24:00 (Evening)', hours: [18, 19, 20, 21, 22, 23] }
  ];

  const maxQ = Math.max(1, ...quarters.map(q => q.hours.reduce((acc, h) => acc + (hourly[h] || 0), 0)));
  const quarterLines = quarters.map(q => {
    const qMins = q.hours.reduce((acc, h) => acc + (hourly[h] || 0), 0);
    const bar = generateBar(qMins, maxQ, 10);
    return `-# \u2022 **${q.label}:** \`${bar}\` **${formatMinutes(qMins)}**`;
  });

  const desc = 
    `Telemetry matrix tracking voice channel engagement across **${guild.name}**.\n\n` +
    `**Global Voice Aggregate:**\n` +
    `-# \u2022 **Total Voice Tracked:** \`${formatMinutes(totalMinutes)}\`\n` +
    `-# \u2022 **Peak Velocity Window:** \`${peakHourStr}\` (${formatMinutes(peakHourMinutes)})\n` +
    `-# \u2022 **Active Hubs Recorded:** \`${Object.keys(channels).length}\` channels\n\n` +
    `**24-Hour Diurnal Heatmap:**\n` +
    quarterLines.join('\n') + '\n\n' +
    `**High-Traffic Voice Channels:**\n` +
    channelLines.join('\n') + '\n\n' +
    `**Top Voice Participants:**\n` +
    userLines.join('\n');

  const container = cv2.info('Voice Channel Analytics & Heatmaps', desc);

  if (ctx.editReply && (ctx.deferred || ctx.replied)) {
    return ctx.editReply(container);
  }
  if (ctx.reply) {
    return ctx.reply(container);
  }
  return ctx.channel.send(container);
}
