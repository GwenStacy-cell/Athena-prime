import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import db from '../database.js';

export default {
  name: 'guildCreate',
  async execute(guild) {
    if (!guild || !guild.client) return;

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

      // Attempt to find who added the bot
      let addedBy = "Someone";
      try {
        const { AuditLogEvent } = await import('discord.js');
        const auditLogs = await guild.fetchAuditLogs({ type: AuditLogEvent.BotAdd, limit: 1 });
        const logEntry = auditLogs.entries.first();
        if (logEntry && logEntry.targetId === client.user.id) {
          addedBy = `**${logEntry.executor.username}** (\`${logEntry.executor.id}\`)`;
        }
      } catch (err) {
        // Missing View Audit Log permission or log not generated yet
      }

      if (db.isServerBanned(guild.id)) {
        if (botOwner) {
          const embed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('Banned Server Addition Attempt')
            .setDescription(`${addedBy} tried to add me to a banned server. I have automatically left it.`)
            .addFields(
              { name: 'Server Name', value: `${guild.name}`, inline: true },
              { name: 'Server ID', value: `\`${guild.id}\``, inline: true },
              { name: 'Owner ID', value: `\`${guild.ownerId}\``, inline: true }
            )
            .setFooter({ text: 'Athena Prime Security' })
            .setTimestamp();
          
          await botOwner.send({ embeds: [embed] }).catch(() => null);
        }
        await guild.leave().catch(() => null);
        return;
      }

      if (!botOwner) return;

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('New Server Joined')
        .setDescription(`${addedBy} just added me to a new server.`)
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
