import { EmbedBuilder } from 'discord.js';

const DATE_MESSAGES = [
  "are having an unforgettable evening together <:emoji_120:1525088728840802304>",
  "escaped the world for a perfect, intimate date <:emoji_120:1525088728840802304>",
  "are making beautiful memories on a lovely date together...",
  "look absolutely adorable on their special date tonight <:emoji_120:1525088728840802304>",
  "are sharing a magical moment just between the two of them ✨"
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
    hidden: true, // Makes it a prefix-only command

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
        .setColor(0xFF4081) // Deep pink custom color
        .setTitle('<a:pinkroses:1511975147782012988> A Romantic Date')
        .setDescription(text)
        .setFooter({ text: `Sparks are flying between ${authorName} and ${targetName}...` });

      if (gifUrl) {
        embed.setImage(gifUrl);
      }

      await message.reply({ embeds: [embed] });
    }
  }
];
