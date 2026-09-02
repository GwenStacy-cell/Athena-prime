import fs from "fs";
let js = fs.readFileSync("src/commands/welcome.js", "utf8");

// Add format variables to the text
js = js.replace(/` \*\*Thumbnail \(Avatar\):\*\* \$\{cfg\.thumbnail !== false \? ' On' : ' Off'\}\\n` \+/,
  "` <:ticks:1533860039213842565> **Name Format:** ${cfg.nameFormat === 'user_link' ? 'Username Link' : cfg.nameFormat === 'nick_link' ? 'Nickname Link' : 'Tag (@user)'}\\n` +\n" +
  "      ` <:ticks:1533860039213842565> **Avatar Location:** ${cfg.avatarPos === 'author' ? 'Author (Top Left)' : cfg.avatarPos === 'footer' ? 'Footer (Bottom)' : cfg.avatarPos === 'image' ? 'Large Image (Bottom)' : cfg.avatarPos === 'off' ? 'Hidden' : 'Thumbnail (Top Right)'}\\n` +");

// Replace toggle_avatar with cycle_avatar and add cycle_name
js = js.replace(/new ButtonBuilder\(\)\.setCustomId\(`\$\{prefix\}toggle_avatar`\)\.setLabel\('Toggle Avatar'\)\.setStyle\(ButtonStyle\.Success\),/,
  "new ButtonBuilder().setCustomId(`${prefix}cycle_avatar`).setLabel('Avatar Location').setStyle(ButtonStyle.Secondary),");

js = js.replace(/new ButtonBuilder\(\)\.setCustomId\(`\$\{prefix\}status`\)\.setLabel\(cfg\.enabled \? 'Disable System' : 'Enable System'\)\.setStyle\(cfg\.enabled \? ButtonStyle\.Danger : ButtonStyle\.Success\),/,
  "new ButtonBuilder().setCustomId(`${prefix}status`).setLabel(cfg.enabled ? 'Disable System' : 'Enable System').setStyle(cfg.enabled ? ButtonStyle.Danger : ButtonStyle.Success),\n      new ButtonBuilder().setCustomId(`${prefix}cycle_name`).setLabel('Name Format').setStyle(ButtonStyle.Secondary),");

fs.writeFileSync("src/commands/welcome.js", js);
