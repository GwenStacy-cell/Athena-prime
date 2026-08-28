import fs from 'fs';
let code = fs.readFileSync('src/commands/security.js', 'utf8');

const regex = /const row1 = new ActionRowBuilder\(\)\.addComponents\([\s\S]*?const row1b = new ActionRowBuilder\(\)\.addComponents\(\s*new ButtonBuilder\(\)\.setCustomId\('al_toggle_global_invites'\)\.setLabel\('Global Invites'\)\.setStyle\(ButtonStyle\.Secondary\)\s*\);/m;

const replacement = `const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('al_toggle_spam_mention').setLabel('Mass Mention').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('al_toggle_link').setLabel('Anti-Link').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('al_toggle_invite').setLabel('Anti-Invite').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('al_toggle_all_links').setLabel('Allow ALL Links').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('al_toggle_global_invites').setLabel('Global Invites').setStyle(ButtonStyle.Secondary)
  );`;

code = code.replace(regex, replacement);

const regex2 = /panelContainer\.addActionRowComponents\(row1, row1b, row2, row3, row4, row5\);/;
const replacement2 = `panelContainer.addActionRowComponents(row1, row2, row3, row4, row5);`;
code = code.replace(regex2, replacement2);

fs.writeFileSync('src/commands/security.js', code);
console.log("Fixed rows!");
