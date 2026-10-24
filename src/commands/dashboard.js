import { PermissionFlagsBits, MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import db from '../database.js';
import os from 'os';
import { generateCommandStatusBanner } from '../utils/canvasCards.js';
import { cleanDisplayName } from '../utils/helpers.js';

export const commands = [
  {
    name: 'dashboard',
    aliases: [
      'commandcenter',
      'omni',
      'omnihud',
      'warroomall',
      'fullhud',
      'matrix360',
      'allinone',
      'allstats',
      'masterhud',
      'cyberhud',
      'central'
    ],
    description: 'Displays the Athena Prime Unified Command Center — an all-inclusive cyber HUD combining Telemetry, Server Operations, and DEFCON Security.',
    category: 'utility',
    async executePrefix(message, args) {
      const result = await buildDashboardResponse(message.guild, message.client, message.author);
      return message.reply(result);
    },
    async executeSlash(interaction) {
      await interaction.deferReply();
      const result = await buildDashboardResponse(interaction.guild, interaction.client, interaction.user);
      return interaction.editReply(result);
    }
  }
];

export async function buildDashboardResponse(guild, client, requester = null) {
  const config = guild ? db.getGuildConfig(guild.id) : null;
  const accentColor = config?.accentColor || '#00f0ff';

  // 1. Gather Telemetry Data
  const uptime = Math.floor(process.uptime());
  const d = Math.floor(uptime / 86400);
  const h = Math.floor((uptime % 86400) / 3600);
  const m = Math.floor((uptime % 3600) / 60);
  const s = uptime % 60;

  const mem = process.memoryUsage();
  const heapMB = Math.round(mem.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
  const totalMemMB = Math.round(os.totalmem() / 1024 / 1024);
  const totalGuilds = client.guilds.cache.size;

  let totalCachedMembers = 0;
  client.guilds.cache.forEach(g => {
    totalCachedMembers += g.memberCount || g.members?.cache.size || 0;
  });

  // 2. Gather Server Data (if run inside a guild)
  let owner = null;
  let humans = 0;
  let bots = 0;
  let textChannels = 0;
  let voiceChannels = 0;
  let categories = 0;
  let stageChannels = 0;
  let totalChannels = 0;
  let totalRoles = 0;
  let boostLevel = 0;
  let boostCount = 0;
  let emojisCount = 0;
  let stickersCount = 0;
  let verifStr = 'N/A';

  if (guild) {
    if (guild.memberCount !== guild.members.cache.size) {
      await guild.members.fetch().catch(() => null);
    }
    owner = await guild.fetchOwner().catch(() => null);
    bots = guild.members.cache.filter(m => m.user.bot).size;
    humans = Math.max(0, guild.memberCount - bots);

    textChannels = guild.channels.cache.filter(c => c.type === 0).size;
    voiceChannels = guild.channels.cache.filter(c => c.type === 2).size;
    categories = guild.channels.cache.filter(c => c.type === 4).size;
    stageChannels = guild.channels.cache.filter(c => c.type === 13).size;
    totalChannels = guild.channels.cache.size;

    totalRoles = guild.roles.cache.size;
    boostLevel = guild.premiumTier || 0;
    boostCount = guild.premiumSubscriptionCount || 0;
    emojisCount = guild.emojis.cache.size;
    stickersCount = guild.stickers.cache.size;

    const verifLabels = [
      'None (Unrestricted)',
      'Low (Verified Email)',
      'Medium (Registered > 5 mins)',
      'High (Server Member > 10 mins)',
      'Very High (Phone Required)'
    ];
    verifStr = verifLabels[guild.verificationLevel] || `Level ${guild.verificationLevel}`;
  }

  // 3. Gather DEFCON & Defense Data
  const lockdown = guild ? db.getLockdownSnapshot(guild.id) : null;
  const raidActive = Boolean(config?.raidMode);
  const isEmergency = guild ? Boolean(db.getEmergencyState(guild.id)) : false;
  const isAlert = Boolean(lockdown || raidActive || isEmergency);
  const extraOwnersCount = guild ? db.getExtraOwners(guild.id).length : 0;
  const spamPermittedCount = db.getSpamPermitted()?.length || 0;

  // 4. Generate Animated Cyber HUD Banner
  const badgeText = isEmergency
    ? 'BLACKOUT EMERGENCY'
    : lockdown
    ? (lockdown.tierLabel || 'LOCKDOWN ACTIVE')
    : raidActive
    ? 'RAID MODE ACTIVE'
    : 'ALL SYSTEMS NOMINAL';

  const badgeColor = isAlert ? '#ff2a4b' : '#00ff88';

  const bannerAttachment = await generateCommandStatusBanner({
    title: 'ATHENA PRIME // COMMAND CENTER',
    subtitle: `${guild ? cleanDisplayName(guild.name).toUpperCase() : 'SYSTEM CLUSTERS'} // UNIFIED OMNI MATRIX`,
    badge: badgeText,
    badgeColor: badgeColor,
    iconUrl: (guild?.iconURL({ extension: 'png', size: 256, forceStatic: true })) || (client.user.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true })),
    fallbackInitial: guild?.name[0] || 'A',
    current: isAlert ? 100 : heapMB,
    total: isAlert ? 100 : Math.max(500, Math.round(totalMemMB / 4)),
    unit: isAlert ? 'THREAT LVL' : 'MB HEAP',
    accentColor: isAlert ? '#ff2a4b' : accentColor,
    metrics: [
      { label: 'MEMBERS', value: guild ? `${guild.memberCount}` : `${totalGuilds} GUILDS` },
      { label: 'PING', value: `${client.ws.ping}MS` },
      { label: 'DEFENSE', value: isAlert ? 'DEFCON 1' : 'DEFCON 5' }
    ],
    attachmentName: 'command_center.gif',
    animated: true
  }).catch(() => null);

  // 5. Construct Interactive ActionRow
  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('dash_refresh').setLabel('Refresh Matrix').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('hud_mode_telemetry').setLabel('Telemetry Focus').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('hud_mode_server').setLabel('Server Focus').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('hud_mode_defcon').setLabel('DEFCON Focus').setStyle(ButtonStyle.Secondary)
  );

  // Quick action recovery buttons if lockdown or emergency is active
  let recoveryRow = null;
  if (lockdown || isEmergency) {
    recoveryRow = new ActionRowBuilder();
    if (lockdown) {
      recoveryRow.addComponents(
        new ButtonBuilder().setCustomId('lockdown_lift').setLabel('Lift Lockdown').setStyle(ButtonStyle.Danger)
      );
    }
    if (isEmergency) {
      recoveryRow.addComponents(
        new ButtonBuilder().setCustomId('emergency_end').setLabel('End Emergency').setStyle(ButtonStyle.Danger)
      );
    }
  }

  // 6. Build Discord Components V2 Container
  const containerComponents = [
    ...(bannerAttachment ? [{ type: 12, items: [{ media: { url: 'attachment://command_center.gif' } }] }] : []),
    { type: 10, content: `## Athena Prime Unified Command Center | <a:atheNATICK:1557841381630681106>` },
    { type: 14, divider: true },
    {
      type: 10,
      content:
        `### **I. Core Bot Telemetry**\n` +
        `> -# \u2022 **Gateway Ping:** \`${client.ws.ping}ms\` latency\n` +
        `> -# \u2022 **Active Clusters:** \`${totalGuilds.toLocaleString()}\` guilds connected \u2022 \`${totalCachedMembers.toLocaleString()}\` members\n` +
        `> -# \u2022 **Memory Usage:** \`${heapMB} MB\` heap used / \`${heapTotalMB} MB\` total (\`${totalMemMB} MB\` system RAM)\n` +
        `> -# \u2022 **Continuous Uptime:** \`${d}d ${h}h ${m}m ${s}s\`\n` +
        `> -# \u2022 **Runtime:** Node \`${process.version}\` on \`${os.platform()} (${os.arch()})\``
    },
    { type: 14, divider: true }
  ];

  if (guild) {
    containerComponents.push(
      {
        type: 10,
        content:
          `### **II. Guild Operations & Capacity**\n` +
          `> -# \u2022 **Server:** **${cleanDisplayName(guild.name)}** (\`${guild.id}\`)\n` +
          `> -# \u2022 **Owner:** ${owner ? `<@${owner.id}> (\`${owner.user?.tag || owner.id}\`)` : `<@${guild.ownerId}>`}\n` +
          `> -# \u2022 **Member Count:** \`${guild.memberCount.toLocaleString()}\` total (\`${humans.toLocaleString()}\` humans \u2022 \`${bots.toLocaleString()}\` bots)\n` +
          `> -# \u2022 **Channels:** \`${totalChannels}\` total (\`${textChannels}\` text \u2022 \`${voiceChannels}\` voice \u2022 \`${categories}\` cat \u2022 \`${stageChannels}\` stage)\n` +
          `> -# \u2022 **Roles & Boosts:** \`${totalRoles}\` roles \u2022 \`Level ${boostLevel}\` (${boostCount} boosts)\n` +
          `> -# \u2022 **Server Assets:** \`${emojisCount}\` custom emojis \u2022 \`${stickersCount}\` stickers`
      },
      { type: 14, divider: true }
    );
  }

  containerComponents.push(
    {
      type: 10,
      content:
        `### **III. DEFCON Defense Matrix & Security**\n` +
        `> -# \u2022 **DEFCON Threat Level:** ${isAlert ? '`DEFCON 1 (Elevated Security Alert)`' : '`DEFCON 5 (Peacetime / Normal)`'}\n` +
        `> -# \u2022 **Panic Lockdown:** ${lockdown ? `\`Active (${lockdown.tierLabel || 'Tier ' + lockdown.tier})\` \u2022 \`${lockdown.channels?.length || 0} channels locked\`` : '`Standby (Disengaged)`'}\n` +
        `> -# \u2022 **Anti-Raid Shield:** ${raidActive ? '`Armed (Auto-quarantine active)`' : '`Online (Monitoring)`'}\n` +
        `> -# \u2022 **Emergency Blackout:** ${isEmergency ? '`Active (Blackout engaged)`' : '`Inactive`'}\n` +
        `> -# \u2022 **Verification Level:** \`${verifStr}\`\n` +
        `> -# \u2022 **Security Whitelist:** \`${extraOwnersCount}\` extra owners \u2022 \`${spamPermittedCount}\` bypass entries`
    },
    { type: 14, divider: true },
    { type: 10, content: `-# **Athena Prime Tactical Command Center \u2022 Unified Operations**` }
  );

  const finalComponents = [{ type: 17, components: containerComponents }, actionRow];
  if (recoveryRow) finalComponents.push(recoveryRow);

  return {
    components: finalComponents,
    files: bannerAttachment ? [bannerAttachment] : [],
    flags: MessageFlags.IsComponentsV2
  };
}
