import fs from "fs";
let js = fs.readFileSync("src/commands/security.js", "utf8");

const oldCodeSlash = `      async executeSlash(interaction) {
        const allowed = interaction.member.permissions.has(PermissionFlagsBits.Administrator) || isBotOwnerSync(interaction.user.id) || interaction.user.id === interaction.guild.ownerId || db.isExtraOwner(interaction.guild.id, interaction.user.id);
        if (!allowed) {
          return interaction.reply(cv2.danger('Access Denied', ' Only **Administrators**, the **Server Owner**, **Extra Owners**, or the **Bot Owner** can use this command.'));
        }`;

const newCodeSlash = `      async executeSlash(interaction) {
        const allowed = interaction.member.permissions.has(PermissionFlagsBits.Administrator) || isBotOwnerSync(interaction.user.id) || interaction.user.id === interaction.guild.ownerId || db.isExtraOwner(interaction.guild.id, interaction.user.id);
        if (!allowed) {
          return interaction.reply(cv2.danger('Access Denied', ' Only **Administrators**, the **Server Owner**, **Extra Owners**, or the **Bot Owner** can use this command.'));
        }
        
        const config = db.getGuildConfig(interaction.guild.id);
        if (!config.securityEnabled) {
          return interaction.reply(cv2.warn("Security Disabled", "Server security is currently globally disabled. You must run \`/security enable_all\` to configure individual antinuke modules."));
        }`;

js = js.replace(oldCodeSlash, newCodeSlash);
fs.writeFileSync("src/commands/security.js", js);
