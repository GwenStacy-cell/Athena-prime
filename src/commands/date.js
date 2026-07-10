import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

const DATE_MESSAGES = [
  "are enjoying a perfect evening together ❤️",
  "are sharing a beautiful, intimate moment together...",
  "went on a lovely date and had an amazing time!",
  "are looking incredibly cute together today 💕",
  "spent a wonderful time making beautiful memories ✨"
];

const ENDPOINTS = ['hug', 'kiss'];

async function fetchGif() {
  const endpoint = ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)];
  try {
    const res = await fetch(`https://nekos.best/api/v2/${endpoint}`, {
      headers: { 'User-Agent': 'DiscordBot/1.0' }
    });
    const data = await res.json();
    return data.results[0].url;
  } catch (err) {
    console.error('Nekos Best API Error:', err);
    return null; // fallback will be handled
  }
}

export const commands = [
  {
    name: 'date',
    description: 'Go on a special date with someone!',
    aliases: ['go-on-date'],
    slash: new SlashCommandBuilder()
      .setName('date')
      .setDescription('Go on a special date with someone!')
      .addUserOption(option => 
        option.setName('user')
          .setDescription('The user you want to go on a date with')
          .setRequired(true)
      ),

    async executeSlash(interaction) {
      await interaction.deferReply();
      const targetUser = interaction.options.getUser('user');
      const targetMember = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
      
      const authorName = interaction.member?.nickname || interaction.user.displayName;
      const targetName = targetMember?.nickname || targetUser.displayName;

      const randomMsg = DATE_MESSAGES[Math.floor(Math.random() * DATE_MESSAGES.length)];
      const text = `**${authorName}** and **${targetName}** ${randomMsg}`;

      const gifUrl = await fetchGif();

      const embed = new EmbedBuilder()
        .setColor(0xFF69B4) // Pink color for romance
        .setTitle('🌹 A Special Date')
        .setDescription(text)
        .setFooter({ text: `Love is in the air for ${authorName} and ${targetName}` });

      if (gifUrl) {
        embed.setImage(gifUrl);
      }

      await interaction.editReply({ embeds: [embed] });
    },

    async executePrefix(message, args) {
      if (!args.length && !message.mentions.users.size) {
        return message.reply("Please mention a user you want to go on a date with!");
      }

      let targetUser = message.mentions.users.first();
      
      if (!targetUser) {
        // Try to fetch by ID
        const targetId = args[0].replace(/[^0-9]/g, '');
        if (targetId) {
          targetUser = await message.client.users.fetch(targetId).catch(() => null);
        }
      }

      if (!targetUser) {
        return message.reply("Could not find that user! Make sure to mention them or provide a valid ID.");
      }

      const targetMember = await message.guild?.members.fetch(targetUser.id).catch(() => null);
      const authorName = message.member?.nickname || message.author.displayName;
      const targetName = targetMember?.nickname || targetUser.displayName;

      const randomMsg = DATE_MESSAGES[Math.floor(Math.random() * DATE_MESSAGES.length)];
      const text = `**${authorName}** and **${targetName}** ${randomMsg}`;

      const gifUrl = await fetchGif();

      const embed = new EmbedBuilder()
        .setColor(0xFF69B4) // Pink color for romance
        .setTitle('🌹 A Special Date')
        .setDescription(text)
        .setFooter({ text: `Love is in the air for ${authorName} and ${targetName}` });

      if (gifUrl) {
        embed.setImage(gifUrl);
      }

      await message.reply({ embeds: [embed] });
    }
  }
];
