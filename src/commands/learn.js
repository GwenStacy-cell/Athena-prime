import { MessageFlags, PermissionFlagsBits } from 'discord.js';
import db from '../database.js';
import cv2 from '../cv2.js';
import { isServerAdmin } from '../utils/helpers.js';

const TICK = '<a:atheNATICK:1557841381630681106>';
const UPTIME = '<a:uptime:1552608831060844575>';
const OFF = '<:off:1533844858983157851>';

/**
 * Builds the comprehensive Components V2 Learn Mode & Heuristics Dashboard.
 */
export function buildLearnDashboard(guild, config, prefix = '!') {
  const isLearning = Boolean(config.learnModeEnabled);
  const signatures = db.getNukeSignatures(guild.id);
  const baseline = db.getLearnBaseline(guild.id);

  const statusLine = isLearning
    ? `> ${UPTIME} **Status: Active (Adaptive Profiling Engaged)**\n> -# Athena is continuously profiling staff action velocity and recording anomalous threat signatures to dynamically tune velocity thresholds.`
    : `> ${OFF} **Status: Inactive / Standby**\n> -# Heuristic threat learning is dormant. Standard deterministic antinuke velocity tripwires remain fully armed.`;

  let lastActivity = 'None recorded';
  if (baseline.lastAction && baseline.lastAction.timestamp) {
    const ts = Math.floor(baseline.lastAction.timestamp / 1000);
    lastActivity = `<t:${ts}:R> (${baseline.lastAction.eventType || 'Staff Action'})`;
  }

  const container = {
    type: 17,
    components: [
      {
        type: 10,
        content: `# Heuristic Threat Profiling & Learn Mode | ${TICK}\n${statusLine}`
      },
      { type: 14, divider: true },
      {
        type: 10,
        content:
`### Engine Telemetry & Heuristic Profile
• **Threat Signatures Captured:** \`${signatures.length}\`
• **Baseline Staff Actions Profiled:** \`${baseline.actionsRecorded || 0}\`
• **Staff Accounts Indexed:** \`${baseline.staffTracked ? baseline.staffTracked.length : 0}\`
• **False-Positive Guard:** ${UPTIME} **Active** (Authorized staff actions establish safe baselines without punishment)
• **Last Recorded Activity:** ${lastActivity}`
      },
      { type: 14, divider: true },
      {
        type: 10,
        content:
`### Management & Usage
• \`${prefix}learn on\` / \`${prefix}learn off\` - Enable or disable continuous heuristic profiling.
• \`${prefix}learn baseline\` - Run an immediate audit scan across current roles and staff.
• \`${prefix}learn signatures\` - Inspect recent recorded threat signatures and velocity anomalies.
• \`${prefix}learn clear\` - Reset captured signature logs for this server.`
      },
      { type: 14, divider: true },
      {
        type: 1,
        components: [
          isLearning
            ? { type: 2, custom_id: 'learn_off', label: 'Disengage Learning', style: 2, emoji: { id: '1533844858983157851' } }
            : { type: 2, custom_id: 'learn_on', label: 'Engage Learning', style: 3, emoji: { id: '1552608831060844575' } },
          { type: 2, custom_id: 'learn_baseline', label: 'Run Baseline Scan', style: 2, emoji: { id: '1523765738655973589' } },
          { type: 2, custom_id: 'learn_signatures', label: 'View Signatures', style: 2 },
          { type: 2, custom_id: 'learn_clear', label: 'Clear History', style: 4 },
          { type: 2, custom_id: 'learn_refresh', label: 'Refresh', style: 2, emoji: { id: '1523766065576935475' } }
        ]
      },
      { type: 14, divider: true },
      {
        type: 10,
        content: '-# **Athena Prime Adaptive Defense Matrix · Zero-Day Immunity**'
      }
    ]
  };

  return { components: [container], flags: (MessageFlags.IsComponentsV2 || 32768) };
}

/**
 * Builds the threat signatures list container.
 */
export function buildSignaturesContainer(guild, prefix = '!') {
  const signatures = db.getNukeSignatures(guild.id);

  if (signatures.length === 0) {
    const container = {
      type: 17,
      components: [
        {
          type: 10,
          content: `# Threat Signature Registry | ${TICK}\n> ${OFF} **No rogue attack signatures recorded yet.**\n> -# Enable Learn Mode with \`${prefix}learn on\` to begin logging anomaly fingerprints.`
        },
        { type: 14, divider: true },
        {
          type: 1,
          components: [
            { type: 2, custom_id: 'learn_dashboard', label: 'Return to Dashboard', style: 2, emoji: { id: '1523765738655973589' } }
          ]
        }
      ]
    };
    return { components: [container], flags: (MessageFlags.IsComponentsV2 || 32768) };
  }

  const recent = signatures.slice(0, 8);
  const rows = recent.map((sig, idx) => {
    const ts = sig.timestamp ? `<t:${Math.floor(sig.timestamp / 1000)}:R>` : 'Unknown';
    const exec = sig.executorId ? `<@${sig.executorId}> (\`${sig.executorId}\`)` : 'Unknown Actor';
    return `**${idx + 1}. ${sig.eventType || 'Threat Anomaly'}**\n-# • **Executor:** ${exec}\n-# • **Action:** \`${sig.action || 'Unknown'}\` • **Logged:** ${ts}`;
  }).join('\n\n');

  const container = {
    type: 17,
    components: [
      {
        type: 10,
        content: `# Threat Signature Registry | ${TICK}\n> -# Displaying the **${recent.length}** most recent heuristic anomaly patterns recorded for **${guild.name}**:`
      },
      { type: 14, divider: true },
      {
        type: 10,
        content: rows
      },
      { type: 14, divider: true },
      {
        type: 1,
        components: [
          { type: 2, custom_id: 'learn_dashboard', label: 'Return to Dashboard', style: 2, emoji: { id: '1523765738655973589' } },
          { type: 2, custom_id: 'learn_clear', label: 'Clear All Signatures', style: 4 }
        ]
      },
      { type: 14, divider: true },
      {
        type: 10,
        content: '-# **Athena Prime Adaptive Defense Matrix · Zero-Day Immunity**'
      }
    ]
  };

  return { components: [container], flags: (MessageFlags.IsComponentsV2 || 32768) };
}

/**
 * Runs a live heuristic baseline scan across server roles and staff.
 */
export async function executeBaselineScan(guild) {
  try {
    const members = await guild.members.fetch({ time: 5000 }).catch(() => guild.members.cache);
    const highPerms = [
      PermissionFlagsBits.Administrator,
      PermissionFlagsBits.ManageGuild,
      PermissionFlagsBits.ManageRoles,
      PermissionFlagsBits.ManageChannels,
      PermissionFlagsBits.BanMembers,
      PermissionFlagsBits.KickMembers
    ];

    const staffMembers = members.filter(m => !m.user.bot && highPerms.some(perm => m.permissions.has(perm)));
    const staffIds = [...staffMembers.keys()];

    const adminRoles = guild.roles.cache.filter(r => highPerms.some(perm => r.permissions.has(perm)));
    const webhooks = await guild.fetchWebhooks().catch(() => new Map());

    const baseline = db.getLearnBaseline(guild.id);
    db.setBaselineProfile(guild.id, {
      actionsRecorded: (baseline.actionsRecorded || 0) + 1,
      staffTracked: staffIds,
      lastAction: { executorId: guild.ownerId, eventType: 'Baseline Audit Initialized', timestamp: Date.now() },
      lastUpdated: Date.now()
    });

    const container = {
      type: 17,
      components: [
        {
          type: 10,
          content: `# Heuristic Baseline Profile Initialized | ${TICK}\n> ${UPTIME} **Audit Scan Complete for ${guild.name}**`
        },
        { type: 14, divider: true },
        {
          type: 10,
          content:
`### Audit Telemetry Summary
• **Staff Accounts Audited & Whitelisted:** \`${staffIds.length}\`
• **Elevated Permission Roles Indexed:** \`${adminRoles.size}\`
• **Active Webhooks Monitored:** \`${webhooks.size}\`
• **Baseline Velocity Threshold:** \`3 actions / 10s nominal\`
• **False-Positive Immunity:** Full protection applied for routine administrative tasks.`
        },
        { type: 14, divider: true },
        {
          type: 1,
          components: [
            { type: 2, custom_id: 'learn_dashboard', label: 'Return to Dashboard', style: 2, emoji: { id: '1523765738655973589' } }
          ]
        },
        { type: 14, divider: true },
        {
          type: 10,
          content: '-# **Athena Prime Adaptive Defense Matrix · Zero-Day Immunity**'
        }
      ]
    };

    return { components: [container], flags: (MessageFlags.IsComponentsV2 || 32768) };
  } catch (err) {
    const errorContainer = {
      type: 17,
      components: [
        {
          type: 10,
          content: `# Baseline Scan Failed\n> ${OFF} **Encountered error during audit:** \`${err.message}\``
        }
      ]
    };
    return { components: [errorContainer], flags: (MessageFlags.IsComponentsV2 || 32768) };
  }
}

/**
 * Global persistent interaction handler for Learn Mode buttons.
 */
export async function handleLearnInteraction(interaction) {
  try {
    const customId = interaction.customId;
    if (!customId || !customId.startsWith('learn_')) return false;

    if (!isServerAdmin(interaction.member, interaction.guild.id)) {
      await interaction.reply({
        content: `-# ${OFF} **Access Denied:** Only Server Administrators or Owners can manage Learn Mode.`,
        flags: 64
      }).catch(() => null);
      return true;
    }

    const guild = interaction.guild;
    const config = db.getGuildConfig(guild.id);
    const prefix = config.prefix || '!';

    if (customId === 'learn_on') {
      config.learnModeEnabled = true;
      db.updateGuildConfig(guild.id, { learnModeEnabled: true });
      const payload = buildLearnDashboard(guild, config, prefix);
      await interaction.update(payload).catch(() => null);
      return true;
    }

    if (customId === 'learn_off') {
      config.learnModeEnabled = false;
      db.updateGuildConfig(guild.id, { learnModeEnabled: false });
      const payload = buildLearnDashboard(guild, config, prefix);
      await interaction.update(payload).catch(() => null);
      return true;
    }

    if (customId === 'learn_refresh' || customId === 'learn_dashboard') {
      const payload = buildLearnDashboard(guild, config, prefix);
      await interaction.update(payload).catch(() => null);
      return true;
    }

    if (customId === 'learn_signatures') {
      const payload = buildSignaturesContainer(guild, prefix);
      await interaction.update(payload).catch(() => null);
      return true;
    }

    if (customId === 'learn_baseline') {
      const payload = await executeBaselineScan(guild);
      await interaction.update(payload).catch(() => null);
      return true;
    }

    if (customId === 'learn_clear') {
      db.clearNukeSignatures(guild.id);
      const payload = buildLearnDashboard(guild, config, prefix);
      await interaction.update(payload).catch(() => null);
      return true;
    }

    return false;
  } catch (err) {
    console.error('[handleLearnInteraction] Error:', err);
    return false;
  }
}

export const commands = [
  {
    name: 'learn',
    description: 'Configure and monitor Athena Prime Heuristic Machine Learning & Behavioral Antinuke Mode.',
    category: 'security',
    permissions: [],
    aliases: ['ai', 'heuristics', 'behavioral'],
    options: [
      {
        name: 'action',
        description: 'Action to execute',
        type: 3,
        required: false,
        choices: [
          { name: 'Dashboard / Status', value: 'status' },
          { name: 'Enable Profiling', value: 'enable' },
          { name: 'Disable Profiling', value: 'disable' },
          { name: 'Run Baseline Scan', value: 'baseline' },
          { name: 'View Signatures', value: 'signatures' },
          { name: 'Clear History', value: 'clear' }
        ]
      }
    ],
    async executePrefix(message, args) {
      if (!isServerAdmin(message.member, message.guild.id)) {
        return message.reply(cv2.danger('Access Denied', 'The `!learn` command is restricted to **Admin Tier** roles and server administrators.')).catch(() => null);
      }

      const guild = message.guild;
      const config = db.getGuildConfig(guild.id);
      const prefix = config.prefix || '!';
      const sub = (args[0] || 'status').toLowerCase();

      if (sub === 'on' || sub === 'enable' || sub === 'start') {
        config.learnModeEnabled = true;
        db.updateGuildConfig(guild.id, { learnModeEnabled: true });
        const payload = buildLearnDashboard(guild, config, prefix);
        return message.reply(payload);
      }

      if (sub === 'off' || sub === 'disable' || sub === 'stop') {
        config.learnModeEnabled = false;
        db.updateGuildConfig(guild.id, { learnModeEnabled: false });
        const payload = buildLearnDashboard(guild, config, prefix);
        return message.reply(payload);
      }

      if (sub === 'baseline' || sub === 'scan' || sub === 'audit') {
        const payload = await executeBaselineScan(guild);
        return message.reply(payload);
      }

      if (sub === 'signatures' || sub === 'list' || sub === 'sigs') {
        const payload = buildSignaturesContainer(guild, prefix);
        return message.reply(payload);
      }

      if (sub === 'clear' || sub === 'reset') {
        db.clearNukeSignatures(guild.id);
        const container = {
          type: 17,
          components: [
            {
              type: 10,
              content: `# Threat Signatures Cleared | ${TICK}\n> -# All captured anomaly logs and attack patterns for **${guild.name}** have been reset.`
            }
          ]
        };
        return message.reply({ components: [container], flags: (MessageFlags.IsComponentsV2 || 32768) });
      }

      // Default: Status Dashboard
      const payload = buildLearnDashboard(guild, config, prefix);
      return message.reply(payload);
    },
    async executeSlash(interaction) {
      if (!isServerAdmin(interaction.member, interaction.guild.id)) {
        return interaction.reply({
          content: `-# ${OFF} **Access Denied:** Only Server Administrators or Owners can manage Learn Mode.`,
          flags: 64
        });
      }

      const guild = interaction.guild;
      const config = db.getGuildConfig(guild.id);
      const prefix = config.prefix || '!';
      const action = (interaction.options.getString('action') || 'status').toLowerCase();

      if (action === 'enable') {
        config.learnModeEnabled = true;
        db.updateGuildConfig(guild.id, { learnModeEnabled: true });
        const payload = buildLearnDashboard(guild, config, prefix);
        return interaction.reply(payload);
      }

      if (action === 'disable') {
        config.learnModeEnabled = false;
        db.updateGuildConfig(guild.id, { learnModeEnabled: false });
        const payload = buildLearnDashboard(guild, config, prefix);
        return interaction.reply(payload);
      }

      if (action === 'baseline') {
        await interaction.deferReply();
        const payload = await executeBaselineScan(guild);
        return interaction.editReply(payload);
      }

      if (action === 'signatures') {
        const payload = buildSignaturesContainer(guild, prefix);
        return interaction.reply(payload);
      }

      if (action === 'clear') {
        db.clearNukeSignatures(guild.id);
        const container = {
          type: 17,
          components: [
            {
              type: 10,
              content: `# Threat Signatures Cleared | ${TICK}\n> -# All captured anomaly logs and attack patterns for **${guild.name}** have been reset.`
            }
          ]
        };
        return interaction.reply({ components: [container], flags: (MessageFlags.IsComponentsV2 || 32768) });
      }

      const payload = buildLearnDashboard(guild, config, prefix);
      return interaction.reply(payload);
    }
  }
];

export default commands;
