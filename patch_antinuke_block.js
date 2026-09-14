import fs from "fs";
let js = fs.readFileSync("src/commands/security.js", "utf8");

const oldCode = `      async executePrefix(message, args) {
        const allowed = message.member.permissions.has(PermissionFlagsBits.Administrator) || isBotOwnerSync(message.author.id) || message.author.id === message.guild.ownerId || db.isExtraOwner(message.guild.id, message.author.id);
        if (!allowed) {
          return message.reply(cv2.danger('Access Denied', ' Only **Administrators**, the **Server Owner**, **Extra Owners**, or the **Bot Owner** can use this command.'));
        }`;

const newCode = `      async executePrefix(message, args) {
        const allowed = message.member.permissions.has(PermissionFlagsBits.Administrator) || isBotOwnerSync(message.author.id) || message.author.id === message.guild.ownerId || db.isExtraOwner(message.guild.id, message.author.id);
        if (!allowed) {
          return message.reply(cv2.danger('Access Denied', ' Only **Administrators**, the **Server Owner**, **Extra Owners**, or the **Bot Owner** can use this command.'));
        }
        
        const config = db.getGuildConfig(message.guild.id);
        if (!config.securityEnabled) {
          return message.reply(cv2.warn("Security Disabled", "Server security is currently globally disabled. You must run \`!security enable all\` to configure individual antinuke modules."));
        }`;

js = js.replace(oldCode, newCode);
fs.writeFileSync("src/commands/security.js", js);
