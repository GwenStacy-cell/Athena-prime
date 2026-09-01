import fs from "fs";
let sec = fs.readFileSync("src/commands/security.js", "utf8");

sec = sec.replace(
    "`-# **${DOT} Big Fonts (Anti Full Caps)**\\n` +",
    "`-# **${DOT} Big Fonts (Anti Full Caps)**\\n` +\n    `-# **${DOT} Selfbot Detection (Rich Embeds)**\\n` +"
);

sec = sec.replace(
    "`-# **| Big Fonts:** ${bigFontsOn ? TOGGLE_ON : TOGGLE_OFF}\\n` +",
    "`-# **| Big Fonts:** ${bigFontsOn ? TOGGLE_ON : TOGGLE_OFF}\\n` +\n    `-# **| Selfbot Detection:** ${config.selfbotDetectionEnabled !== false ? TOGGLE_ON : TOGGLE_OFF}\\n` +"
);

fs.writeFileSync("src/commands/security.js", sec);
