import { PermissionFlagsBits } from 'discord.js';
import db from '../database.js';
import cv2 from '../cv2.js';
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
    ...cv2.info('Reaction Role Manager [1/3]', 'Please tag the channel where you want to post this menu (e.g. <#123456789> or ID).')
  });
  
  const targetChannelMsg = await awaitReply();
  if (!targetChannelMsg) return channel.send(cv2.danger('Timeout', 'Setup cancelled.'));
  
  const targetChannelId = targetChannelMsg.content.replace(/<#|>/g, '');
  const targetChannel = message.guild.channels.cache.get(targetChannelId);
  if (!targetChannel) return channel.send(cv2.danger('Invalid Channel', 'Setup cancelled.'));

  // Step 2: Title
  await channel.send({
    ...cv2.info('Reaction Role Manager [2/3]', 'What should be the title of this menu? (e.g. `React to Your Hobbies`)')
  });
  
  const titleMsg = await awaitReply();
  if (!titleMsg) return channel.send(cv2.danger('Timeout', 'Setup cancelled.'));
  const title = titleMsg.content;

  // Step 2.5: Description
  await channel.send({
    ...cv2.info('Reaction Role Manager [3/5]', 'What should be the description of this menu? (Optional)\nType `skip` if you do not want a description.')
  });
  
  const menuDescMsg = await awaitReply();
  if (!menuDescMsg) return channel.send(cv2.danger('Timeout', 'Setup cancelled.'));
  let menuDescription = '';
  if (menuDescMsg.content.trim().toLowerCase() !== 'skip') {
    menuDescription = menuDescMsg.content.trim();
  }

  // Step 3: Entries
  const mappings = [];
  await channel.send({
    ...cv2.info('Reaction Role Manager [4/5]', 'Now, add your roles one by one.\n\nFormat: `[emoji] [@role OR Role ID] [description]`\nExample: ` 123456789 The Singer Role`\n\nType `done` when you are finished.')
  });

  while (true) {
    const entryMsg = await awaitReply();
    if (!entryMsg) return channel.send(cv2.danger('Timeout', 'Setup cancelled.'));
    
    if (entryMsg.content.trim().toLowerCase() === 'done') break;

    const cleanedMsg = entryMsg.content.replace(/\|/g, '');
    const parts = cleanedMsg.trim().split(/\s+/);
    if (parts.length < 2) {
      await channel.send({ content: ' Invalid format. Please use: `emoji @role [description]`' });
      continue;
    }

    const emojiStr = parts[0];
    const roleStr = parts[1];
    const desc = parts.length > 2 ? parts.slice(2).join(' ') : '';

    const roleId = roleStr.replace(/[^0-9]/g, '');
    if (!roleId || roleId.length < 17) {
      await channel.send({ content: ' Invalid role tag or ID.' });
      continue;
    }

    let role = message.guild.roles.cache.get(roleId);
    if (!role) {
      role = await message.guild.roles.fetch(roleId).catch(() => null);
    }

    // if fetch returned a Collection (which happens if roleId is empty, but we guarded against it)
    if (!role || !role.id) {
      await channel.send({ content: ' Invalid role. Please tag a valid role or paste a valid Role ID.' });
      continue;
    }

    // Extract emoji identifier for Discord API (either raw unicode or custom id)
    let emojiIdOrName = emojiStr;
    const customMatch = emojiStr.match(/<a?:.+:(\d+)>/);
    if (customMatch) {
      emojiIdOrName = customMatch[1];
    }

    mappings.push({ emojiStr, emojiIdOrName, roleId: role.id, desc });
    
    const displayDesc = desc ? `**${desc}** -> ` : '';
    await channel.send({ content: ` Added: ${emojiStr} | ${displayDesc}<@&${role.id}>\nType next entry, or \`done\`.` });
  }

  if (mappings.length === 0) {
    return channel.send(cv2.danger('Cancelled', 'No roles were added. Setup cancelled.'));
  }

  // Step 4: Image
  await channel.send({
    ...cv2.info('Reaction Role Manager [5/5]', 'Would you like to attach an image to this menu? (Optional)\n\nPaste a valid image URL (e.g., ending in `.png`, `.gif`, `.jpg`) to add it as a large banner.\nOr type `thumb <url>` to add it as a small top-right thumbnail.\n\nType `skip` if you do not want an image.')
  });

  const imageMsg = await awaitReply();
  if (!imageMsg) return channel.send(cv2.danger('Timeout', 'Setup cancelled.'));

  const imgContent = imageMsg.content.trim();
  let imageUrl = null;
  let isThumbnail = false;

  if (imgContent.toLowerCase() !== 'skip') {
    if (imgContent.toLowerCase().startsWith('thumb ')) {
      isThumbnail = true;
      imageUrl = imgContent.substring(6).trim();
    } else {
      imageUrl = imgContent;
    }
    
    // Auto-strip < > around URLs if user added them
    imageUrl = imageUrl.replace(/^<|>$/g, '');
  }

  // Step 5: Footer
  await channel.send({
    ...cv2.info('Reaction Role Manager [Extra]', 'What should be the footer text? (Optional)\n\nType `default` to keep the standard Athena Prime Killer footer.\nType `none` or `remove` to have no footer.\nOr just type your custom footer text.')
  });

  const footerMsg = await awaitReply();
  if (!footerMsg) return channel.send(cv2.danger('Timeout', 'Setup cancelled.'));
  
  let footerText = undefined;
  const fContent = footerMsg.content.trim();
  
  if (fContent.toLowerCase() === 'none' || fContent.toLowerCase() === 'remove') {
    footerText = '\u200B'; // zero width space to bypass fallback
  } else if (fContent.toLowerCase() !== 'default') {
    footerText = fContent;
  }

  // Construct Aesthetic Embed Message
  let textContent = menuDescription ? `${menuDescription}\n\n` : '';
  for (const m of mappings) {
    if (m.desc) {
      textContent += `${m.emojiStr} | <@&${m.roleId}> **${m.desc}**\n\n`;
    } else {
      textContent += `${m.emojiStr} | <@&${m.roleId}>\n\n`;
    }
  }

  const guildConfig = db.getGuildConfig(message.guild.id) || {};

  const embedOptions = {
    title: title,
    description: textContent,
    color: guildConfig.accentColor || '#2b2d31',
    footerText: footerText
  };

  if (imageUrl) {
    if (isThumbnail) {
      embedOptions.thumbnail = imageUrl;
    } else {
      embedOptions.image = imageUrl;
    }
  }

  const rrEmbed = cv2.buildContainer(embedOptions);

  // Send message
  try {
    const postedMsg = await targetChannel.send({ embeds: [rrEmbed] });

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
      ...cv2.success('Success!', `Reaction Role Menu successfully created in <#${targetChannel.id}>!`)
    });

  } catch (err) {
    console.error(err);
    await channel.send(cv2.danger('Error', 'Failed to post message or add reactions.'));
  }
}
