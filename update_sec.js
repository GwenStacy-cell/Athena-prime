import fs from "fs";

let text = fs.readFileSync("src/commands/security.js", "utf8");

text = text.replace(
    "const linkRole = config.linkBypassRole ? `<@&${config.linkBypassRole}>` : 'None';",
    "const linkRole = (config.linkBypassRoles && config.linkBypassRoles.length > 0) ? config.linkBypassRoles.map(r => `<@&${r}>`).join(', ') : 'None';"
);

text = text.replace(
    "const inviteRole = config.inviteBypassRole ? `<@&${config.inviteBypassRole}>` : 'None';",
    "const inviteRole = (config.inviteBypassRoles && config.inviteBypassRoles.length > 0) ? config.inviteBypassRoles.map(r => `<@&${r}>`).join(', ') : 'None';"
);

text = text.replace(
    "    new RoleSelectMenuBuilder()\n      .setCustomId('al_select_link_role')\n      .setPlaceholder('Select Link Bypass Role...')",
    "    new RoleSelectMenuBuilder()\n      .setCustomId('al_select_link_role')\n      .setPlaceholder('Select Link Bypass Roles...')\n      .setMinValues(0)\n      .setMaxValues(10)"
);

text = text.replace(
    "    new RoleSelectMenuBuilder()\n      .setCustomId('al_select_invite_role')\n      .setPlaceholder('Select Invite Bypass Role...')",
    "    new RoleSelectMenuBuilder()\n      .setCustomId('al_select_invite_role')\n      .setPlaceholder('Select Invite Bypass Roles...')\n      .setMinValues(0)\n      .setMaxValues(10)"
);

fs.writeFileSync("src/commands/security.js", text);
