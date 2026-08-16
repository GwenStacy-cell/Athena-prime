import cv2 from '../cv2.js';

const roleplayActions = [
  { name: 'hug', verb: 'hugs', selfVerb: 'needs a hug' },
  { name: 'kiss', verb: 'kisses', selfVerb: 'wants a kiss' },
  { name: 'pat', verb: 'pats', selfVerb: 'pats themselves' },
  { name: 'slap', verb: 'slaps', selfVerb: 'is slapping the air' },
  { name: 'cuddle', verb: 'cuddles', selfVerb: 'needs a cuddle' },
  { name: 'bite', verb: 'bites', selfVerb: 'is biting' },
  { name: 'wink', verb: 'winks at', selfVerb: 'winks' },
  { name: 'cry', verb: 'cries with', selfVerb: 'is crying' },
  { name: 'bully', verb: 'bullies', selfVerb: 'is acting like a bully' },
  { name: 'lick', verb: 'licks', selfVerb: 'licks their lips' },
  { name: 'bonk', verb: 'bonks', selfVerb: 'bonks themselves' },
  { name: 'yeet', verb: 'yeets', selfVerb: 'is yeeting themselves' },
  { name: 'highfive', verb: 'high-fives', selfVerb: 'wants a high-five' },
  { name: 'handhold', verb: 'holds hands with', selfVerb: 'wants to hold hands' },
  { name: 'nom', verb: 'noms on', selfVerb: 'is hungry' },
  { name: 'kick', verb: 'kicks', selfVerb: 'is kicking around' },
  { name: 'poke', verb: 'pokes', selfVerb: 'is poking around' }
];

async function fetchWaifuGif(category) {
  try {
    const res = await fetch(`https://api.waifu.pics/sfw/${category}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.url;
  } catch (err) {
    return null;
  }
}

export const commands = roleplayActions.map(action => ({
  name: action.name,
  description: `Roleplay: ${action.name} someone!`,
  category: 'roleplay',
  options: [
    {
      name: 'user',
      description: `The user to ${action.name}`,
      type: 6, // USER
      required: false
    }
  ],
  async executePrefix(message, args) {
    let target = message.mentions.users.first();
    if (!target && args[0]) {
      try {
        target = await message.client.users.fetch(args[0].replace(/<@!?>/g, ''));
      } catch {
        // ignore
      }
    }

    const gifUrl = await fetchWaifuGif(action.name);
    if (!gifUrl) {
      return message.reply(cv2.error('Error', 'Failed to fetch image from API.', [], message.guild.id));
    }

    const description = target 
      ? `**${message.author.username}** ${action.verb} **${target.username}**!` 
      : `**${message.author.username}** ${action.selfVerb}!`;

    const replyEmbed = cv2.info(null, description, [], message.guild.id).setImage(gifUrl);
    await message.reply({ embeds: [replyEmbed] });
  },
  async executeSlash(interaction) {
    const target = interaction.options.getUser('user');

    const gifUrl = await fetchWaifuGif(action.name);
    if (!gifUrl) {
      return interaction.reply(cv2.error('Error', 'Failed to fetch image from API.', [], interaction.guild.id));
    }

    const description = target 
      ? `**${interaction.user.username}** ${action.verb} **${target.username}**!` 
      : `**${interaction.user.username}** ${action.selfVerb}!`;

    const replyEmbed = cv2.info(null, description, [], interaction.guild.id).setImage(gifUrl);
    await interaction.reply({ embeds: [replyEmbed] });
  }
}));
