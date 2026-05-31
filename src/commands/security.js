import { PermissionFlagsBits, ChannelType, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import db from '../database.js';
import embed from '../embed.js';
import { 
  canModerate, 
  logToSecurityChannel, 
  getOrCreateQuarantineRole, 
  getOrCreateQuarantineChannel,
  isBotOwnerOrServerOwner,
  isBotOwnerSync,
  isExtraOwner
} from '../utils/helpers.js';
import { connectToHomeVc } from '../utils/voice.js';

export const commands = [
  // --- QUARANTINE COMMAND ---
  {
    name: 'quarantine',
    description: 'Strips a user of all roles, isolates them in the quarantine channel, and DMs them.',
    category: 'security',
    permissions: [PermissionFlagsBits.ModerateMembers],
    options: [
      {
        name: 'user',
        description: 'The member to quarantine',
        type: 6,
        required: true
      },
      {
        name: 'reason',
        description: 'Reason for the quarantine',
        type: 3,
        required: false
      }
    ],
    async executePrefix(message, args) {
      const target = message.mentions.members.first();
      if (!target) {
        return message.reply({ embeds: [embed.warn('Command Error', `${message.author} Please mention a valid member to quarantine.\n\n**Usage:** \`!quarantine <@user> [reason]\``)] });
      }
      
      const reason = args.slice(1).join(' ') || 'No reason provided';
      const result = await executeQuarantine(message.guild, target, message.member, reason);
      
      if (result.success) {
        await message.reply({ embeds: [result.embed] });
      } else {
        await message.reply({ embeds: [embed.danger('Quarantine Failed', result.message)] });
      }
    },
    async executeSlash(interaction) {
      const targetUser = interaction.options.getUser('user');
      const reason = interaction.options.getString('reason') || 'No reason provided';

      const target = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      if (!target) {
        return interaction.reply({ embeds: [embed.warn('Command Error', `${interaction.user} Member not found.`)], ephemeral: true });
      }

      const result = await executeQuarantine(interaction.guild, target, interaction.member, reason);
      if (result.success) {
        await interaction.reply({ embeds: [result.embed] });
      } else {
        await interaction.reply({ embeds: [embed.danger('Quarantine Failed', result.message)], ephemeral: true });
      }
    }
  },

  // --- UNQUARANTINE COMMAND ---
  {
    name: 'unquarantine',
    description: 'Restores a quarantined user to their original roles and lifts isolation.',
    category: 'security',
    permissions: [PermissionFlagsBits.ModerateMembers],
    options: [
      {
        name: 'user',
        description: 'The member to unquarantine',
        type: 6,
        required: true
      }
    ],
    async executePrefix(message) {
      const target = message.mentions.members.first();
      if (!target) {
        return message.reply({ embeds: [embed.warn('Command Error', `${message.author} Please mention a valid member to unquarantine.\n\n**Usage:** \`!unquarantine <@user>\``)] });
      }

      const result = await executeUnquarantine(message.guild, target, message.member);
      if (result.success) {
        await message.reply({ embeds: [result.embed] });
      } else {
        await message.reply({ embeds: [embed.danger('Unquarantine Failed', result.message)] });
      }
    },
    async executeSlash(interaction) {
      const targetUser = interaction.options.getUser('user');
      const target = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      
      if (!target) {
        return interaction.reply({ embeds: [embed.warn('Command Error', `${interaction.user} Member not found.`)], ephemeral: true });
      }

      const result = await executeUnquarantine(interaction.guild, target, interaction.member);
      if (result.success) {
        await interaction.reply({ embeds: [result.embed] });
      } else {
        await interaction.reply({ embeds: [embed.danger('Unquarantine Failed', result.message)], ephemeral: true });
      }
    }
  },

  // --- LOCKDOWN COMMAND ---
  {
    name: 'lockdown',
    description: 'Toggles text channel lockdown (on/off) preventing anyone from sending messages.',
    category: 'security',
    permissions: [PermissionFlagsBits.ManageChannels],
    options: [
      {
        name: 'mode',
        description: 'Lock or Unlock the channel',
        type: 3,
        required: true,
        choices: [
          { name: 'Enable Lockdown', value: 'on' },
          { name: 'Disable Lockdown', value: 'off' }
        ]
      }
    ],
    async executePrefix(message, args) {
      const mode = args[0]?.toLowerCase() === 'off' ? 'off' : 'on';
      const result = await handleLockdown(message.guild, message.channel, message.member, mode);
      await message.reply({ embeds: [result.embed] });
    },
    async executeSlash(interaction) {
      const mode = interaction.options.getString('mode');
      const result = await handleLockdown(interaction.guild, interaction.channel, interaction.member, mode);
      await interaction.reply({ embeds: [result.embed] });
    }
  },

  // --- RAIDMODE COMMAND ---
  {
    name: 'raidmode',
    description: 'Toggles raid protection (locks joining members by auto-quarantining them instantly).',
    category: 'security',
    permissions: [PermissionFlagsBits.Administrator],
    options: [
      {
        name: 'status',
        description: 'Turn raid mode ON or OFF',
        type: 3,
        required: true,
        choices: [
          { name: 'Enable Raid Protection', value: 'on' },
          { name: 'Disable Raid Protection', value: 'off' }
        ]
      }
    ],
    async executePrefix(message, args) {
      const mode = args[0]?.toLowerCase() === 'on' ? 'on' : 'off';
      const result = await handleRaidMode(message.guild, message.member, mode);
      await message.reply({ embeds: [result.embed] });
    },
    async executeSlash(interaction) {
      const mode = interaction.options.getString('status');
      const result = await handleRaidMode(interaction.guild, interaction.member, mode);
      await interaction.reply({ embeds: [result.embed] });
    }
  },

  // --- WHITELIST COMMAND ---
  {
    name: 'whitelist',
    description: 'Manages whitelisted members who are immune to Anti-Nuke, Anti-Spam, and AutoMod filters.',
    category: 'security',
    permissions: [PermissionFlagsBits.Administrator],
    options: [
      {
        name: 'action',
        description: 'Choose whitelist action',
        type: 3,
        required: true,
        choices: [
          { name: 'Add Member', value: 'add' },
          { name: 'Remove Member', value: 'remove' },
          { name: 'List Members', value: 'list' }
        ]
      },
      {
        name: 'user',
        description: 'Target member for add/remove actions',
        type: 6,
        required: false
      }
    ],
    async executePrefix(message, args) {
      const action = args[0]?.toLowerCase();
      const target = message.mentions.members.first();

      if (!action || (action !== 'list' && !target)) {
        return message.reply({ embeds: [embed.warn('Command Error', `${message.author} Usage: \`!whitelist add <@user>\`, \`!whitelist remove <@user>\`, or \`!whitelist list\``)] });
      }

      const result = await handleWhitelist(message.guild, message.member, action, target?.user);
      await message.reply({ embeds: [result.embed] });
    },
    async executeSlash(interaction) {
      const action = interaction.options.getString('action');
      const targetUser = interaction.options.getUser('user');

      if (action !== 'list' && !targetUser) {
        return interaction.reply({ embeds: [embed.warn('Command Error', `${interaction.user} Please specify a target user parameter for this action.`)], ephemeral: true });
      }

      const result = await handleWhitelist(interaction.guild, interaction.member, action, targetUser);
      await interaction.reply({ embeds: [result.embed] });
    }
  },

  // --- BLACKLIST COMMAND ---
  {
    name: 'blacklist',
    description: 'Manages word filter blacklists. Messages matching these terms are deleted and warned.',
    category: 'security',
    permissions: [PermissionFlagsBits.ModerateMembers],
    options: [
      {
        name: 'action',
        description: 'Choose blacklist action',
        type: 3,
        required: true,
        choices: [
          { name: 'Add Phrase', value: 'add' },
          { name: 'Remove Phrase', value: 'remove' },
          { name: 'List Phrases', value: 'list' }
        ]
      },
      {
        name: 'phrase',
        description: 'The word or phrase to add/remove (lowercase)',
        type: 3,
        required: false
      }
    ],
    async executePrefix(message, args) {
      const action = args[0]?.toLowerCase();
      const phrase = args.slice(1).join(' ');

      if (!action || (action !== 'list' && !phrase)) {
        return message.reply({ embeds: [embed.warn('Command Error', `${message.author} Usage: \`!blacklist add <phrase>\`, \`!blacklist remove <phrase>\`, or \`!blacklist list\``)] });
      }

      const result = await handleBlacklist(message.guild, message.member, action, phrase);
      await message.reply({ embeds: [result.embed] });
    },
    async executeSlash(interaction) {
      const action = interaction.options.getString('action');
      const phrase = interaction.options.getString('phrase');

      if (action !== 'list' && !phrase) {
        return interaction.reply({ embeds: [embed.warn('Command Error', `${interaction.user} Please specify a phrase parameter for this action.`)], ephemeral: true });
      }

      const result = await handleBlacklist(interaction.guild, interaction.member, action, phrase);
      await interaction.reply({ embeds: [result.embed] });
    }
  },

  // --- AUTONICK COMMAND ---
  {
    name: 'autonick',
    description: 'Configures auto-nickname formatting for newly joining server members.',
    category: 'security',
    permissions: [PermissionFlagsBits.ManageNicknames],
    options: [
      {
        name: 'status',
        description: 'Enable or disable autonick formatting',
        type: 3,
        required: true,
        choices: [
          { name: 'Enable Autonick', value: 'on' },
          { name: 'Disable Autonick', value: 'off' }
        ]
      },
      {
        name: 'prefix',
        description: 'String to prepend (e.g. [Member] )',
        type: 3,
        required: false
      },
      {
        name: 'suffix',
        description: 'String to append (e.g. | Guest)',
        type: 3,
        required: false
      }
    ],
    async executePrefix(message, args) {
      const statusArg = args[0]?.toLowerCase();
      if (statusArg !== 'on' && statusArg !== 'off') {
        return message.reply({ embeds: [embed.warn('Command Error', `${message.author} Usage: \`!autonick <on|off> [prefix] [suffix]\``)] });
      }
      
      const prefix = args[1] || '';
      const suffix = args[2] || '';

      const result = await handleAutonick(message.guild, message.member, statusArg, prefix, suffix);
      await message.reply({ embeds: [result.embed] });
    },
    async executeSlash(interaction) {
      const status = interaction.options.getString('status');
      const prefix = interaction.options.getString('prefix') || '';
      const suffix = interaction.options.getString('suffix') || '';

      const result = await handleAutonick(interaction.guild, interaction.member, status, prefix, suffix);
      await interaction.reply({ embeds: [result.embed] });
    }
  },

  // --- CONFIG COMMAND ---
  {
    name: 'config',
    description: 'Dynamically adjusts system parameters, warning ceilings, and security toggles.',
    category: 'security',
    permissions: [PermissionFlagsBits.Administrator],
    options: [
      {
        name: 'setting',
        description: 'Target setting parameter to configure',
        type: 3,
        required: true,
        choices: [
          { name: 'Anti-Nuke Protection Toggle', value: 'antinuke' },
          { name: 'Anti-Spam Filter Toggle', value: 'antispam' },
          { name: 'Anti-Invite Blocker Toggle', value: 'antiinvite' },
          { name: 'Max Warning Limit (1-10)', value: 'maxwarnings' }
        ]
      },
      {
        name: 'value',
        description: 'True/False for toggles, or numbers (1-10) for ceilings',
        type: 3,
        required: true
      }
    ],
    async executePrefix(message, args) {
      const setting = args[0]?.toLowerCase();
      const value = args[1]?.toLowerCase();

      if (!setting || !value) {
        return message.reply({ embeds: [embed.warn('Command Error', `${message.author} Usage: \`!config <antinuke|antispam|antiinvite|maxwarnings> <on|off|number>\``)] });
      }

      const result = await handleConfig(message.guild, message.member, setting, value);
      await message.reply({ embeds: [result.embed] });
    },
    async executeSlash(interaction) {
      const setting = interaction.options.getString('setting');
      const value = interaction.options.getString('value');

      const result = await handleConfig(interaction.guild, interaction.member, setting, value);
      await interaction.reply({ embeds: [result.embed] });
    }
  },

  // --- ANTINUKE COMMAND ---
  {
    name: 'antinuke',
    description: 'Enables, disables, or configures the Anti-Nuke protections panel with buttons.',
    category: 'security',
    permissions: [PermissionFlagsBits.Administrator],
    options: [
      {
        name: 'subcommand',
        description: 'Choose antinuke subcommand action',
        type: 3,
        required: true,
        choices: [
          { name: 'Enable All Protections', value: 'enable_all' },
          { name: 'Disable All Protections', value: 'disable_all' },
          { name: 'Open Config Panel', value: 'config' }
        ]
      }
    ],
    async executePrefix(message, args) {
      const sub = args.join(' ').toLowerCase();

      if (sub === 'enable all' || sub === 'enable_all') {
        const result = await handleAntinukeToggleAll(message.guild, message.member, true);
        await message.reply({ embeds: [result.embed] });
      } else if (sub === 'disable all' || sub === 'disable_all') {
        const result = await handleAntinukeToggleAll(message.guild, message.member, false);
        await message.reply({ embeds: [result.embed] });
      } else if (sub === 'config') {
        const panel = await getAntinukeConfigPanel(message.guild);
        await message.reply({ embeds: [panel.embed], components: panel.components });
      } else {
        await message.reply({ embeds: [embed.warn('Command Error', `${message.author} Usage: \`!antinuke enable all\`, \`!antinuke disable all\`, or \`!antinuke config\``)] });
      }
    },
    async executeSlash(interaction) {
      const sub = interaction.options.getString('subcommand');

      if (sub === 'enable_all') {
        const result = await handleAntinukeToggleAll(interaction.guild, interaction.member, true);
        await interaction.reply({ embeds: [result.embed] });
      } else if (sub === 'disable_all') {
        const result = await handleAntinukeToggleAll(interaction.guild, interaction.member, false);
        await interaction.reply({ embeds: [result.embed] });
      } else if (sub === 'config') {
        const panel = await getAntinukeConfigPanel(interaction.guild);
        await interaction.reply({ embeds: [panel.embed], components: panel.components });
      }
    }
  },

  // --- SETHOMEVC COMMAND ---
  {
    name: 'sethomevc',
    description: 'Sets the Home Voice Channel for the bot to join and stay connected to.',
    category: 'security',
    permissions: [],
    options: [
      {
        name: 'channel',
        description: 'The Voice Channel (falls back to your current VC)',
        type: 7, // Channel
        required: false
      }
    ],
    async executePrefix(message, args) {
      const allowed = await isBotOwnerOrServerOwner(message.author, message.guild);
      if (!allowed) {
        return message.reply({ embeds: [embed.danger('Permission Denied', `${message.author} This command is restricted to the Bot Owner and the Server Owner.`)] });
      }

      let channelId = args[0]?.replace(/[<#&>]/g, '');
      let channel = null;
      if (channelId) {
        channel = await message.guild.channels.fetch(channelId).catch(() => null);
      }
      if (!channel) {
        channel = message.mentions.channels.filter(c => c.type === ChannelType.GuildVoice).first();
      }
      if (!channel && args[0]) {
        channel = message.guild.channels.cache.find(c => c.name.toLowerCase() === args.join(' ').toLowerCase() && c.type === ChannelType.GuildVoice);
      }
      if (!channel) {
        channel = message.member?.voice?.channel;
      }

      if (!channel || channel.type !== ChannelType.GuildVoice) {
        return message.reply({ embeds: [embed.warn('Setup Error', `${message.author} Please mention a Voice Channel, specify its ID, or join a Voice Channel first.`)] });
      }

      db.updateGuildConfig(message.guild.id, { homeVcId: channel.id });
      connectToHomeVc(message.guild, channel.id);

      await message.reply({ embeds: [embed.success('Home VC Configured', `Athena Prime has set **${channel.name}** (ID: \`${channel.id}\`) as its Home Voice Channel. The bot will now join and stay there.`)] });
    },
    async executeSlash(interaction) {
      const allowed = await isBotOwnerOrServerOwner(interaction.user, interaction.guild);
      if (!allowed) {
        return interaction.reply({ embeds: [embed.danger('Permission Denied', `${interaction.user} This command is restricted to the Bot Owner and the Server Owner.`)], ephemeral: true });
      }

      const voiceChannel = interaction.options.getChannel('channel');
      let channel = voiceChannel || interaction.member?.voice?.channel;

      if (!channel || channel.type !== ChannelType.GuildVoice) {
        return interaction.reply({ embeds: [embed.warn('Setup Error', `${interaction.user} Please specify a Voice Channel or join one first.`)], ephemeral: true });
      }

      db.updateGuildConfig(interaction.guild.id, { homeVcId: channel.id });
      connectToHomeVc(interaction.guild, channel.id);

      await interaction.reply({ embeds: [embed.success('Home VC Configured', `Athena Prime has set **${channel.name}** (ID: \`${channel.id}\`) as its Home Voice Channel. The bot will now join and stay there.`)] });
    }
  },

  // --- SETGUILDAVATAR COMMAND ---
  {
    name: 'setguildavatar',
    description: "Sets the bot's custom server-specific guild member avatar.",
    category: 'security',
    permissions: [],
    options: [
      {
        name: 'url',
        description: 'Direct image URL',
        type: 3,
        required: false
      },
      {
        name: 'image',
        description: 'Attach image file',
        type: 11,
        required: false
      }
    ],
    async executePrefix(message, args) {
      const allowed = await isBotOwnerOrServerOwner(message.author, message.guild);
      if (!allowed) {
        return message.reply({ embeds: [embed.danger('Permission Denied', `${message.author} This command is restricted to the Bot Owner and the Server Owner.`)] });
      }

      const url = args[0] || message.attachments.first()?.url;
      if (!url) {
        return message.reply({ embeds: [embed.warn('Command Error', `${message.author} Please provide a direct image URL or attach an image.`)] });
      }

      const responseMsg = await message.reply({ embeds: [embed.info('Updating Avatar', 'Attempting to configure guild-specific member avatar...')] });

      try {
        const buffer = await getImageBuffer(url);
        const dataUri = `data:image/png;base64,${buffer.toString('base64')}`;
        await message.client.rest.patch(`/guilds/${message.guild.id}/members/@me`, {
          body: { avatar: dataUri }
        });
        await responseMsg.edit({ embeds: [embed.success('Avatar Configured', "Successfully updated the bot's server-specific avatar.")] });
      } catch (err) {
        console.error(err);
        await responseMsg.edit({ embeds: [embed.danger('Update Failed', `Could not update avatar: ${err.message}`)] });
      }
    },
    async executeSlash(interaction) {
      const allowed = await isBotOwnerOrServerOwner(interaction.user, interaction.guild);
      if (!allowed) {
        return interaction.reply({ embeds: [embed.danger('Permission Denied', `${interaction.user} This command is restricted to the Bot Owner and the Server Owner.`)], ephemeral: true });
      }

      const url = interaction.options.getString('url') || interaction.options.getAttachment('image')?.url;
      if (!url) {
        return interaction.reply({ embeds: [embed.warn('Command Error', `${interaction.user} Please provide a direct image URL or attach an image.`)], ephemeral: true });
      }

      await interaction.deferReply();

      try {
        const buffer = await getImageBuffer(url);
        const dataUri = `data:image/png;base64,${buffer.toString('base64')}`;
        await interaction.client.rest.patch(`/guilds/${interaction.guild.id}/members/@me`, {
          body: { avatar: dataUri }
        });
        await interaction.editReply({ embeds: [embed.success('Avatar Configured', "Successfully updated the bot's server-specific avatar.")] });
      } catch (err) {
        console.error(err);
        await interaction.editReply({ embeds: [embed.danger('Update Failed', `Could not update avatar: ${err.message}`)] });
      }
    }
  },

  // --- SETGUILDBANNER COMMAND ---
  {
    name: 'setguildbanner',
    description: "Sets the bot's custom server-specific guild member banner.",
    category: 'security',
    permissions: [],
    options: [
      {
        name: 'url',
        description: 'Direct image URL',
        type: 3,
        required: false
      },
      {
        name: 'image',
        description: 'Attach image file',
        type: 11,
        required: false
      }
    ],
    async executePrefix(message, args) {
      const allowed = await isBotOwnerOrServerOwner(message.author, message.guild);
      if (!allowed) {
        return message.reply({ embeds: [embed.danger('Permission Denied', `${message.author} This command is restricted to the Bot Owner and the Server Owner.`)] });
      }

      const url = args[0] || message.attachments.first()?.url;
      if (!url) {
        return message.reply({ embeds: [embed.warn('Command Error', `${message.author} Please provide a direct image URL or attach an image.`)] });
      }

      const responseMsg = await message.reply({ embeds: [embed.info('Updating Banner', 'Attempting to configure guild-specific member banner...')] });

      try {
        const buffer = await getImageBuffer(url);
        const dataUri = `data:image/png;base64,${buffer.toString('base64')}`;
        await message.client.rest.patch(`/guilds/${message.guild.id}/members/@me`, {
          body: { banner: dataUri }
        });
        await responseMsg.edit({ embeds: [embed.success('Banner Configured', "Successfully updated the bot's server-specific banner.")] });
      } catch (err) {
        console.error(err);
        await responseMsg.edit({ embeds: [embed.danger('Update Failed', `Could not update banner: ${err.message}`)] });
      }
    },
    async executeSlash(interaction) {
      const allowed = await isBotOwnerOrServerOwner(interaction.user, interaction.guild);
      if (!allowed) {
        return interaction.reply({ embeds: [embed.danger('Permission Denied', `${interaction.user} This command is restricted to the Bot Owner and the Server Owner.`)], ephemeral: true });
      }

      const url = interaction.options.getString('url') || interaction.options.getAttachment('image')?.url;
      if (!url) {
        return interaction.reply({ embeds: [embed.warn('Command Error', `${interaction.user} Please provide a direct image URL or attach an image.`)], ephemeral: true });
      }

      await interaction.deferReply();

      try {
        const buffer = await getImageBuffer(url);
        const dataUri = `data:image/png;base64,${buffer.toString('base64')}`;
        await interaction.client.rest.patch(`/guilds/${interaction.guild.id}/members/@me`, {
          body: { banner: dataUri }
        });
        await interaction.editReply({ embeds: [embed.success('Banner Configured', "Successfully updated the bot's server-specific banner.")] });
      } catch (err) {
        console.error(err);
        await interaction.editReply({ embeds: [embed.danger('Update Failed', `Could not update banner: ${err.message}`)] });
      }
    }
  },

  // --- EXTRAOWNER COMMAND ---
  {
    name: 'extraowner',
    description: 'Manages extra owners who are immune to all moderation and can use all bot commands.',
    category: 'security',
    permissions: [],
    options: [
      {
        name: 'action',
        description: 'Choose action',
        type: 3,
        required: true,
        choices: [
          { name: 'Add Extra Owner', value: 'add' },
          { name: 'Remove Extra Owner', value: 'remove' },
          { name: 'List Extra Owners', value: 'list' }
        ]
      },
      {
        name: 'user',
        description: 'Target member for add/remove actions',
        type: 6,
        required: false
      }
    ],
    async executePrefix(message, args) {
      const allowed = await isBotOwnerOrServerOwner(message.author, message.guild);
      if (!allowed) {
        return message.reply({ embeds: [embed.danger('Permission Denied', `${message.author} Only the **Bot Owner** and **Server Owner** can manage extra owners.`)] });
      }

      const action = args[0]?.toLowerCase();
      const target = message.mentions.members.first();

      if (!action || (action !== 'list' && !target)) {
        return message.reply({ embeds: [embed.warn('Command Error', `${message.author} Usage: \`!extraowner add <@user>\`, \`!extraowner remove <@user>\`, or \`!extraowner list\``)] });
      }

      const result = await handleExtraOwner(message.guild, message.member, action, target?.user);
      await message.reply({ embeds: [result.embed] });
    },
    async executeSlash(interaction) {
      const allowed = await isBotOwnerOrServerOwner(interaction.user, interaction.guild);
      if (!allowed) {
        return interaction.reply({ embeds: [embed.danger('Permission Denied', `${interaction.user} Only the **Bot Owner** and **Server Owner** can manage extra owners.`)], ephemeral: true });
      }

      const action = interaction.options.getString('action');
      const targetUser = interaction.options.getUser('user');

      if (action !== 'list' && !targetUser) {
        return interaction.reply({ embeds: [embed.warn('Command Error', `${interaction.user} Please specify a target user for this action.`)], ephemeral: true });
      }

      const result = await handleExtraOwner(interaction.guild, interaction.member, action, targetUser);
      await interaction.reply({ embeds: [result.embed] });
    }
  },

  // --- ANTILINK COMMAND ---
  {
    name: 'antilink',
    description: 'Toggles anti-link protection that blocks ALL external URLs from non-moderators.',
    category: 'security',
    permissions: [PermissionFlagsBits.Administrator],
    options: [
      {
        name: 'status',
        description: 'Turn anti-link ON or OFF',
        type: 3,
        required: true,
        choices: [
          { name: 'Enable Anti-Link', value: 'on' },
          { name: 'Disable Anti-Link', value: 'off' }
        ]
      }
    ],
    async executePrefix(message, args) {
      const mode = args[0]?.toLowerCase();
      if (mode !== 'on' && mode !== 'off') {
        return message.reply({ embeds: [embed.warn('Command Error', `${message.author} Usage: \`!antilink <on|off>\``)] });
      }
      const result = await handleAntiLink(message.guild, message.member, mode);
      await message.reply({ embeds: [result.embed] });
    },
    async executeSlash(interaction) {
      const mode = interaction.options.getString('status');
      const result = await handleAntiLink(interaction.guild, interaction.member, mode);
      await interaction.reply({ embeds: [result.embed] });
    }
  },

  // --- SERVERINFO COMMAND ---
  {
    name: 'serverinfo',
    description: 'Displays comprehensive server statistics and security status.',
    category: 'security',
    permissions: [],
    async executePrefix(message) {
      const result = await getServerInfoEmbed(message.guild);
      await message.reply({ embeds: [result.embed] });
    },
    async executeSlash(interaction) {
      const result = await getServerInfoEmbed(interaction.guild);
      await interaction.reply({ embeds: [result.embed] });
    }
  },

  // --- USERINFO COMMAND ---
  {
    name: 'userinfo',
    description: 'Displays detailed information about a user including roles, warnings, and privileges.',
    category: 'security',
    permissions: [],
    options: [
      {
        name: 'user',
        description: 'The member to inspect (defaults to yourself)',
        type: 6,
        required: false
      }
    ],
    async executePrefix(message) {
      const target = message.mentions.members.first() || message.member;
      const result = await getUserInfoEmbed(message.guild, target);
      await message.reply({ embeds: [result.embed] });
    },
    async executeSlash(interaction) {
      const targetUser = interaction.options.getUser('user') || interaction.user;
      const target = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      
      if (!target) {
        return interaction.reply({ embeds: [embed.warn('Command Error', `${interaction.user} Member not found.`)], ephemeral: true });
      }

      const result = await getUserInfoEmbed(interaction.guild, target);
      await interaction.reply({ embeds: [result.embed] });
    }
  }
];

// Helper to check for Bot Owner exclusively
async function isBotOwnerOnly(user) {
  const client = user.client;
  try {
    if (!client.application.owner) {
      await client.application.fetch();
    }
    const owner = client.application.owner;
    if (owner) {
      if (owner.id) return user.id === owner.id;
      if (owner.members) return owner.members.has(user.id);
    }
  } catch (error) {
    console.error(error);
  }
  return false;
}

/**
 * Helper to fetch a media link URL and convert it into a Buffer for Discord API uploads
 */
async function getImageBuffer(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP fetch failed with status: ${response.status} ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (error) {
    throw new Error(`Failed to resolve image buffer from media link: ${error.message}`);
  }
}

// ==========================================
// CORE ISOLATION/QUARANTINE ENGINE
// ==========================================

export async function executeQuarantine(guild, targetMember, moderator, reason) {
  // Owner immunity check
  if (isBotOwnerSync(targetMember.id) || isExtraOwner(guild.id, targetMember.id)) {
    return { success: false, message: '🛡️ This user is protected by **Athena Prime** and cannot be quarantined.' };
  }

  // 1. Check permission checks (if triggered by a moderator and not an auto-event)
  if (moderator.id !== guild.members.me.id && !canModerate(moderator, targetMember)) {
    return { success: false, message: `You do not have enough power to quarantine **${targetMember.user.tag}**.` };
  }

  // 2. Check if already quarantined
  const existingRecord = db.getQuarantine(guild.id, targetMember.id);
  if (existingRecord) {
    return { success: false, message: `**${targetMember.user.tag}** is already quarantined.` };
  }

  try {
    // 3. Resolve role and channel
    const quarantineRole = await getOrCreateQuarantineRole(guild);
    if (!quarantineRole) {
      return { success: false, message: 'Could not create or locate the Quarantined role.' };
    }

    const quarantineChannel = await getOrCreateQuarantineChannel(guild, quarantineRole);
    if (!quarantineChannel) {
      return { success: false, message: 'Could not create or locate the quarantine-zone channel.' };
    }

    // Capture target voice state
    const prevVoiceChannelId = targetMember.voice.channelId || null;

    // 4. Save original roles to DB (filter out managed integration roles and @everyone)
    const roleIdsToSave = targetMember.roles.cache
      .filter(r => !r.managed && r.id !== guild.id)
      .map(r => r.id);

    db.addQuarantine(guild.id, targetMember.id, roleIdsToSave, reason, prevVoiceChannelId);

    // If target is connected to voice and quarantineVcId is set, drag them to the isolated VC
    const config = db.getGuildConfig(guild.id);
    if (prevVoiceChannelId && config.quarantineVcId) {
      const qvc = await guild.channels.fetch(config.quarantineVcId).catch(() => null);
      if (qvc) {
        await targetMember.voice.setChannel(qvc, 'Quarantine Isolation Voice Movement').catch(() => null);
      }
    }

    // 5. Strip all roles and add quarantine role (preserving managed roles to avoid API crash)
    const managedRoles = targetMember.roles.cache.filter(r => r.managed).map(r => r.id);
    const newRoles = [...managedRoles, quarantineRole.id];
    
    await targetMember.roles.set(newRoles, `Quarantined by ${moderator.user?.tag || 'System'} | Reason: ${reason}`);

    // 6. DM target user
    const dmEmbed = embed.danger(
      'Server Isolation Notice',
      `⚠️ You have been placed under **Quarantine** in **${guild.name}**.`,
      [
        { name: 'Reason', value: reason },
        { name: 'Assigned By', value: `${moderator.user?.tag || 'Automated System'}` },
        { name: 'Instructions', value: `Your access to the rest of the server has been restricted. Please navigate to the designated quarantine channel: <#${quarantineChannel.id}> to resolve this matter with the moderation staff.` }
      ]
    );
    await targetMember.send({ embeds: [dmEmbed] }).catch(() => null);

    // 7. Ping target in quarantine channel and post welcome alert
    const welcomeEmbed = embed.danger(
      'Isolation Protocol Initiated',
      `Hello ${targetMember}. You have been isolated in this channel due to security policies or staff intervention.`,
      [
        { name: 'Target User', value: `${targetMember.user.tag}`, inline: true },
        { name: 'Reason', value: reason },
        { name: 'Next Steps', value: 'Please wait patiently for a Administrator or Moderator to review your case. Any further spamming or rule violations will result in a permanent ban.' }
      ]
    );
    await quarantineChannel.send({ content: `${targetMember}`, embeds: [welcomeEmbed] }).catch(() => null);

    // 8. Log the event to logs channel
    logToSecurityChannel(guild, embed.log(
      'Quarantine Applied',
      `Member has been isolated.`,
      [
        { name: 'Target', value: `${targetMember.user.tag} (${targetMember.id})`, inline: true },
        { name: 'Enforcer', value: `${moderator.user?.tag || 'System'}`, inline: true },
        { name: 'Reason', value: reason }
      ],
      'danger'
    ));

    const responseEmbed = embed.danger(
      'Quarantine Activated',
      `Successfully quarantined **${targetMember.user.tag}**.`,
      [
        { name: 'Member', value: `${targetMember}`, inline: true },
        { name: 'Enforced by', value: `${moderator}`, inline: true },
        { name: 'Channel', value: `<#${quarantineChannel.id}>`, inline: true },
        { name: 'Reason', value: reason }
      ]
    );

    return { success: true, embed: responseEmbed };
  } catch (error) {
    console.error('Error applying quarantine:', error);
    return { success: false, message: 'An error occurred during isolation. Check role hierarchies.' };
  }
}

export async function executeUnquarantine(guild, targetMember, moderator) {
  const record = db.getQuarantine(guild.id, targetMember.id);
  if (!record) {
    return { success: false, message: `**${targetMember.user.tag}** has no active quarantine records on disk.` };
  }

  try {
    const quarantineRole = await getOrCreateQuarantineRole(guild);
    
    // Determine restore role IDs
    const savedRoleIds = record.roles || [];
    const managedRoleIds = targetMember.roles.cache.filter(r => r.managed).map(r => r.id);
    
    // Add saved + managed, remove quarantine
    const restoreRoles = [...new Set([...savedRoleIds, ...managedRoleIds])].filter(id => id !== quarantineRole?.id);

    await targetMember.roles.set(restoreRoles, `Unquarantined by ${moderator.user?.tag || 'System'}`);

    // If target was in voice before quarantine, and is currently connected to voice, restore their channel position
    if (record.previousVoiceChannelId && targetMember.voice.channelId) {
      const prevVc = await guild.channels.fetch(record.previousVoiceChannelId).catch(() => null);
      if (prevVc) {
        await targetMember.voice.setChannel(prevVc, 'Quarantine Release Voice Restoration').catch(() => null);
      }
    }

    // Remove DB entry
    db.removeQuarantine(guild.id, targetMember.id);

    // DM target user
    const dmEmbed = embed.success(
      'Isolation Terminated',
      `🎉 Your quarantine status has been lifted in **${guild.name}**! Your original access privileges have been fully restored.`,
      []
    );
    await targetMember.send({ embeds: [dmEmbed] }).catch(() => null);

    // Log the event
    logToSecurityChannel(guild, embed.log(
      'Quarantine Lifted',
      `Member has been restored.`,
      [
        { name: 'Target', value: `${targetMember.user.tag} (${targetMember.id})`, inline: true },
        { name: 'Moderator', value: `${moderator.user?.tag || 'System'}`, inline: true }
      ],
      'success'
    ));

    const responseEmbed = embed.success(
      'Quarantine Lifted',
      `Successfully restored **${targetMember.user.tag}** and recovered their original role structure.`,
      [
        { name: 'User', value: `${targetMember}`, inline: true },
        { name: 'Moderator', value: `${moderator}`, inline: true }
      ]
    );

    return { success: true, embed: responseEmbed };
  } catch (error) {
    console.error('Error lifting quarantine:', error);
    return { success: false, message: 'Failed to restore roles. Ensure my role position is higher than the roles being restored.' };
  }
}

// ==========================================
// CORE LOCKDOWN & RAIDMODE HANDLERS
// ==========================================

async function handleLockdown(guild, channel, moderator, mode) {
  try {
    if (mode === 'on') {
      await channel.permissionOverwrites.edit(guild.roles.everyone, {
        SendMessages: false
      });
      const lockEmbed = embed.danger(
        'Lockdown Activated', 
        `🔴 This channel has been placed under administrative lockdown by **${moderator.user.tag}**. Writing has been disabled.`
      );
      logToSecurityChannel(guild, embed.log('Channel Locked', `Moderator **${moderator.user.tag}** locked down channel **#${channel.name}**.`, [], 'warning'));
      return { embed: lockEmbed };
    } else {
      await channel.permissionOverwrites.edit(guild.roles.everyone, {
        SendMessages: null
      });
      const unlockEmbed = embed.success(
        'Lockdown Deactivated', 
        `🟢 Channel lockdown has been lifted by **${moderator.user.tag}**. Permission to write has been restored.`
      );
      logToSecurityChannel(guild, embed.log('Channel Unlocked', `Moderator **${moderator.user.tag}** unlocked channel **#${channel.name}**.`, [], 'success'));
      return { embed: unlockEmbed };
    }
  } catch (error) {
    console.error(error);
    return { embed: embed.danger('Lockdown Toggle Failed', 'Could not modify permissions for this channel.') };
  }
}

async function handleRaidMode(guild, moderator, mode) {
  const enabled = mode === 'on';
  db.updateGuildConfig(guild.id, { raidMode: enabled });

  if (enabled) {
    const resEmbed = embed.raid(
      'Raid Mode Engaged',
      `🚨 **Server Raid Protection is now ACTIVE.**\nAll joining accounts will be automatically quarantined immediately to protect the server until deactivated.`,
      [{ name: 'Enforced by', value: `${moderator}` }]
    );
    logToSecurityChannel(guild, embed.log('Raid Mode Active', `Administrator **${moderator.user.tag}** turned ON Guild Raid Mode.`, [], 'raid'));
    return { embed: resEmbed };
  } else {
    const resEmbed = embed.success(
      'Raid Mode Disengaged',
      `🛡️ **Server Raid Protection is now OFF.**\nNew accounts can join normally.`,
      [{ name: 'Lifted by', value: `${moderator}` }]
    );
    logToSecurityChannel(guild, embed.log(
      'Raid Mode Off', 
      `Administrator **${moderator.user.tag}** turned OFF Guild Raid Mode.`, 
      [], 
      'success'
    ));
    return { embed: resEmbed };
  }
}

async function handleWhitelist(guild, moderator, action, targetUser) {
  if (action === 'add') {
    const success = db.addWhitelist(guild.id, targetUser.id);
    if (success) {
      logToSecurityChannel(guild, embed.log('Whitelist Added', `Administrator **${moderator.user.tag}** added **${targetUser.tag}** to whitelist.`, [], 'success'));
      return { embed: embed.success('Whitelist Added', `Successfully added **${targetUser.tag}** to the security whitelist. They are now immune to all filters.`) };
    } else {
      return { embed: embed.info('Already Whitelisted', `**${targetUser.tag}** is already whitelisted.`) };
    }
  } else if (action === 'remove') {
    const success = db.removeWhitelist(guild.id, targetUser.id);
    if (success) {
      logToSecurityChannel(guild, embed.log('Whitelist Removed', `Administrator **${moderator.user.tag}** removed **${targetUser.tag}** from whitelist.`, [], 'warning'));
      return { embed: embed.success('Whitelist Removed', `Successfully removed **${targetUser.tag}** from the security whitelist.`) };
    } else {
      return { embed: embed.warn('Not Whitelisted', `**${targetUser.tag}** is not currently whitelisted.`) };
    }
  } else {
    const config = db.getGuildConfig(guild.id);
    const list = config.whitelist || [];
    if (list.length === 0) {
      return { embed: embed.info('Whitelist Empty', `There are no custom whitelisted members in this guild. The owner <@${guild.ownerId}> is always immune.`) };
    }
    
    const formattedList = list.map(id => `<@${id}> (ID: \`${id}\`)`).join('\n');
    return { embed: embed.info('Security Whitelist', `Whitelisted users immune to Anti-Nuke, Anti-Spam, and Auto-Mod:\n\n**Owner (Always Immune):** <@${guild.ownerId}>\n\n**Custom Whitelist:**\n${formattedList}`) };
  }
}

async function handleBlacklist(guild, moderator, action, phrase) {
  if (action === 'add') {
    const success = db.addBlacklistWord(guild.id, phrase);
    if (success) {
      logToSecurityChannel(guild, embed.log('Word Filter Added', `Moderator **${moderator.user.tag}** blacklisted phrase: "${phrase}".`, [], 'warning'));
      return { embed: embed.success('Word Blacklisted', `Successfully blacklisted term **"${phrase.toLowerCase()}"**. Messages matching this phrase will be deleted.`) };
    } else {
      return { embed: embed.info('Already Blacklisted', `Term **"${phrase.toLowerCase()}"** is already blacklisted.`) };
    }
  } else if (action === 'remove') {
    const success = db.removeBlacklistWord(guild.id, phrase);
    if (success) {
      logToSecurityChannel(guild, embed.log('Word Filter Removed', `Moderator **${moderator.user.tag}** un-blacklisted phrase: "${phrase}".`, [], 'success'));
      return { embed: embed.success('Word Un-blacklisted', `Successfully removed **"${phrase.toLowerCase()}"** from word blacklist.`) };
    } else {
      return { embed: embed.warn('Not Blacklisted', `Term **"${phrase.toLowerCase()}"** is not currently blacklisted.`) };
    }
  } else {
    const config = db.getGuildConfig(guild.id);
    const list = config.blacklistWords || [];
    if (list.length === 0) {
      return { embed: embed.success('Blacklist Empty', 'There are no active blacklisted words in this server.') };
    }
    const formattedWords = list.map(w => `• \`${w}\``).join('\n');
    return { embed: embed.info('Filtered Word Blacklist', `If a non-moderator sends a message matching any of these terms, it will be deleted immediately:\n\n${formattedWords}`) };
  }
}

async function handleAutonick(guild, moderator, status, prefix, suffix) {
  const enabled = status === 'on';
  const updates = {
    autonick: {
      enabled,
      prefix,
      suffix
    }
  };

  db.updateGuildConfig(guild.id, updates);

  const fields = [
    { name: 'Autonick Status', value: enabled ? '🟢 ENABLED' : '🔴 DISABLED', inline: true }
  ];
  if (enabled) {
    if (prefix) fields.push({ name: 'Appended Prefix', value: `\`${prefix}\``, inline: true });
    if (suffix) fields.push({ name: 'Appended Suffix', value: `\`${suffix}\``, inline: true });
  }

  const resEmbed = embed.success(
    'Auto-Nickname Configured',
    enabled 
      ? 'New joining members will now have their nicknames automatically formatted.' 
      : 'Auto-nickname formatting has been deactivated.',
    fields
  );

  logToSecurityChannel(guild, embed.log(
    'Auto-Nick Updated',
    `Moderator updated auto-nickname settings.`,
    [
      { name: 'Enabled', value: enabled ? 'Yes' : 'No', inline: true },
      { name: 'Prefix', value: prefix || 'None', inline: true },
      { name: 'Suffix', value: suffix || 'None', inline: true }
    ],
    enabled ? 'success' : 'warning'
  ));

  return { embed: resEmbed };
}

async function handleConfig(guild, moderator, setting, value) {
  const updates = {};
  
  if (setting === 'maxwarnings') {
    const num = parseInt(value);
    if (isNaN(num) || num < 1 || num > 10) {
      return { embed: embed.warn('Invalid Setting', 'Maximum warnings must be a number between 1 and 10.') };
    }
    updates.maxWarnings = num;
    db.updateGuildConfig(guild.id, updates);

    logToSecurityChannel(guild, embed.log('Config Updated', `Administrator **${moderator.user.tag}** set maxWarnings to **${num}**.`, [], 'success'));
    return { embed: embed.success('Warnings Limit Updated', `Exceeding **${num} Warnings** will now result in an automated server quarantine.`) };
  }

  if (value !== 'on' && value !== 'off') {
    return { embed: embed.warn('Invalid Value', 'Value for toggles must be either `on` or `off` (e.g. `!config antispam off`).') };
  }

  const enabled = value === 'on';

  if (setting === 'antinuke') {
    updates.antiNukeEnabled = enabled;
    db.updateGuildConfig(guild.id, updates);
    const modeDesc = enabled ? '🟢 ACTIVE (Rapid deletions or bans will trigger instant quarantine)' : '🔴 DEACTIVATED';
    logToSecurityChannel(guild, embed.log('Config Anti-Nuke Toggle', `Administrator **${moderator.user.tag}** toggled Anti-Nuke to **${value.toUpperCase()}**.`, [], enabled ? 'success' : 'warning'));
    return { embed: embed.success('Anti-Nuke Configured', `Anti-Nuke server protections are now **${modeDesc}**.`) };
  } else if (setting === 'antispam') {
    updates.antiSpamEnabled = enabled;
    db.updateGuildConfig(guild.id, updates);
    const modeDesc = enabled ? '🟢 ACTIVE' : '🔴 DEACTIVATED';
    logToSecurityChannel(guild, embed.log('Config Anti-Spam Toggle', `Administrator **${moderator.user.tag}** toggled Anti-Spam to **${value.toUpperCase()}**.`, [], enabled ? 'success' : 'warning'));
    return { embed: embed.success('Anti-Spam Configured', `Automated rate-limit filters are now **${modeDesc}**.`) };
  } else if (setting === 'antiinvite') {
    updates.antiInviteEnabled = enabled;
    db.updateGuildConfig(guild.id, updates);
    const modeDesc = enabled ? '🟢 ACTIVE' : '🔴 DEACTIVATED';
    logToSecurityChannel(guild, embed.log('Config Anti-Invite Toggle', `Administrator **${moderator.user.tag}** toggled Anti-Invite to **${value.toUpperCase()}**.`, [], enabled ? 'success' : 'warning'));
    return { embed: embed.success('Anti-Invite Configured', `Discord invite link auto-mod is now **${modeDesc}**.`) };
  }

  return { embed: embed.warn('Config Error', 'Unknown configuration option.') };
}

export async function getAntinukeConfigPanel(guild) {
  const config = db.getGuildConfig(guild.id);

  const blacklistState = config.blacklistWords && config.blacklistWords.length > 0;
  const spamState = config.antiSpamEnabled;
  const inviteState = config.antiInviteEnabled !== false;
  const nukeState = config.antiNukeEnabled;

  const fields = [
    { name: '🛡️ Anti-Nuke Shield', value: nukeState ? '🟢 **ENABLED**' : '🔴 **DISABLED**', inline: true },
    { name: '⚡ Anti-Spam Filter', value: spamState ? '🟢 **ENABLED**' : '🔴 **DISABLED**', inline: true },
    { name: '🔗 Anti-Invite Blocker', value: inviteState ? '🟢 **ENABLED**' : '🔴 **DISABLED**', inline: true },
    { name: '📝 Word Filter (Swears)', value: blacklistState ? `🟢 **ENABLED** (${config.blacklistWords.length} Words)` : '🔴 **DISABLED**', inline: true },
    { name: '🛡️ Nuke Punishment', value: `\`${config.antiNukePunishment.toUpperCase()}\``, inline: true },
    { name: '🚨 Warning Ceiling', value: `\`${config.maxWarnings} Warnings\``, inline: true }
  ];

  const panelEmbed = embed.info(
    'Athena Prime Defense Panel',
    'Administrators can click the button switches below to toggle active protections dynamically.',
    fields
  );

  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('toggle_antinuke')
      .setLabel(`Anti-Nuke: ${nukeState ? 'ON' : 'OFF'}`)
      .setStyle(nukeState ? ButtonStyle.Success : ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('toggle_spam')
      .setLabel(`Anti-Spam: ${spamState ? 'ON' : 'OFF'}`)
      .setStyle(spamState ? ButtonStyle.Success : ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('toggle_invite')
      .setLabel(`Anti-Invite: ${inviteState ? 'ON' : 'OFF'}`)
      .setStyle(inviteState ? ButtonStyle.Success : ButtonStyle.Danger)
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('toggle_blacklist_filter')
      .setLabel(`Word Filter: ${blacklistState ? 'ON' : 'OFF'}`)
      .setStyle(blacklistState ? ButtonStyle.Success : ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId('cycle_punishment')
      .setLabel(`Punishment: ${config.antiNukePunishment.toUpperCase()}`)
      .setStyle(ButtonStyle.Primary)
  );

  return { embed: panelEmbed, components: [row1, row2] };
}

export async function handleAntinukeToggleAll(guild, moderator, enable) {
  const updates = {
    antiNukeEnabled: enable,
    antiSpamEnabled: enable,
    antiInviteEnabled: enable,
    autonick: {
      enabled: enable,
      prefix: enable ? '[Guest]' : '',
      suffix: ''
    }
  };

  db.updateGuildConfig(guild.id, updates);

  // If enabling all, ensure word blacklist is active
  if (enable) {
    const config = db.getGuildConfig(guild.id);
    if (!config.blacklistWords || config.blacklistWords.length === 0) {
      db.addBlacklistWord(guild.id, 'hack');
      db.addBlacklistWord(guild.id, 'nuke');
      db.addBlacklistWord(guild.id, 'spam');
    }
  } else {
    // If disabling all, empty blacklist words as well to disable word filter
    db.updateGuildConfig(guild.id, { blacklistWords: [] });
  }

  const resEmbed = enable
    ? embed.success(
        'Hyper-Defense Shields ENGAGED',
        '🚨 All Athena Prime protective filters are now **ACTIVE**.\nSwear words scanner, Anti-Invite blocks, Anti-Spam limits, Autonick joins, and Anti-Nuke restorations are fully armed!',
        [{ name: 'Enforced by', value: `${moderator}` }]
      )
    : embed.warn(
        'Hyper-Defense Shields DISENGAGED',
        '🛡️ Athena Prime protective filters have been **DEACTIVATED** server-wide.',
        [{ name: 'Lifted by', value: `${moderator}` }]
      );

  logToSecurityChannel(guild, embed.log(
    'Hyper-Defense Toggle All',
    `Administrator **${moderator.user.tag}** toggled all shields **${enable ? 'ON' : 'OFF'}**.`,
    [],
    enable ? 'success' : 'warning'
  ));

  return { embed: resEmbed };
}

// ==========================================
// NEW COMMAND HANDLERS
// ==========================================

async function handleExtraOwner(guild, moderator, action, targetUser) {
  if (action === 'add') {
    if (!targetUser) return { embed: embed.warn('Missing User', 'Please specify a user to add as extra owner.') };
    
    const success = db.addExtraOwner(guild.id, targetUser.id);
    if (success) {
      logToSecurityChannel(guild, embed.log('Extra Owner Added', `**${moderator.user.tag}** added **${targetUser.tag}** as an Extra Owner.`, [], 'success'));
      return { embed: embed.owner('Extra Owner Added', `Successfully added **${targetUser.tag}** as an **Extra Owner**.\n\nThey are now:\n• 🛡️ **Immune** to all moderation actions\n• 👑 **Authorized** to use all bot commands\n• ✅ **Whitelisted** from all auto-mod filters`) };
    } else {
      return { embed: embed.info('Already Extra Owner', `**${targetUser.tag}** is already registered as an Extra Owner.`) };
    }
  } else if (action === 'remove') {
    if (!targetUser) return { embed: embed.warn('Missing User', 'Please specify a user to remove from extra owners.') };
    
    const success = db.removeExtraOwner(guild.id, targetUser.id);
    if (success) {
      logToSecurityChannel(guild, embed.log('Extra Owner Removed', `**${moderator.user.tag}** removed **${targetUser.tag}** from Extra Owners.`, [], 'warning'));
      return { embed: embed.success('Extra Owner Removed', `Successfully removed **${targetUser.tag}** from Extra Owners. They no longer have owner-level privileges.`) };
    } else {
      return { embed: embed.warn('Not Extra Owner', `**${targetUser.tag}** is not currently an Extra Owner.`) };
    }
  } else {
    // List
    const owners = db.getExtraOwners(guild.id);
    if (owners.length === 0) {
      return { embed: embed.info('No Extra Owners', `There are no extra owners configured for this server.\n\n**Bot Owner:** <@${process.env.OWNER_ID || 'Unknown'}>\n**Server Owner:** <@${guild.ownerId}>`) };
    }

    const formattedList = owners.map(id => `• <@${id}> (ID: \`${id}\`)`).join('\n');
    return { embed: embed.owner('Extra Owners List', `**Bot Owner:** <@${process.env.OWNER_ID || 'Unknown'}>\n**Server Owner:** <@${guild.ownerId}>\n\n**Extra Owners:**\n${formattedList}`) };
  }
}

async function handleAntiLink(guild, moderator, mode) {
  const enabled = mode === 'on';
  db.updateGuildConfig(guild.id, { antiLinkEnabled: enabled });

  const modeDesc = enabled ? '🟢 ACTIVE' : '🔴 DEACTIVATED';
  const resEmbed = embed.success(
    'Anti-Link Configured',
    `External URL auto-mod filter is now **${modeDesc}**.\n\n${enabled ? 'All external links from non-moderators will be automatically deleted.' : 'Users can freely share external links.'}`,
    [{ name: 'Changed by', value: `${moderator}` }]
  );

  logToSecurityChannel(guild, embed.log(
    'Anti-Link Toggle',
    `Administrator **${moderator.user.tag}** toggled Anti-Link to **${mode.toUpperCase()}**.`,
    [],
    enabled ? 'success' : 'warning'
  ));

  return { embed: resEmbed };
}

async function getServerInfoEmbed(guild) {
  const config = db.getGuildConfig(guild.id);
  
  // Fetch owner
  const owner = await guild.members.fetch(guild.ownerId).catch(() => null);
  const ownerTag = owner ? owner.user.tag : 'Unknown';

  const totalMembers = guild.memberCount;
  const roleCount = guild.roles.cache.size;
  const channelCount = guild.channels.cache.size;
  const boostLevel = guild.premiumTier;
  const boostCount = guild.premiumSubscriptionCount || 0;
  const createdAt = `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`;

  const antiNukeStatus = config.antiNukeEnabled ? '🟢 ON' : '🔴 OFF';
  const antiSpamStatus = config.antiSpamEnabled ? '🟢 ON' : '🔴 OFF';
  const antiInviteStatus = (config.antiInviteEnabled !== false) ? '🟢 ON' : '🔴 OFF';
  const antiLinkStatus = config.antiLinkEnabled ? '🟢 ON' : '🔴 OFF';
  const raidModeStatus = config.raidMode ? '🚨 ENGAGED' : '🟢 STANDBY';

  const fields = [
    { name: '👑 Owner', value: `${ownerTag}`, inline: true },
    { name: '👥 Members', value: `**${totalMembers}**`, inline: true },
    { name: '📋 Roles', value: `**${roleCount}**`, inline: true },
    { name: '💬 Channels', value: `**${channelCount}**`, inline: true },
    { name: '🚀 Boost Level', value: `**Tier ${boostLevel}** (${boostCount} boosts)`, inline: true },
    { name: '📅 Created', value: createdAt, inline: true },
    { name: '\u200b', value: '**── Security Status ──**' },
    { name: '🛡️ Anti-Nuke', value: antiNukeStatus, inline: true },
    { name: '⚡ Anti-Spam', value: antiSpamStatus, inline: true },
    { name: '🔗 Anti-Invite', value: antiInviteStatus, inline: true },
    { name: '🌐 Anti-Link', value: antiLinkStatus, inline: true },
    { name: '🚨 Raid Mode', value: raidModeStatus, inline: true },
    { name: '⚠️ Max Warns', value: `\`${config.maxWarnings}\``, inline: true }
  ];

  const serverEmbed = embed.security(
    `${guild.name} — Server Info`,
    `Comprehensive server statistics and Athena Prime security overview.`,
    fields
  );

  if (guild.iconURL()) {
    serverEmbed.setThumbnail(guild.iconURL({ dynamic: true, size: 256 }));
  }

  return { embed: serverEmbed };
}

async function getUserInfoEmbed(guild, member) {
  const warnings = db.getWarnings(guild.id, member.id);
  const isWhitelisted = db.isWhitelisted(guild, member.id);
  const isExtra = db.isExtraOwner(guild.id, member.id);
  const isBotOwn = isBotOwnerSync(member.id);
  const isServerOwner = member.id === guild.ownerId;

  const roles = member.roles.cache
    .filter(r => r.id !== guild.id)
    .sort((a, b) => b.position - a.position)
    .map(r => `${r}`)
    .slice(0, 20)
    .join(', ') || 'None';

  let privileges = [];
  if (isBotOwn) privileges.push('👑 **Bot Owner**');
  if (isServerOwner) privileges.push('🏠 **Server Owner**');
  if (isExtra) privileges.push('⭐ **Extra Owner**');
  if (isWhitelisted) privileges.push('✅ **Whitelisted**');
  if (privileges.length === 0) privileges.push('Standard Member');

  const fields = [
    { name: '🏷️ Username', value: `${member.user.tag}`, inline: true },
    { name: '🆔 User ID', value: `\`${member.id}\``, inline: true },
    { name: '📅 Account Created', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
    { name: '📥 Joined Server', value: `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`, inline: true },
    { name: '⚠️ Active Warnings', value: `\`${warnings.length}\``, inline: true },
    { name: '🛡️ Privileges', value: privileges.join(' | '), inline: true },
    { name: `📋 Roles [${member.roles.cache.size - 1}]`, value: roles }
  ];

  const userEmbed = embed.info(
    `User Info — ${member.user.tag}`,
    `Detailed profile and privilege information.`,
    fields
  );

  userEmbed.setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }));

  return { embed: userEmbed };
}
