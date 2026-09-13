import { PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import db from '../database.js';
import cv2 from '../cv2.js';

export const commands = [
  {
    name: 'suggest',
    aliases: ['suggestion'],
    description: 'Submit a suggestion to the server.',
    category: 'community',
    permissions: [],
    async executePrefix(message, args) {
      if (!args.length) return message.reply(cv2.info('Suggest Command', 'Usage: `!suggest [your idea]`'));
      
      const config = db.getGuildConfig(message.guild.id);
      if (!config || !config.suggestionChannelId) {
        return message.reply(cv2.warn('Suggestions Disabled', 'This server has not configured a suggestions channel yet.'));
      }
      
      const suggestionChannel = message.guild.channels.cache.get(config.suggestionChannelId);
      if (!suggestionChannel) return message.reply(cv2.danger('Error', 'The configured suggestions channel no longer exists.'));
      
      const idea = args.join(' ');
      
      const embed = new EmbedBuilder()
        .setAuthor({ name: `${message.author.tag} suggests:`, iconURL: message.author.displayAvatarURL() })
        .setDescription(idea)
        .setColor(0x2b2d31)
        .setFooter({ text: `User ID: ${message.author.id}` })
        .setTimestamp();
        
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('sug_up').setEmoji('👍').setStyle(ButtonStyle.Secondary).setLabel('0'),
        new ButtonBuilder().setCustomId('sug_down').setEmoji('👎').setStyle(ButtonStyle.Secondary).setLabel('0')
      );
      
      try {
        await suggestionChannel.send({ embeds: [embed], components: [row] });
        await message.reply(cv2.success('Suggestion Submitted', `Your suggestion has been posted in <#${config.suggestionChannelId}>!`));
      } catch (err) {
        message.reply(cv2.danger('Error', 'Failed to post suggestion. Check channel permissions.'));
      }
    }
  },
  {
    name: 'setsuggestions',
    aliases: ['suggestchannel'],
    description: 'Set the channel for server suggestions.',
    category: 'admin',
    permissions: [PermissionFlagsBits.ManageGuild],
    async executePrefix(message, args) {
      const channel = message.mentions.channels.first();
      if (!channel) return message.reply(cv2.info('Setup Suggestions', 'Usage: `!setsuggestions <#channel>`'));
      
      db.updateGuildConfig(message.guild.id, { suggestionChannelId: channel.id });
      await message.reply(cv2.success('Suggestions Enabled', `All suggestions will now be posted in ${channel}.`));
    }
  },
  {
    name: 'starboard',
    description: 'Configure the starboard system.',
    category: 'admin',
    permissions: [PermissionFlagsBits.ManageGuild],
    async executePrefix(message, args) {
      if (args[0] === 'disable') {
        db.updateGuildConfig(message.guild.id, { starboardChannelId: null });
        return message.reply(cv2.success('Starboard Disabled', 'The starboard system has been disabled.'));
      }
      
      const channel = message.mentions.channels.first();
      if (!channel) return message.reply(cv2.info('Starboard Setup', 'Usage: `!starboard <#channel> [stars_required]`\nTo disable: `!starboard disable`'));
      
      const threshold = parseInt(args[1]) || 3;
      db.updateGuildConfig(message.guild.id, { starboardChannelId: channel.id, starboardThreshold: threshold });
      await message.reply(cv2.success('Starboard Enabled', `Messages with **${threshold} ⭐** reactions will be posted in ${channel}.`));
    }
  },
  {
    name: 'voicerole',
    description: 'Set a role to be given when users join a voice channel.',
    category: 'admin',
    permissions: [PermissionFlagsBits.ManageGuild],
    async executePrefix(message, args) {
      if (args[0] === 'disable') {
        db.updateGuildConfig(message.guild.id, { voiceRoleId: null });
        return message.reply(cv2.success('Voice Role Disabled', 'The automatic voice role system has been disabled.'));
      }
      
      const role = message.mentions.roles.first();
      if (!role) return message.reply(cv2.info('Voice Role Setup', 'Usage: `!voicerole <@role>`\nTo disable: `!voicerole disable`'));
      
      db.updateGuildConfig(message.guild.id, { voiceRoleId: role.id });
      await message.reply(cv2.success('Voice Role Enabled', `The ${role} role will now be automatically given to members when they join a voice channel, and removed when they leave.`));
    }
  }
];

export async function handleSuggestionButtons(interaction) {
  if (!interaction.customId.startsWith('sug_')) return;
  
  const msg = interaction.message;
  if (!msg.embeds.length) return;
  
  // Anti-spam logic: fetch users who clicked
  const upBtn = msg.components[0].components[0];
  const downBtn = msg.components[0].components[1];
  
  let upCount = parseInt(upBtn.label) || 0;
  let downCount = parseInt(downBtn.label) || 0;
  
  // We'll use a local cache per message to track who voted.
  if (!msg.client.suggestionVotes) msg.client.suggestionVotes = new Map();
  if (!msg.client.suggestionVotes.has(msg.id)) msg.client.suggestionVotes.set(msg.id, new Map());
  
  const voters = msg.client.suggestionVotes.get(msg.id);
  const currentVote = voters.get(interaction.user.id);
  const action = interaction.customId === 'sug_up' ? 'up' : 'down';
  
  if (currentVote === action) {
    // Retracting vote
    voters.delete(interaction.user.id);
    if (action === 'up') upCount--;
    else downCount--;
    await interaction.reply({ content: 'Vote retracted.', flags: MessageFlags.Ephemeral });
  } else {
    // Changing or new vote
    if (currentVote === 'up') upCount--;
    if (currentVote === 'down') downCount--;
    
    if (action === 'up') upCount++;
    else downCount++;
    
    voters.set(interaction.user.id, action);
    await interaction.reply({ content: 'Vote registered.', flags: MessageFlags.Ephemeral });
  }
  
  const newRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('sug_up').setEmoji('👍').setStyle(ButtonStyle.Secondary).setLabel(String(upCount)),
    new ButtonBuilder().setCustomId('sug_down').setEmoji('👎').setStyle(ButtonStyle.Secondary).setLabel(String(downCount))
  );
  
  await msg.edit({ components: [newRow] }).catch(()=>null);
}
