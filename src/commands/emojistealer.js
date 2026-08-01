import { ActionRowBuilder, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';
import embed from '../embed.js';
import { isBotOwnerSync } from '../utils/helpers.js';

export const commands = [{
  name: 'stealemoji',
  description: 'Steal emojis from this server and copy them to another (Strictly for owners)',
  async executePrefix(message) {
    const isBotOwner = isBotOwnerSync(message.author.id);
    const isServerOwner = message.author.id === message.guild.ownerId;

    if (!isBotOwner && !isServerOwner) {
      await message.reply({ embeds: [embed.danger('Access Denied', 'Only the Bot Owner or the Server Owner can use the Emoji Stealer.')] });
      return;
    }

    const emojis = message.guild.emojis.cache;
    if (emojis.size === 0) {
      await message.reply({ embeds: [embed.warn('No Emojis', 'There are no emojis in this server to steal.')] });
      return;
    }

    // Find valid target servers
    // User must be bot owner, OR they must be the server owner of the target server
    const targetServers = [];
    for (const guild of message.client.guilds.cache.values()) {
      if (guild.id === message.guild.id) continue;
      
      // Strict rule: if a server owner uses it, they must ALSO be the server owner of the target server
      if (isBotOwner || guild.ownerId === message.author.id) {
        targetServers.push(guild);
      }
    }

    if (targetServers.length === 0) {
      await message.reply({ embeds: [embed.warn('No Target Servers', 'I am not in any other servers where you are the owner.')] });
      return;
    }

    // Discord limits SelectMenu to 25 options
    const options = targetServers.slice(0, 25).map(guild => {
      return new StringSelectMenuOptionBuilder()
        .setLabel(guild.name)
        .setDescription(`ID: ${guild.id}`)
        .setValue(guild.id);
    });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('emojistealer_select')
      .setPlaceholder('Select Target Server (Group 1)')
      .addOptions(options);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const uiEmbed = embed.build({
      title: 'Emoji Stealer (All Emojis)',
      description: `Found **${emojis.size}** emojis in this server.\n\nSelect a target server below to copy all of them:`,
      color: '#2b2d31', // Aesthetic dark grey
      thumbnail: message.guild.iconURL({ dynamic: true })
    });

    await message.reply({ embeds: [uiEmbed], components: [row] });
  }
}];
