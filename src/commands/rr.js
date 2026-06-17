import { PermissionFlagsBits } from 'discord.js';
import db from '../database.js';
import embed from '../embed.js';
import chalk from 'chalk';

export const commands = [
  {
    name: 'rrsetup',
    description: 'Interactive manager to build aesthetic reaction role menus',
    permissions: [PermissionFlagsBits.Administrator],
    aliases: ['reactionrole', 'rrmanager'],
    executePrefix: async (message) => {
      try {
        await runInteractiveBuilder(message);
      } catch (err) {
        await message.reply(`\`\`\`js\n${err.stack || err}\n\`\`\``).catch(() => null);
      }
    }
  }
];

async function runInteractiveBuilder(message) {
  const channel = message.channel;
  const authorId = message.author.id;

  const filter = m => m.author.id === authorId;
  const awaitReply = async () => {
    try {
      const collected = await channel.awaitMessages({ filter, max: 1, time: 120000, errors: ['time'] });
      return collected.first();
    } catch {
      return null;
    }
  };

  // Step 1: Channel
  await channel.send({
    embeds: [embed.info('Reaction Role Manager [1/3]', 'Please tag the channel where you want to post this menu (e.g. <#123456789> or ID).')]
  });
  
  const targetChannelMsg = await awaitReply();
  if (!targetChannelMsg) return channel.send({ embeds: [embed.danger('Timeout', 'Setup cancelled.')] });
  
  const targetChannelId = targetChannelMsg.content.replace(/<#|>/g, '');
  const targetChannel = message.guild.channels.cache.get(targetChannelId);
  if (!targetChannel) return channel.send({ embeds: [embed.danger('Invalid Channel', 'Setup cancelled.')] });

  // Step 2: Title
  await channel.send({
    embeds: [embed.info('Reaction Role Manager [2/3]', 'What should be the title of this menu? (e.g. `React to Your Hobbies`)')]
  });
  
  const titleMsg = await awaitReply();
  if (!titleMsg) return channel.send({ embeds: [embed.danger('Timeout', 'Setup cancelled.')] });
  const title = titleMsg.content;

  // Step 3: Entries
  const mappings = [];
  await channel.send({
    embeds: [embed.info('Reaction Role Manager [3/3]', 'Now, add your roles one by one.\n\nFormat: `[emoji] [@role OR Role ID] [description]`\nExample: `🎤 123456789 The Singer Role`\n\nType `done` when you are finished.')]
  });

  while (true) {
    const entryMsg = await awaitReply();
    if (!entryMsg) return channel.send({ embeds: [embed.danger('Timeout', 'Setup cancelled.')] });
    
    if (entryMsg.content.toLowerCase() === 'done') break;

    const parts = entryMsg.content.split(' ');
    if (parts.length < 3) {
      await channel.send({ content: '❌ Invalid format. Please use: `emoji @role description`' });
      continue;
    }

    const emojiStr = parts[0];
    const roleStr = parts[1];
    const desc = parts.slice(2).join(' ');

    const roleId = roleStr.replace(/<@&|>/g, '');
    let role = message.guild.roles.cache.get(roleId);
    if (!role) {
      role = await message.guild.roles.fetch(roleId).catch(() => null);
    }

    if (!role) {
      await channel.send({ content: '❌ Invalid role. Please tag a valid role or paste a valid Role ID.' });
      continue;
    }

    // Extract emoji identifier for Discord API (either raw unicode or custom id)
    let emojiIdOrName = emojiStr;
    const customMatch = emojiStr.match(/<a?:.+:(\d+)>/);
    if (customMatch) {
      emojiIdOrName = customMatch[1];
    }

    mappings.push({ emojiStr, emojiIdOrName, roleId: role.id, desc });
    await channel.send({ content: `✅ Added: ${emojiStr} | **${desc}** -> <@&${role.id}>\nType next entry, or \`done\`.` });
  }

  if (mappings.length === 0) {
    return channel.send({ embeds: [embed.danger('Cancelled', 'No roles were added. Setup cancelled.')] });
  }

  // Construct Aesthetic Message
  let textContent = `**${title}**\n\n`;
  for (const m of mappings) {
    textContent += `${m.emojiStr} | **${m.desc}**\n`;
  }

  // Send message
  try {
    const postedMsg = await targetChannel.send({ content: textContent });

    // Save to DB
    const dbMappings = {};
    for (const m of mappings) {
      dbMappings[m.emojiIdOrName] = m.roleId;
    }

    db.saveReactionRoleMenu(postedMsg.id, {
      guildId: message.guild.id,
      channelId: targetChannel.id,
      title,
      mappings: dbMappings
    });

    // React
    for (const m of mappings) {
      await postedMsg.react(m.emojiIdOrName).catch(err => {
        console.error('Failed to react:', err);
      });
    }

    await channel.send({
      embeds: [embed.success('Success!', `Reaction Role Menu successfully created in <#${targetChannel.id}>!`)]
    });

  } catch (err) {
    console.error(err);
    await channel.send({ embeds: [embed.danger('Error', 'Failed to post message or add reactions.')] });
  }
}
