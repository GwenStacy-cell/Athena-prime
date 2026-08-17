const fs = require('fs');
const path = 'src/commands/security.js';
let content = fs.readFileSync(path, 'utf8');

// Revert the `...comps` back to `headerSection.toJSON()`
content = content.replace(/\.\.\.comps,/g, 'headerSection.toJSON(),');

// Ensure a fallback avatar for getSecurityStatusPanel
content = content.replace(
  'const botAvatarUrl = guild.client?.user?.displayAvatarURL({ dynamic: true, size: 256 }) || null;',
  "const botAvatarUrl = guild.client?.user?.displayAvatarURL({ dynamic: true, size: 256 }) || 'https://cdn.discordapp.com/embed/avatars/0.png';"
);

// Ensure a fallback avatar for getUserInfoEmbed
content = content.replace(
  'const avatarUrl = member.user.displayAvatarURL({ dynamic: true, size: 256 });',
  "const avatarUrl = member.user.displayAvatarURL({ dynamic: true, size: 256 }) || 'https://cdn.discordapp.com/embed/avatars/0.png';"
);

// Ensure a fallback avatar for getServerInfoEmbed
content = content.replace(
  'const iconUrl = guild.iconURL({ dynamic: true, size: 256 }) || null;',
  "const iconUrl = guild.iconURL({ dynamic: true, size: 256 }) || 'https://cdn.discordapp.com/embed/avatars/0.png';"
);

// Fix the `if (iconUrl)` blocks to just use it unconditionally since it's never null now
content = content.replace(
  /if \(iconUrl\) \{\s*headerSection\.setThumbnailAccessory\(new ThumbnailBuilder\(\)\.setURL\(iconUrl\)\);\s*\}/g,
  "headerSection.setThumbnailAccessory(new ThumbnailBuilder().setURL(iconUrl));"
);
content = content.replace(
  /if \(avatarUrl\) \{\s*headerSection\.setThumbnailAccessory\(new ThumbnailBuilder\(\)\.setURL\(avatarUrl\)\);\s*\}/g,
  "headerSection.setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarUrl));"
);
content = content.replace(
  /if \(botAvatarUrl\) \{\s*headerSection\.setThumbnailAccessory\(new ThumbnailBuilder\(\)\.setURL\(botAvatarUrl\)\);\s*\}/g,
  "headerSection.setThumbnailAccessory(new ThumbnailBuilder().setURL(botAvatarUrl));"
);

fs.writeFileSync(path, content, 'utf8');
console.log('Fixed security.js');