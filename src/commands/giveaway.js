import { PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } from 'discord.js';
import db from '../database.js';
import embed from '../embed.js';
import ms from 'ms';
import chalk from 'chalk';

const EMOJI_HEADER = '<a:emoji_11:1517212810223026247>';
const EMOJI_JOIN = '<a:emoji_56:1517212375022047284>';
const EMOJI_WINNER = '<a:giveaway:1517214415684898988>';

export async function endGiveaway(client, messageId, gwData) {
  try {
    const guild = client.guilds.cache.get(gwData.guildId);
    if (!guild) return;

    const channel = guild.channels.cache.get(gwData.channelId);
    if (!channel) return;

    const message = await channel.messages.fetch(messageId).catch(() => null);
    if (!message) return;

    // Pick winners
    const participants = gwData.participants || [];
    let winners = [];
    
    if (participants.length > 0) {
      const shuffled = [...participants].sort(() => 0.5 - Math.random());
      winners = shuffled.slice(0, gwData.winnersCount);
    }

    // Update the embed
    const originalEmbed = EmbedBuilder.from(message.embeds[0]);
    originalEmbed.setColor('#2b2d31');
    originalEmbed.setDescription(`**Prize:** ${gwData.prize}\n**Ended:** <t:${Math.floor(Date.now() / 1000)}:R>\n**Hosted By:** <@${gwData.hostId}>\n\n**Winners:** ${winners.length > 0 ? winners.map(id => `<@${id}>`).join(', ') : 'None'}`);
    originalEmbed.setFooter({ text: `Ended • ${participants.length} Entries` });

    // Disable the button
    const row = ActionRowBuilder.from(message.components[0]);
    row.components[0].setDisabled(true);

    await message.edit({ embeds: [originalEmbed], components: [row] });

    // Announce the winner
    if (winners.length > 0) {
      await channel.send({ content: `${EMOJI_WINNER} Congratulations ${winners.map(id => `<@${id}>`).join(', ')}! You won **${gwData.prize}**!` });
    } else {
      await channel.send({ content: `${EMOJI_WINNER} Giveaway ended, but nobody participated!` });
    }

    // Mark as ended but keep in DB for rerolling
    gwData.ended = true;
    db.saveGiveaway(messageId, gwData);
  } catch (error) {
    console.error(chalk.red(`❌ Failed to end giveaway ${messageId}:`), error);
  }
}

export const commands = [
  {
    name: 'giveaway',
    description: 'Manage server giveaways',
    default_member_permissions: PermissionFlagsBits.Administrator.toString(),
    options: [
      {
        name: 'start',
        description: 'Start a new giveaway',
        type: 1,
        options: [
          { name: 'duration', description: 'Duration (e.g. 10m, 1h, 1d)', type: 3, required: true },
          { name: 'winners', description: 'Number of winners', type: 4, required: true },
          { name: 'prize', description: 'The prize to win', type: 3, required: true },
          { name: 'message', description: 'Optional custom message', type: 3, required: false }
        ]
      },
      {
        name: 'end',
        description: 'Prematurely end an active giveaway',
        type: 1,
        options: [
          { name: 'message_id', description: 'The Message ID of the giveaway', type: 3, required: true }
        ]
      },
      {
        name: 'reroll',
        description: 'Pick a new winner for a ended giveaway',
        type: 1,
        options: [
          { name: 'message_id', description: 'The Message ID of the giveaway', type: 3, required: true }
        ]
      }
    ],
    async executePrefix(message, args) {
      return message.reply({ embeds: [embed.info('Slash Command Only', 'Please use the `/giveaway` slash command.')] });
    },
    async executeSlash(interaction) {
      const subcommand = interaction.options.getSubcommand();

      if (subcommand === 'start') {
        const durationStr = interaction.options.getString('duration');
        const winners = interaction.options.getInteger('winners');
        const prize = interaction.options.getString('prize');
        const customMessage = interaction.options.getString('message');

        const durationMs = ms(durationStr);
        if (!durationMs || durationMs < 10000) {
          return interaction.reply({ embeds: [embed.warn('Invalid Duration', 'Please provide a valid duration (minimum 10 seconds). Examples: `10m`, `1h`, `2d`.')], ephemeral: true });
        }

        const endsAt = Date.now() + durationMs;
        const endsAtTimestamp = Math.floor(endsAt / 1000);

        const gwEmbed = new EmbedBuilder()
          .setTitle(`${EMOJI_HEADER} **GIVEAWAY** ${EMOJI_HEADER}`)
          .setDescription(`**Prize:** ${prize}\n**Ends:** <t:${endsAtTimestamp}:R> (<t:${endsAtTimestamp}:f>)\n**Hosted By:** ${interaction.user}\n**Winners:** ${winners}\n\n${customMessage ? `*${customMessage}*\n\n` : ''}Click the button below to enter!`)
          .setColor('#5865F2')
          .setFooter({ text: '0 Entries' })
          .setTimestamp(new Date(endsAt));

        const joinButton = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId('gw_join')
            .setLabel('Join')
            .setStyle(ButtonStyle.Primary)
            .setEmoji(EMOJI_JOIN)
        );

        await interaction.reply({ content: 'Starting giveaway...', ephemeral: true });

        const message = await interaction.channel.send({ embeds: [gwEmbed], components: [joinButton] });

        db.saveGiveaway(message.id, {
          guildId: interaction.guild.id,
          channelId: interaction.channel.id,
          hostId: interaction.user.id,
          prize: prize,
          winnersCount: winners,
          endsAt: endsAt,
          participants: []
        });

        await interaction.editReply({ content: 'Giveaway started successfully!' });
      }

      if (subcommand === 'end') {
        const messageId = interaction.options.getString('message_id');
        const gwData = db.getGiveaway(messageId);
        
        if (!gwData) {
          return interaction.reply({ embeds: [embed.warn('Not Found', 'No active giveaway found with that Message ID in the database.')], ephemeral: true });
        }

        await interaction.reply({ content: 'Ending giveaway...', ephemeral: true });
        await endGiveaway(interaction.client, messageId, gwData);
        await interaction.editReply({ content: 'Giveaway ended!' });
      }

      if (subcommand === 'reroll') {
        const messageId = interaction.options.getString('message_id');
        
        const gwData = db.getGiveaway(messageId);
        
        if (!gwData || !gwData.ended) {
          return interaction.reply({ embeds: [embed.warn('Not Found', 'No ended giveaway found with that Message ID in the database. Active giveaways must be ended first.')], ephemeral: true });
        }

        const participants = gwData.participants || [];
        if (participants.length === 0) {
          return interaction.reply({ embeds: [embed.warn('Cannot Reroll', 'Nobody entered this giveaway!')], ephemeral: true });
        }

        const newWinnerId = participants[Math.floor(Math.random() * participants.length)];
        
        await interaction.reply({ content: `Rerolled the giveaway! The new winner is <@${newWinnerId}>! ${EMOJI_WINNER}` });
      }
    }
  }
];
