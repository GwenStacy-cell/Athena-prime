import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import db from '../database.js';

export default {
  name: 'guildCreate',
  async execute(guild) {
    if (!guild || !guild.client) return;

    if (db.isServerBanned(guild.id)) {
      try {
        await guild.leave();
      } catch (e) {}
      return;
    }

    try {
      const client = guild.client;
      let ownerId = process.env.OWNER_ID;

      // Fallback to fetching application owner if not set in .env
      if (!ownerId) {
        const app = await client.application.fetch().catch(() => null);
        if (app && app.owner) {
          ownerId = app.owner.ownerId || app.owner.id;
        }
      }

      if (!ownerId) {
        // Fallback to hardcoded owner if everything else fails
        ownerId = '1423292960744804383';
      }

      const botOwner = await client.users.fetch(ownerId).catch(() => null);
      if (!botOwner) return;

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('New Server Joined')
        .setDescription(`I have just been added to a new server.`)
        .addFields(
          { name: 'Server Name', value: `${guild.name}`, inline: true },
          { name: 'Server ID', value: `\`${guild.id}\``, inline: true },
          { name: 'Owner ID', value: `\`${guild.ownerId}\``, inline: true },
          { name: 'Member Count', value: `${guild.memberCount}`, inline: true },
          { name: 'Channel Count', value: `${guild.channels.cache.size}`, inline: true },
          { name: 'Role Count', value: `${guild.roles.cache.size}`, inline: true }
        )
        .setFooter({ text: 'Athena Prime Server Tracking' })
        .setTimestamp();

      if (guild.iconURL()) {
        embed.setThumbnail(guild.iconURL({ dynamic: true, size: 256 }));
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`gen_invite_${guild.id}`)
          .setLabel('Generate Invite')
          .setStyle(ButtonStyle.Primary)
      );

      await botOwner.send({ embeds: [embed], components: [row] }).catch(() => null);
    } catch (err) {
      console.error('Error in guildCreate tracker:', err);
    }
  }
};
