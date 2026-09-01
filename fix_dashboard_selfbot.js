import fs from "fs";
let sec = fs.readFileSync("src/commands/security.js", "utf8");

// Add Selfbot Detection to Filters Active
sec = sec.replace(
    /`-# \*\*\\$\{DOT\} Big Fonts \(Anti Full Caps\)\*\*\\n` \+/g,
    "`-# **${DOT} Big Fonts (Anti Full Caps)**\\n` +\n    `-# **${DOT} Selfbot Detection (Rich Embeds)**\\n` +"
);

// Add Selfbot Detection to Current Configurations
sec = sec.replace(
    /`-# \*\*\| Big Fonts:\*\* \\$\{bigFontsOn \? TOGGLE_ON : TOGGLE_OFF\}\\n` \+/g,
    "`-# **| Big Fonts:** ${bigFontsOn ? TOGGLE_ON : TOGGLE_OFF}\\n` +\n    `-# **| Selfbot Detection:** ${config.selfbotDetectionEnabled !== false ? TOGGLE_ON : TOGGLE_OFF}\\n` +"
);

fs.writeFileSync("src/commands/security.js", sec);
