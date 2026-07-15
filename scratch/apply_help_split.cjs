const fs = require('fs');

let code = fs.readFileSync('src/commands/utility.js', 'utf8');

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

if (startIndex === -1 || endIndex === -1) {
  console.log("Could not find buildHelpContainer in utility.js!");
  process.exit(1);
}

const newFunctions = `function buildHelpContainer(client, guildId, moduleId = 'home') {
  const config = db.getGuildConfig(guildId || '0');
  const accentColor = config?.accentColor || '#3b82f6';
  const accentInt = parseInt(accentColor.replace('#', ''), 16);
  const prefix = config?.prefix || '!';
  const botId = client?.user?.id || '1347071663182676059';

  let rawComponents = [];

  if (moduleId === 'home') {
    let topText = \`# Hey !!! , I am <@\${botId}> ,\\n\\n\`;
    topText += \`• ⚬ – **Welcome to Athena Prime A bot which is made for unbypassable security features and community management! View down and see our srv management modules listed below:**\\n\\n\`;
    topText += \`• ⚬ – **To set Custom Prefix use <@\${botId}> \\\`\${prefix}prefix " your custom prefix "\\\`**\\n\\n\`;
    topText += \`• ⚬ – **Hint : To Know more use " Tag the Bot and Type Guide for details and usage "**\`;

    rawComponents.push({ type: 10, content: topText });
    rawComponents.push({ type: 14, divider: true });

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
    
    rawComponents.push({ type: 10, content: grid.trim() });
    rawComponents.push({ type: 14, divider: true });

  } else {
    const mod = helpModules.find(m => m.id === moduleId);
    if (mod) {
      let description = \`# \${mod.emoji} \${mod.label.toUpperCase()}\\n\\n\`;
      description += mod.commands.map(cmd => cmd.replace(/!/g, prefix)).join('\\n\\n');
      rawComponents.push({ type: 10, content: description });
      rawComponents.push({ type: 14, divider: true });
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

  const HELP_GIF = 'https://cdn.discordapp.com/attachments/1516850846984437801/1523436364387975298/banner_gif_1-ezgif.com-crop.gif?ex=6a4cc2ed&is=6a4b716d&hm=a2b3e22c3ee7e1a91545669546a5550644eaba3508e179a3c0d38c889515525d&';

  rawComponents.push({ type: 12, items: [{ media: { url: HELP_GIF } }] });
  rawComponents.push({ type: 14, divider: true });
  rawComponents.push(row1.toJSON());
  rawComponents.push({ type: 14, divider: true });
  rawComponents.push(row2.toJSON());

  // Raw Container JSON
  const rawContainer = {
    type: 17,
    accent_color: accentInt,
    components: rawComponents
  };

  return rawContainer;
}
`;

code = code.substring(0, startIndex) + newFunctions + code.substring(endIndex);
fs.writeFileSync('src/commands/utility.js', code);
console.log("Updated help command perfectly!");
