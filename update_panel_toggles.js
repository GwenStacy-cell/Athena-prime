import fs from "fs";
let text = fs.readFileSync("src/commands/security.js", "utf8");

text = text.replace(
    "`-# **| Allow All Links (Global):** ${allowAllOn ? TOGGLE_ON : TOGGLE_OFF}\\n` +\n    `-# **| Allow Invites (Global):** ${globalInvOn ? TOGGLE_ON : TOGGLE_OFF}\\n` +",
    "`-# **| Hidden URL Filter:** ${hiddenUrlOn ? TOGGLE_ON : TOGGLE_OFF}\\n` +\n    `-# **| File Check Filter:** ${fileCheckOn ? TOGGLE_ON : TOGGLE_OFF}\\n` +"
);

text = text.replace(
    "const allowAllOn = config.allowAllLinks === true;\n  const globalInvOn = config.allowInvitesGlobally === true;",
    "const hiddenUrlOn = config.hiddenUrlEnabled !== false;\n  const fileCheckOn = config.fileCheckEnabled !== false;"
);

text = text.replace(
    "new ButtonBuilder().setCustomId('am_tgl_global_links').setLabel('Allow ALL Links').setStyle(ButtonStyle.Secondary),\n    new ButtonBuilder().setCustomId('am_tgl_global_invites').setLabel('Global Invites').setStyle(ButtonStyle.Secondary),",
    "new ButtonBuilder().setCustomId('am_tgl_hiddenurl').setLabel('Hidden URLs').setStyle(ButtonStyle.Secondary),\n    new ButtonBuilder().setCustomId('am_tgl_filecheck').setLabel('File Check').setStyle(ButtonStyle.Secondary),"
);

fs.writeFileSync("src/commands/security.js", text);
