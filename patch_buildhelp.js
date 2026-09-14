import fs from "fs";
let js = fs.readFileSync("src/commands/utility.js", "utf8");

const start = js.indexOf("function buildHelpContainer");
const end = js.indexOf("async function handleSetup", start);

const newFunction = `function buildHelpContainer(client, guildId, moduleId) {
    const { ContainerBuilder, TextDisplayBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require('discord.js');
    const db = require('../database.js').default;
    const config = db.getGuildConfig(guildId);
    const prefix = config?.prefix || '!';
    const botId = client?.user?.id || '1347071663182676059';
    
    const getEmoji = (name, fallback) => {
      const e = client.emojis.cache.find(emoji => emoji.name === name);
      return e ? \`<:\${e.name}:\${e.id}>\` : fallback;
    };
  
    let rawComponents = [];
  
    if (moduleId === 'home') {
      let topText = \`# Hey !!! , I am <@\${botId}> ,\\n\\n\`;
      topText += \`> <a:z_arrow_pink1:1523082728004653138> **Welcome to Athena Prime A bot which is made for unbypassable security features and community management! View down and see our srv management modules listed below:**\\n\\n\`;
      topText += \`> <a:z_arrow_pink1:1523082728004653138> **To set Custom Prefix use <@\${botId}> \\\`\${prefix}prefix " your custom prefix "\\\`**\\n\\n\`;
      topText += \`> <a:z_arrow_pink1:1523082728004653138> **Hint : To Know more use " Tag the Bot and Type Guide for details and usage "**\`;
  
      rawComponents.push({ type: 10, content: topText });
      rawComponents.push({ type: 14, divider: true });
  
      const categories = [
        { name: 'SECURITY & ACCESS CONTROL', icon: '\uD83D\uDEE1\uFE0F', catName: 'SECURITY & ACCESS CONTROL' },
        { name: 'SERVER ADMINISTRATION', icon: '\uD83D\uDEE0\uFE0F', catName: 'SERVER ADMINISTRATION' },
        { name: 'COMMUNITY & ENGAGEMENT', icon: '\uD83D\uDCAC', catName: 'COMMUNITY & ENGAGEMENT' },
        { name: 'VOICE & MEDIA', icon: '\uD83C\uDFA4', catName: 'VOICE & MEDIA' },
        { name: 'UTILITIES & INTEGRATIONS', icon: '\u2699\uFE0F', catName: 'UTILITIES & INTEGRATIONS' }
      ];

      const bullet = getEmoji('black_dot', '\u2022');
      
      let grid = '';
      for (const cat of categories) {
         grid += \`### \${cat.icon} \${cat.name}\\n\`;
         const mods = helpModules.filter(m => m.category === cat.catName);
         
         // To make it look compact, we can do 2 or 3 per row, or just a clean list
         let rowStr = '';
         for (let i = 0; i < mods.length; i++) {
            const m = mods[i];
            const e = getEmoji(m.emoji, '\u25B6\uFE0F');
            
            // Format: bullet emoji **Label**
            rowStr += \`> \${bullet} \${e} **\${m.shortLabel}**\`;
            
            // Add spacing between columns if putting 2 per line, or just newline
            if (i % 2 === 1 || i === mods.length - 1) {
                grid += rowStr + '\\n';
                rowStr = '';
            } else {
                rowStr += ' \u2800\u2800 '; // Braille spaces for padding
            }
         }
         grid += '\\n';
      }
      
      rawComponents.push({ type: 10, content: grid.trim() });
      rawComponents.push({ type: 14, divider: true });
  
    } else {
      const mod = helpModules.find(m => m.id === moduleId);
      if (mod) {
        const e = getEmoji(mod.emoji, '\u25B6\uFE0F');
        let currentChunk = \`# \${e} \${mod.label.toUpperCase()}\`;
        
        for (const cmd of mod.commands) {
          if (cmd === '') {
            if (currentChunk.trim().length > 0) {
              rawComponents.push({ type: 10, content: currentChunk.trim() });
            }
            rawComponents.push({ type: 14, divider: true });
            currentChunk = '';
            continue;
          }
          
          let formatted = cmd.replace(/!/g, prefix);
          let line = '';
          if ((formatted.startsWith('**') && formatted.endsWith('**')) || formatted.startsWith('-A ') || formatted.startsWith('  - ') || formatted.startsWith('\`bans\`,')) {
            line = formatted;
          } else {
            line = \`> **\${formatted}**\`;
          }
  
          if (currentChunk.length + line.length + 4 > 1900) {
            if (currentChunk.trim().length > 0) {
              rawComponents.push({ type: 10, content: currentChunk.trim() });
            }
            currentChunk = line;
          } else {
            currentChunk += (currentChunk ? '\\n\\n' : '') + line;
          }
        }
  
        if (currentChunk.trim().length > 0) {
          rawComponents.push({ type: 10, content: currentChunk.trim() });
        }
  
        rawComponents.push({ type: 14, divider: true });
      }
    }
  
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('help_module_select')
      .setPlaceholder('Click to view modules');
  
    const homeEmoji = getEmoji('home', '\uD83C\uDFE0');
    selectMenu.addOptions([
      {
        label: 'Home Menu',
        description: 'Return to the main help menu',
        value: 'home'
        // cannot easily set dynamic emoji obj here if it's a string, so we skip emoji on home if it's custom string, or parse it
      }
    ]);
  
    // We can only fit 25 options. 1 Home + 24 Modules = 25 exactly!
    for (const mod of helpModules) {
      selectMenu.addOptions([
        {
          label: mod.label,
          value: mod.id
        }
      ]);
    }
  
    const btnPrev = new ButtonBuilder().setCustomId('help_prev').setEmoji('1523766004839088301').setStyle(ButtonStyle.Secondary);
    const btnNext = new ButtonBuilder().setCustomId('help_next').setEmoji('1523766065576935475').setStyle(ButtonStyle.Secondary);
    const btnRefresh = new ButtonBuilder().setCustomId('help_home').setEmoji('1523765738655973589').setStyle(ButtonStyle.Secondary);
    const btnDelete = new ButtonBuilder().setCustomId('help_delete').setEmoji('1523766340752642109').setStyle(ButtonStyle.Danger);
  
    const row1 = new ActionRowBuilder().addComponents(selectMenu);
    const row2 = new ActionRowBuilder().addComponents(btnPrev, btnNext, btnRefresh, btnDelete);
  
    const HELP_GIF = 'https://cdn.discordapp.com/attachments/1534869224277807175/1542472732325978234/ATHENA-8-27-2026.png?ex=6a915b2d&is=6a9009ad&hm=0f55bae0c0bec27649bc03e6d6be23ad16f2eb9337efdb8b5793b2d74cad89ff&';
  
    rawComponents.push({ type: 12, items: [{ media: { url: HELP_GIF } }] });
    rawComponents.push({ type: 14, divider: true });
    rawComponents.push(row1.toJSON());
    rawComponents.push({ type: 14, divider: true });
    rawComponents.push(row2.toJSON());
    rawComponents.push({ type: 14, divider: true });
    rawComponents.push({ type: 10, content: '-# **Athena Prime Unbypassable Security !!**' });
  
    const rawContainer = {
      type: 17,
      components: rawComponents
    };
  
    return rawContainer;
}

`;

js = js.substring(0, start) + newFunction + js.substring(end);
fs.writeFileSync("src/commands/utility.js", js);
console.log("Updated buildHelpContainer!");
