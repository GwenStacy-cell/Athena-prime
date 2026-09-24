import db from '../database.js';

/**
 * Post a global action log card to every guild that has a globalActionLogChannel set.
 * @param {import('discord.js').Client} client
 * @param {{ action: string, guildId: string, guildName: string, targetId: string, targetTag: string, executorId: string, executorTag: string, reason: string }} opts
 */
export async function postGlobalActionLog(client, { action, guildId, guildName, targetId, targetTag, executorId, executorTag, reason }) {
  const { MessageFlags } = await import('discord.js');

  const timestamp = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

  const card = {
    type: 17,
    components: [
      {
        type: 10,
        content:
          `## GLOBAL ACTION LOG \u2014 ${action}\n` +
          `-# **${guildName || 'Unknown Server'}**`
      },
      { type: 14, divider: true },
      {
        type: 10,
        content:
          `**Target:** <@${targetId}> (\`${targetTag || targetId}\`)\n` +
          `**Target ID:** \`${targetId}\`\n` +
          `**Action Taken By:** <@${executorId}> (${executorTag || 'Anti-Nuke / Bot'})\n` +
          `**Executor ID:** \`${executorId}\`\n` +
          `**Reason:** ${reason || 'No reason provided'}\n` +
          `-# Recorded: ${timestamp}`
      },
      { type: 14, divider: true },
      {
        type: 10,
        content: `-# SECURE GLOBAL ANTINUKE \u2022 CROSS-SERVER ACTION MONITOR \u2022 Server ID: ${guildId}`
      },
      {
        type: 1,
        components: [
          { type: 2, style: 5, label: 'Open Server', url: `https://discord.com/channels/${guildId}` },
          { type: 2, style: 5, label: `Violator: ${targetTag || targetId}`, url: `https://discord.com/users/${targetId}` }
        ]
      }
    ]
  };

  const payload = { components: [card], flags: MessageFlags.IsComponentsV2 };

  for (const guild of client.guilds.cache.values()) {
    const cfg = db.getGuildConfig(guild.id);
    if (!cfg?.globalActionLogChannel) continue;
    const channel = guild.channels.cache.get(cfg.globalActionLogChannel);
    if (!channel) continue;
    channel.send(payload).catch(() => null);
  }
}
