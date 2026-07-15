const fs = require('fs');

let code = fs.readFileSync('src/commands/utility.js', 'utf8');

// 1. Rename buildHelpContainer to buildHelpMessage and rewrite it to return standard payload
const startStr = "function buildHelpContainer(client, guildId, moduleId = 'home') {";
const endStr = "  return rawContainer;\n}\n";
const endStrFallback = "  return rawContainer;\r\n}\r\n";

let startIndex = code.indexOf(startStr);
let endIndex = code.indexOf(endStr, startIndex);
if (endIndex === -1) {
  endIndex = code.indexOf(endStrFallback, startIndex);
  if (endIndex !== -1) endIndex += endStrFallback.length;
} else {
  endIndex += endStr.length;
}

const newFunctions = `function buildHelpMessage(client, guildId, moduleId = 'home') {
  const config = db.getGuildConfig(guildId || '0');
  const accentColor = config?.accentColor || '#3b82f6';
  const prefix = config?.prefix || '!';
  const botId = client?.user?.id || '1347071663182676059';
  const HELP_GIF = 'https://cdn.discordapp.com/attachments/1516850846984437801/1523436364387975298/banner_gif_1-ezgif.com-crop.gif?ex=6a4cc2ed&is=6a4b716d&hm=a2b3e22c3ee7e1a91545669546a5550644eaba3508e179a3c0d38c889515525d&';

  const embed = new EmbedBuilder().setColor(accentColor);

  if (moduleId === 'home') {
    let topText = \`# Hey !!! , I am <@\${botId}> ,\\n\\n\`;
    topText += \`<a:z_arrow_pink1:1523082728004653138> **Welcome to Athena Prime A bot which is made for unbypassable security features and community management! View down and see our srv management modules listed below:**\\n\\n\`;
    topText += \`<a:z_arrow_pink1:1523082728004653138> **To set Custom Prefix use <@\${botId}> \\\`\${prefix}prefix " your custom prefix "\\\`**\\n\\n\`;
    topText += \`<a:z_arrow_pink1:1523082728004653138> **Hint : To Know more use " Tag the Bot and Type Guide for details and usage "**\\n\\n\`;

    let grid = '';
    for (let i = 0; i < helpModules.length; i++) {
      const mod = helpModules[i];
      const col = i % 3;
      let label = mod.shortLabel || mod.label;
      let targetLength = 11; 
      let spaces = targetLength - label.length;
      let padding = '\\u00A0'.repeat(spaces > 0 ? spaces : 0);
      grid += \`\${mod.emoji} **\\\` \${label}\${padding} \\\`** \`;
      if (col === 2) grid += '\\n'; 
    }
    
    embed.setDescription(topText + grid.trim());
    embed.setImage(HELP_GIF);

  } else {
    const mod = helpModules.find(m => m.id === moduleId);
    if (mod) {
      let description = \`# \${mod.emoji} \${mod.label.toUpperCase()}\\n\\n\`;
      description += mod.commands.map(cmd => \`**\${cmd.replace(/!/g, prefix)}**\`).join('\\n\\n');
      embed.setDescription(description);
      embed.setImage(HELP_GIF);
    }
  }

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId('help_module_select')
    .setPlaceholder('Click to view modules');

  selectMenu.addOptions([
    {
      label: 'Home Menu',
      description: 'Return to the main help menu',
      value: 'home',
      emoji: '<:home:1523765738655973589>'
    }
  ]);

  for (const mod of helpModules) {
    selectMenu.addOptions([
      {
        label: mod.label,
        value: mod.id,
        emoji: mod.emoji
      }
    ]);
  }

  const btnPrev = new ButtonBuilder().setCustomId('help_prev').setEmoji('<:previous:1523766004839088301>').setStyle(ButtonStyle.Secondary);
  const btnNext = new ButtonBuilder().setCustomId('help_next').setEmoji('<:next:1523766065576935475>').setStyle(ButtonStyle.Secondary);
  const btnRefresh = new ButtonBuilder().setCustomId('help_home').setEmoji('<:home:1523765738655973589>').setStyle(ButtonStyle.Secondary);
  const btnDelete = new ButtonBuilder().setCustomId('help_delete').setEmoji('<:delete:1523766340752642109>').setStyle(ButtonStyle.Danger);

  const row1 = new ActionRowBuilder().addComponents(selectMenu);
  const row2 = new ActionRowBuilder().addComponents(btnPrev, btnNext, btnRefresh, btnDelete);

  return { embeds: [embed], components: [row1, row2] };
}
`;

code = code.substring(0, startIndex) + newFunctions + code.substring(endIndex);

// 2. Fix executePrefix
code = code.replace(/const components = buildHelpContainer\(message\.client, message\.guild\?\.id, 'home'\);/g, "const msgPayload = buildHelpMessage(message.client, message.guild?.id, 'home');");
code = code.replace(/reply = await message\.reply\(\{ components: \[components\], flags: MessageFlags\.IsComponentsV2 \}\);/g, "reply = await message.reply(msgPayload);");
code = code.replace(/const newComponents = buildHelpContainer\(message\.client, message\.guild\?\.id, currentIdx === -1 \? 'home' : helpModules\[currentIdx\]\.id\);/g, "const newPayload = buildHelpMessage(message.client, message.guild?.id, currentIdx === -1 ? 'home' : helpModules[currentIdx].id);");
code = code.replace(/await i\.update\(\{ components: \[newComponents\], flags: MessageFlags\.IsComponentsV2 \}\)\.catch\(\(\) => null\);/g, "await i.update(newPayload).catch(() => null);");

// 3. Fix executeSlash
code = code.replace(/const components = buildHelpContainer\(interaction\.client, interaction\.guild\?\.id, 'home'\);/g, "const msgPayload = buildHelpMessage(interaction.client, interaction.guild?.id, 'home');");
code = code.replace(/reply = await interaction\.reply\(\{ components: \[components\], fetchReply: true, flags: MessageFlags\.IsComponentsV2 \}\);/g, "reply = await interaction.reply({ ...msgPayload, fetchReply: true });");
code = code.replace(/const newComponents = buildHelpContainer\(interaction\.client, interaction\.guild\?\.id, currentIdx === -1 \? 'home' : helpModules\[currentIdx\]\.id\);/g, "const newPayload = buildHelpMessage(interaction.client, interaction.guild?.id, currentIdx === -1 ? 'home' : helpModules[currentIdx].id);");
code = code.replace(/await i\.update\(\{ components: \[newComponents\], flags: MessageFlags\.IsComponentsV2 \}\)\.catch\(\(\) => null\);/g, "await i.update(newPayload).catch(() => null);");

fs.writeFileSync('src/commands/utility.js', code);
console.log('Reverted to standard Embed perfectly!');
