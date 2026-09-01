import fs from "fs";
let sec = fs.readFileSync("src/commands/security.js", "utf8");

sec = sec.replace(
    /\.setCustomId\('am_advanced_configs'\)\.setLabel\(['`"][^'"`]+['"`]\)\.setStyle\(ButtonStyle\.Primary\)/,
    ".setCustomId('am_advanced_configs').setLabel('Link & Invite Toggles').setStyle(ButtonStyle.Secondary)"
);

sec = sec.replace(
    /\.setCustomId\('am_back_to_main'\)\.setLabel\(['`"][^'"`]+['"`]\)\.setStyle\(ButtonStyle\.Primary\)/,
    ".setCustomId('am_back_to_main').setLabel('Back to Automod').setStyle(ButtonStyle.Secondary)"
);

fs.writeFileSync("src/commands/security.js", sec);
